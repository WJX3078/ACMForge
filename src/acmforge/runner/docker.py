"""DockerRunner：真正的隔离执行（v0.1.1 骨架）。

设计目标（全部落实在 docker run 参数上）：
- --network none          网络禁用
- --read-only + tmpfs     根文件系统只读，仅 /tmp 可写
- --user 65534:65534      非 root（nobody）
- --memory / --cpus / --pids-limit   cgroup 资源限额
- wall timeout            由 run_command 外层超时控制
- stdout/stderr 上限      由读取线程控制（复用 LocalRunner 的输出上限逻辑）

本机无 Docker 时：__init__ 直接抛 SandboxUnavailable，调用方不得静默降级。
执行层通过 `docker run --rm ...` 封装；镜像由 configs/sandbox.yaml 声明（默认 cpp20 镜像）。
"""

from __future__ import annotations

import shutil
import subprocess

from acmforge.console import get_logger
from acmforge.domain.errors import SandboxUnavailable
from acmforge.domain.models import ExecutionResult

logger = get_logger("acmforge.docker")

DEFAULT_IMAGE = "acmforge-cpp20:latest"


def docker_available() -> bool:
    docker = shutil.which("docker") or shutil.which("docker.exe")
    if not docker:
        return False
    try:
        proc = subprocess.run(
            [docker, "info", "--format", "{{.ServerVersion}}"],
            capture_output=True,
            timeout=15,
            creationflags=subprocess.CREATE_NO_WINDOW if hasattr(subprocess, "CREATE_NO_WINDOW") else 0,
        )
        return proc.returncode == 0
    except Exception:
        return False


class DockerRunner:
    """实现 Runner 与 CommandRunner 协议；无 Docker 环境直接拒绝。"""

    name = "docker"

    def __init__(self, image: str = DEFAULT_IMAGE, require_running: bool = True):
        self.image = image
        self.docker_bin = shutil.which("docker") or shutil.which("docker.exe")
        if require_running and not docker_available():
            raise SandboxUnavailable(
                "Docker 不可用（未安装或 daemon 未运行）。"
                "不可信代码的隔离执行被拒绝 —— 不要用 LocalRunner 替代。"
                "请安装并启动 Docker，或显式使用 LocalRunner（仅限受控开发环境）。"
            )

    # -- docker run 参数构造（独立出来便于单元测试断言隔离 flags） --

    @staticmethod
    def build_run_args(
        image: str,
        memory_mb: int | None,
        timeout_s: float,
        workdir: str = "/sandbox",
    ) -> list[str]:
        args = [
            "run",
            "--rm",
            "--network", "none",
            "--read-only",
            "--tmpfs", f"{workdir}:rw,size=64m,noexec",
            "--tmpfs", "/tmp:rw,size=64m",
            "--user", "65534:65534",
            "--pids-limit", "128",
            "--cpus", "1",
            "--memory", f"{memory_mb or 1024}m",
            "--memory-swap", f"{memory_mb or 1024}m",
            "-v", "%SANDBOX_SRC%:/sandbox/src:ro",
            image,
        ]
        return args

    # -- 协议实现（执行体在骨架阶段显式拒绝，接入 Docker 后启用） --

    def run(self, exe: str, stdin_bytes: bytes = b"", timeout_ms: int = 2000,
            memory_mb: int | None = None, cwd: str | None = None) -> ExecutionResult:
        raise SandboxUnavailable(
            "DockerRunner 执行层尚未接入镜像构建流程（v0.1.1 骨架）。"
            f"已构造的隔离参数：{self.build_run_args(self.image, memory_mb, timeout_ms / 1000)}"
        )

    def run_command(self, argv: list[str], stdin_bytes: bytes = b"", timeout_ms: int = 30000,
                    memory_mb: int | None = None, cwd: str | None = None) -> ExecutionResult:
        raise SandboxUnavailable(
            "DockerRunner 执行层尚未接入镜像构建流程（v0.1.1 骨架）。"
        )
