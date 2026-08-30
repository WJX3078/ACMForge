"""确定性数据生成器（gen.py）的执行封装。

题目自带/LLM 生成的 gen.py 是"受信任的题目资产"，但仍以受限子进程方式运行
（超时保护），并通过统一命令行接口调用：

    python gen.py --mode <mode> --n <n> --seed <seed>

stdout 即为完整输入文件内容；必须只输出输入，不得有额外提示文字。
"""

from __future__ import annotations

import json
import sys
import time
from dataclasses import dataclass
from pathlib import Path

from acmforge.console import get_logger
from acmforge.domain.models import Verdict

logger = get_logger("acmforge.gen")

GEN_TIMEOUT_S = 30

# LLM 生成的 gen.py 在编排进程用户态直接执行（Windows 无 rlimit），
# 至少静态拦截明显的危险 import / 调用，作为最小防线。
# 允许：argparse / random / json / sys（stdout）——生成器只需纯计算输出。
_GEN_FORBIDDEN_RE = __import__("re").compile(
    r"\b(import\s+(os|subprocess|socket|shutil|ctypes|http|urllib|requests|pathlib|threading)|"
    r"from\s+(os|subprocess|socket|shutil|ctypes|http|urllib|requests|pathlib|threading)\s+import|"
    r"\beval\s*\(|\bexec\s*\(|\b__import__\b|"
    r"\bopen\s*\()",
    __import__("re").IGNORECASE,
)


def assert_gen_safe(code: str) -> None:
    """LLM 生成的生成器必须通过静态安全检查才能落盘执行。

    只允许 pure-computation 风格的生成器（random/argparse/sys.stdout）。
    """
    bad = _GEN_FORBIDDEN_RE.search(code)
    if bad:
        from acmforge.domain.errors import SpecError

        raise SpecError(f"gen.py 包含被禁止的操作（{bad.group(0)!r}）：生成器必须只做纯计算输出")


@dataclass
class GenOutput:
    ok: bool
    text: str = ""
    error: str = ""
    time_ms: float = 0.0


class GenRunner:
    """gen.py 的执行器：经由 Runner 抽象运行（P0-6）。

    runner 缺省为 LocalRunner（受控开发环境；generator 属题目资产，非远程不可信代码，
    且已有静态安全检查 + 超时 + 输出上限）。接入 DockerRunner 后同一接口即可沙箱化。
    """

    def __init__(self, gen_path: Path, runner=None):
        self.gen_path = Path(gen_path)
        if not self.gen_path.is_file():
            raise FileNotFoundError(f"generator 不存在: {self.gen_path}")
        if runner is None:
            from acmforge.runner.local import LocalRunner

            runner = LocalRunner()
        self.runner = runner

    def run(self, mode: str, seed: int, params: dict | None = None, n: int | None = None) -> GenOutput:
        """运行生成器（P0-11 协议）。

        - 新协议：--params '<JSON>'（n 作为 params 的一个键自动并入）
        - 兼容旧协议：gen.py 不认识 --params（argparse 退出码 2）时，
          自动去掉 --params 重试（保留 --n），并告警一次
        """
        merged: dict = dict(params or {})
        if n is not None:
            merged.setdefault("n", n)

        base_cmd = [sys.executable, str(self.gen_path), "--mode", mode, "--seed", str(seed)]
        cmd = list(base_cmd)
        if merged:
            cmd += ["--params", json.dumps(merged)]
        if "n" in merged:
            cmd += ["--n", str(merged["n"])]

        start = time.perf_counter()
        proc = self._exec(cmd)

        if proc.verdict == Verdict.TLE:
            return GenOutput(ok=False, error=f"gen 超时（>{GEN_TIMEOUT_S}s）")

        if proc.exit_code == 2 and "--params" in cmd:
            # 旧协议 gen.py：不认识 --params，回退到 --n
            if not getattr(self, "_warned_legacy", False):
                logger.warning("gen.py %s 不支持 --params，回退旧协议（仅 --n）", self.gen_path.name)
                self._warned_legacy = True
            legacy = list(base_cmd)
            if "n" in merged:
                legacy += ["--n", str(merged["n"])]
            start = time.perf_counter()
            proc = self._exec(legacy)
            if proc.verdict == Verdict.TLE:
                return GenOutput(ok=False, error=f"gen 超时（>{GEN_TIMEOUT_S}s）")

        elapsed = (time.perf_counter() - start) * 1000
        if proc.exit_code != 0:
            return GenOutput(
                ok=False,
                error=f"gen 退出码 {proc.exit_code}: {proc.stderr[-500:]}",
                time_ms=elapsed,
            )
        return GenOutput(ok=True, text=proc.stdout, time_ms=elapsed)

    def _exec(self, cmd: list[str], env: dict | None = None):
        # P0-6：经由 Runner 抽象执行（LocalRunner 提供超时/输出上限/内存采样）
        return self.runner.run_command(cmd, timeout_ms=GEN_TIMEOUT_S * 1000)

    def modes(self) -> list[str]:
        """询问 gen.py 支持的模式列表（约定：--modes 时打印 JSON 数组；失败则返回空）。"""
        import json

        try:
            proc = self.runner.run_command(
                [sys.executable, str(self.gen_path), "--modes"], timeout_ms=15000
            )
            if proc.verdict == Verdict.AC:
                data = json.loads(proc.stdout)
                if isinstance(data, list):
                    return [str(m) for m in data]
        except Exception as e:
            logger.debug("gen --modes 失败: %s", e)
        return []
