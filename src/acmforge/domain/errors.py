"""自定义异常体系：所有可预期错误都应有明确类型，而不是裸 Exception。"""

from __future__ import annotations


class AcmforgeError(Exception):
    """所有 ACMForge 错误的基类。"""


class SpecError(AcmforgeError):
    """problem.yaml 解析/校验失败。"""


class ConfigError(AcmforgeError):
    """配置加载失败。"""


class ToolchainError(AcmforgeError):
    """编译器缺失、编译环境不可用等。"""


class SandboxUnavailable(AcmforgeError):
    """请求的沙箱 Runner 不可用（如未安装 Docker）。"""


class LLMError(AcmforgeError):
    """LLM 调用失败（网络、鉴权、格式不符合 schema 且重试耗尽）。"""


class WorkflowError(AcmforgeError):
    """Workflow 编排错误。"""
