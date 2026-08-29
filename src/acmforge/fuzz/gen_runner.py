"""确定性数据生成器（gen.py）的执行封装。

题目自带/LLM 生成的 gen.py 是"受信任的题目资产"，但仍以受限子进程方式运行
（超时保护），并通过统一命令行接口调用：

    python gen.py --mode <mode> --n <n> --seed <seed>

stdout 即为完整输入文件内容；必须只输出输入，不得有额外提示文字。
"""

from __future__ import annotations

import os
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path

from acmforge.console import get_logger

logger = get_logger("acmforge.gen")

GEN_TIMEOUT_S = 30


@dataclass
class GenOutput:
    ok: bool
    text: str = ""
    error: str = ""
    time_ms: float = 0.0


class GenRunner:
    def __init__(self, gen_path: Path):
        self.gen_path = Path(gen_path)
        if not self.gen_path.is_file():
            raise FileNotFoundError(f"generator 不存在: {self.gen_path}")

    def run(self, mode: str, seed: int, n: int | None = None) -> GenOutput:
        cmd = [
            sys.executable,
            str(self.gen_path),
            "--mode",
            mode,
            "--seed",
            str(seed),
        ]
        if n is not None:
            cmd += ["--n", str(n)]
        env = dict(os.environ)
        env.setdefault("PYTHONIOENCODING", "utf-8")
        start = time.perf_counter()
        try:
            proc = subprocess.run(
                cmd,
                capture_output=True,
                timeout=GEN_TIMEOUT_S,
                env=env,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
            )
        except subprocess.TimeoutExpired:
            return GenOutput(ok=False, error=f"gen 超时（>{GEN_TIMEOUT_S}s）")
        except OSError as e:
            return GenOutput(ok=False, error=f"gen 启动失败: {e}")
        elapsed = (time.perf_counter() - start) * 1000
        if proc.returncode != 0:
            return GenOutput(
                ok=False,
                error=f"gen 退出码 {proc.returncode}: {proc.stderr.decode('utf-8', 'replace')[-500:]}",
                time_ms=elapsed,
            )
        return GenOutput(
            ok=True, text=proc.stdout.decode("utf-8", errors="replace"), time_ms=elapsed
        )

    def modes(self) -> list[str]:
        """询问 gen.py 支持的模式列表（约定：--modes 时打印 JSON 数组；失败则返回空）。"""
        import json

        env = dict(os.environ)
        env.setdefault("PYTHONIOENCODING", "utf-8")
        try:
            proc = subprocess.run(
                [sys.executable, str(self.gen_path), "--modes"],
                capture_output=True,
                timeout=15,
                env=env,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
            )
            if proc.returncode == 0:
                data = json.loads(proc.stdout.decode("utf-8", "replace"))
                if isinstance(data, list):
                    return [str(m) for m in data]
        except Exception as e:
            logger.debug("gen --modes 失败: %s", e)
        return []
