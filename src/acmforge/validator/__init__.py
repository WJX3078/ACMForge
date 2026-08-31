"""输入校验层（P0-2）：generator / shrinker 产出的输入必须过 validator 才能进入验证链。

v0.1.1 的 BuiltinValidator 是保守的：
- 能确证非法 => FAIL（拒绝）
- 无法精确校验 => UNKNOWN（放行但如实记录，绝不误判"合法"）
格式感知的精确校验（testlib validator / 自定义）为后续扩展点。
"""

from __future__ import annotations

from acmforge.validator.base import InputValidator, ValidationResult
from acmforge.validator.builtin import BuiltinValidator

__all__ = ["InputValidator", "ValidationResult", "BuiltinValidator"]
