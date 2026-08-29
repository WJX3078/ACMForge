"""C++ 编译器封装（g++ / C++20）。

编译器定位顺序：
    1. 配置 runner.compiler_path
    2. PATH 中的 g++ / g++.exe
    3. 项目 tools/mingw64/bin/g++.exe（便携版工具链）
    4. 常见 MinGW 安装位置
"""

from __future__ import annotations

import os
import shutil
import subprocess
import time
from pathlib import Path

from pydantic import BaseModel

from acmforge.config import RunnerConfig
from acmforge.console import get_logger
from acmforge.domain.errors import ToolchainError

logger = get_logger("acmforge.compiler")

_COMMON_LOCATIONS = (
    # 便携版工具链推荐安装位置（工具链自身路径必须纯 ASCII，否则 ld 无法打开库文件）
    Path.home() / ".acmforge" / "mingw64" / "bin",
    Path("tools/mingw64/bin"),
    Path("C:/msys64/mingw64/bin"),
    Path("C:/mingw64/bin"),
    Path("C:/Program Files/mingw64/bin"),
    Path("C:/TDM-GCC-64/bin"),
    Path("C:/Strawberry/c/bin"),
)


class CompileResult(BaseModel):
    ok: bool
    exe_path: str | None = None
    compiler_stderr: str = ""
    time_ms: float = 0.0


def find_gxx(configured: str | None = None) -> str:
    if configured:
        p = Path(configured)
        if p.is_file():
            return str(p)
        raise ToolchainError(f"配置的编译器不存在: {configured}")

    found = shutil.which("g++") or shutil.which("g++.exe")
    if found:
        return found

    for base in _COMMON_LOCATIONS:
        cand = base / "g++.exe"
        if cand.is_file():
            return str(cand)
        cand = base / "g++"
        if cand.is_file():
            return str(cand)

    raise ToolchainError(
        "未找到 g++ 编译器。请安装 MinGW-w64 并加入 PATH，"
        "或在 configs/default.yaml 的 runner.compiler_path 指定 g++ 路径。"
    )


class Compiler:
    def __init__(self, config: RunnerConfig):
        self.config = config
        self._gxx: str | None = None

    @property
    def gxx(self) -> str:
        if self._gxx is None:
            self._gxx = find_gxx(self.config.compiler_path)
        return self._gxx

    def version(self) -> str:
        out = subprocess.run(
            [self.gxx, "--version"], capture_output=True, text=True, timeout=15
        )
        return (out.stdout or out.stderr).strip().splitlines()[0] if out.stdout else "unknown"

    def compile(self, source: Path, out_dir: Path, name: str) -> CompileResult:
        """编译单个 C++ 源文件；编译错误返回 ok=False（verdict=CE），绝不抛异常。"""
        out_dir.mkdir(parents=True, exist_ok=True)
        exe = out_dir / (f"{name}.exe" if os.name == "nt" else name)
        cmd = [self.gxx, *self.config.extra_flags, "-o", str(exe), str(source)]
        start = time.perf_counter()
        try:
            proc = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=self.config.compile_timeout_ms / 1000,
            )
        except subprocess.TimeoutExpired:
            return CompileResult(
                ok=False,
                compiler_stderr=f"编译超时（>{self.config.compile_timeout_ms}ms）",
                time_ms=(time.perf_counter() - start) * 1000,
            )
        elapsed = (time.perf_counter() - start) * 1000
        ok = proc.returncode == 0 and exe.exists()
        if ok:
            logger.debug("compiled %s -> %s in %.0fms", source.name, exe.name, elapsed)
        else:
            logger.warning("compile failed: %s", source.name)
        return CompileResult(
            ok=ok,
            exe_path=str(exe) if ok else None,
            compiler_stderr=(proc.stderr or "")[-20000:],
            time_ms=elapsed,
        )
