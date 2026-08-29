"""默认 checker：按 token 比较，数值 token 支持精度容差。

预留：SPJ / testlib checker 的自定义扩展点（Checker 协议）。
"""

from __future__ import annotations

import math
import re

_TOKEN_RE = re.compile(r"\S+")
_FLOAT_RE = re.compile(r"^[+-]?(\d+\.\d*|\.\d+|\d+)([eE][+-]?\d+)?$")


def tokens(text: str) -> list[str]:
    return _TOKEN_RE.findall(text)


def compare_outputs(
    expected: str, actual: str, float_tol: float = 1e-6
) -> tuple[bool, str]:
    """返回 (是否一致, 原因说明)。空白不敏感；浮点按 tol 比较。"""
    et = tokens(expected)
    at = tokens(actual)
    if len(et) != len(at):
        return False, f"token 数不同: expected {len(et)}, actual {len(at)}"
    for i, (e, a) in enumerate(zip(et, at)):
        if e == a:
            continue
        if _FLOAT_RE.match(e) and _FLOAT_RE.match(a):
            try:
                fe, fa = float(e), float(a)
            except ValueError:
                return False, f"第 {i + 1} 个 token 不同: {e!r} vs {a!r}"
            if math.isclose(fe, fa, rel_tol=float_tol, abs_tol=float_tol):
                continue
            return False, f"第 {i + 1} 个 token 数值不同: {e} vs {a}"
        return False, f"第 {i + 1} 个 token 不同: {e!r} vs {a!r}"
    return True, ""
