"""Runner 协议（P0-6）：所有不可信代码执行必须经由统一 Runner 抽象。

安全边界（诚实声明）：
- LocalRunner = 进程级资源限制 + 观测，不具备系统调用隔离，
  只应用于受控开发环境；生产/不可信环境必须使用 DockerRunner。
- DockerRunner 提供真正的隔离（network disabled / read-only rootfs /
  non-root / cgroup 限额），本机无 Docker 时以 SandboxUnavailable 明确拒绝，
  绝不静默降级到 LocalRunner。
"""

from __future__ import annotations

from typing import Protocol

from acmforge.domain.models import ExecutionResult


class Runner(Protocol):
    """可执行文件的受限运行器（编译产物：std/brute/mutant/validator）。"""

    name: str

    def run(
        self,
        exe: str,
        stdin_bytes: bytes = b"",
        timeout_ms: int = 2000,
        memory_mb: int | None = None,
        cwd: str | None = None,
    ) -> ExecutionResult:
        ...


class CommandRunner(Protocol):
    """任意命令行的受限运行器（解释型不可信代码：gen.py / LLM validator）。"""

    name: str

    def run_command(
        self,
        argv: list[str],
        stdin_bytes: bytes = b"",
        timeout_ms: int = 30000,
        memory_mb: int | None = None,
        cwd: str | None = None,
    ) -> ExecutionResult:
        ...


def describe_limits(memory_mb: int | None, timeout_ms: int) -> str:
    return f"memory={memory_mb or 'unlimited'}MB timeout={timeout_ms}ms"
