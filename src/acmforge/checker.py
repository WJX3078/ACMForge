"""默认比较函数：token 级字符串精确比较（v0.1.1 语义硬化）。

历史行为变更：旧版本对"都像数字"的 token 自动使用浮点容差，
这会让整数题把 1000000 与 1000000.5 判为一致 —— 已移除。
需要浮点容差的题必须在 ProblemSpec 中显式声明 checker: {type: float, ...}。
"""

from __future__ import annotations

from acmforge.checkers import ExactTokenChecker

_default_checker = ExactTokenChecker()


def compare_outputs(expected: str, actual: str) -> tuple[bool, str]:
    """token 级精确比较（忽略空白差异）。返回 (是否一致, 原因说明)。"""
    return _default_checker.compare(expected, actual)
