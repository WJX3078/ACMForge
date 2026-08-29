"""本地执行器：进程级隔离的最小实现（超时 / 输出上限 / 内存测量）。

安全边界（v0.1 明确声明）：
- LocalRunner 只做资源限制与观测，不做系统调用隔离。
- 最终形态必须是 DockerSandbox（网络禁用、只读根文件系统、cgroup 限额），
  接口与本模块保持一致（见 runner/README 计划），当前在 Windows 宿主上先行开发。
- 所有 LLM 生成代码都按"不可信"对待：有限时限、输出上限，禁止网络类测试出现。

实现要点：
- 读线程读取 stdout/stderr 并强制上限，防止恶意程序把宿主机内存打爆。
- 超时 => 杀进程树（POSIX 进程组 / Windows taskkill /T）=> TLE。
- POSIX 下用 rlimit 限制内存与 CPU；Windows 下用 psutil 采样峰值内存。
"""

from __future__ import annotations

import os
import subprocess
import threading
import time
from pathlib import Path

from acmforge.domain.models import ExecutionResult, Verdict
from acmforge.console import get_logger

logger = get_logger("acmforge.runner")

STDOUT_LIMIT = 64 * 1024 * 1024  # 64MB，防刷屏
STDERR_LIMIT = 1 * 1024 * 1024

try:  # 内存测量（可选依赖，缺失时降级）
    import psutil  # type: ignore

    _PSUTIL = psutil
except Exception:  # pragma: no cover
    _PSUTIL = None


def _make_preexec(memory_mb: int | None):
    """POSIX: 子进程 rlimit。Windows 不适用（返回 None）。"""
    if os.name == "nt":
        return None

    def preexec():  # pragma: no cover - 仅 POSIX
        import resource

        cpu_seconds = 600
        resource.setrlimit(resource.RLIMIT_CPU, (cpu_seconds, cpu_seconds))
        if memory_mb:
            b = memory_mb * 1024 * 1024
            resource.setrlimit(resource.RLIMIT_AS, (b, b))
        resource.setrlimit(resource.RLIMIT_NPROC, (512, 512))
        resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
        os.setsid()

    return preexec


def _kill_tree(proc: subprocess.Popen) -> None:
    try:
        if os.name == "nt":
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                capture_output=True,
                timeout=10,
            )
        else:
            import signal as sig

            try:
                os.killpg(os.getpgid(proc.pid), sig.SIGKILL)
            except Exception:
                proc.kill()
    except Exception:  # pragma: no cover
        try:
            proc.kill()
        except Exception:
            pass


class _Reader(threading.Thread):
    """带上限的流读取线程：超限即停读（由主流程杀进程）。"""

    def __init__(self, stream, limit: int):
        super().__init__(daemon=True)
        self.stream = stream
        self.limit = limit
        self.buf = bytearray()
        self.truncated = False

    def run(self) -> None:
        try:
            while True:
                chunk = self.stream.read(65536)
                if not chunk:
                    break
                room = self.limit - len(self.buf)
                if room <= 0:
                    self.truncated = True
                    # 继续排空但不存储，避免管道阻塞死锁
                    continue
                self.buf.extend(chunk[:room])
                if len(chunk) > room:
                    self.truncated = True
        except Exception:
            pass


class LocalRunner:
    """在同一台宿主机上以受限子进程方式运行程序。"""

    def __init__(self, default_memory_mb: int | None = None):
        self.default_memory_mb = default_memory_mb

    def run(
        self,
        exe: str | Path,
        stdin_bytes: bytes = b"",
        timeout_ms: int = 2000,
        memory_mb: int | None = None,
        cwd: str | Path | None = None,
    ) -> ExecutionResult:
        timeout_s = max(timeout_ms, 1) / 1000.0
        mem_limit = memory_mb or self.default_memory_mb

        popen_kwargs: dict = {
            "stdin": subprocess.PIPE,
            "stdout": subprocess.PIPE,
            "stderr": subprocess.PIPE,
            "cwd": str(cwd) if cwd else None,
        }
        if os.name == "nt":
            popen_kwargs["creationflags"] = subprocess.CREATE_NO_WINDOW
        else:
            popen_kwargs["preexec_fn"] = _make_preexec(mem_limit)

        start = time.perf_counter()
        peak_kb: int | None = None
        proc: subprocess.Popen | None = None
        timed_out = False
        internal_error: str | None = None

        try:
            proc = subprocess.Popen([str(exe)], **popen_kwargs)
        except OSError as e:
            return ExecutionResult(
                verdict=Verdict.RE, stderr=f"failed to start: {e}", runtime_ms=0.0
            )

        out_reader = _Reader(proc.stdout, STDOUT_LIMIT)  # type: ignore[arg-type]
        err_reader = _Reader(proc.stderr, STDERR_LIMIT)  # type: ignore[arg-type]
        out_reader.start()
        err_reader.start()

        # 内存采样线程（Windows / psutil 路径）
        mem_stop = threading.Event()

        def sample_mem() -> None:
            nonlocal peak_kb
            if _PSUTIL is None:
                return
            try:
                parent = _PSUTIL.Process(proc.pid)  # type: ignore[union-attr]
                while not mem_stop.is_set():
                    total = parent.memory_info().rss
                    try:
                        for child in parent.children(recursive=True):
                            total += child.memory_info().rss
                    except Exception:
                        pass
                    peak_kb = max(peak_kb or 0, int(total / 1024))
                    mem_stop.wait(0.01)
            except Exception:
                pass

        mem_thread = threading.Thread(target=sample_mem, daemon=True)
        if _PSUTIL is not None:
            mem_thread.start()

        stdin_thread: threading.Thread | None = None

        def feed_stdin() -> None:
            try:
                if proc.stdin:  # type: ignore[union-attr]
                    proc.stdin.write(stdin_bytes)
                    proc.stdin.close()
            except Exception:
                pass

        if stdin_bytes:
            stdin_thread = threading.Thread(target=feed_stdin, daemon=True)
            stdin_thread.start()

        try:
            proc.wait(timeout=timeout_s)
        except subprocess.TimeoutExpired:
            timed_out = True
            _kill_tree(proc)
            try:
                proc.wait(timeout=10)
            except Exception:
                pass

        runtime_ms = (time.perf_counter() - start) * 1000
        mem_stop.set()
        if _PSUTIL is not None:
            mem_thread.join(timeout=1)
        out_reader.join(timeout=5)
        err_reader.join(timeout=5)

        stdout = out_reader.buf.decode("utf-8", errors="replace")
        stderr = err_reader.buf.decode("utf-8", errors="replace")
        exit_code = proc.returncode if not timed_out else proc.returncode

        if timed_out:
            verdict = Verdict.TLE
        elif out_reader.truncated:
            verdict = Verdict.RE
            stderr = (stderr + "\n[output limit exceeded]").strip()
            exit_code = proc.returncode
        elif proc.returncode != 0:
            verdict = Verdict.RE
        else:
            verdict = Verdict.AC  # 输出比对由 checker 决定，此处仅表示"正常退出"

        if internal_error:
            stderr += f"\n[runner] {internal_error}"

        return ExecutionResult(
            verdict=verdict,
            exit_code=exit_code,
            runtime_ms=round(runtime_ms, 2),
            memory_kb=peak_kb,
            stdout=stdout,
            stderr=stderr[-4000:],
            timed_out=timed_out,
            output_truncated=out_reader.truncated,
        )
