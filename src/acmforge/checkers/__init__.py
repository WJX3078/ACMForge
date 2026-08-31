"""Checker 体系：默认 exact token 严格比较；float 仅在 spec 明确指定时启用。

语义规则（v0.1.1 硬化）：
- ExactTokenChecker：忽略空白差异，每个 token 字符串必须完全一致（"001" != "1"）。
- FloatChecker：两个 token 都可解析为数值时按 abs/rel 容差比较，否则退回字符串精确比较。
"""

from __future__ import annotations

from typing import Protocol

from acmforge.checkers.exact import ExactTokenChecker
from acmforge.checkers.float import FloatChecker
from acmforge.checkers.tokens import is_float_token, tokenize


class Checker(Protocol):
    name: str

    def compare(self, expected: str, actual: str) -> tuple[bool, str]:
        """返回 (是否一致, 原因说明)。"""
        ...


def make_checker(spec_checker) -> Checker:
    """根据 ProblemSpec.checker（str 或 CheckerConfig）构造 checker。"""
    if spec_checker is None:
        return ExactTokenChecker()
    if isinstance(spec_checker, str):
        # "default" / "custom"（custom/testlib 为预留）—— v0.1.1 全部按 exact 语义
        return ExactTokenChecker()
    cfg = spec_checker
    if getattr(cfg, "type", "") == "float":
        return FloatChecker(abs_eps=cfg.abs_eps, rel_eps=cfg.rel_eps)
    return ExactTokenChecker()


__all__ = ["Checker", "ExactTokenChecker", "FloatChecker", "make_checker", "tokenize", "is_float_token"]
