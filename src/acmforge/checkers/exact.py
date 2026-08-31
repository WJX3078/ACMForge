"""默认 checker：token 级字符串精确比较（忽略空白差异）。"""

from __future__ import annotations

from acmforge.checkers.tokens import tokenize


class ExactTokenChecker:
    name = "exact"

    def compare(self, expected: str, actual: str) -> tuple[bool, str]:
        et = tokenize(expected)
        at = tokenize(actual)
        if len(et) != len(at):
            return False, f"token 数不同: expected {len(et)}, actual {len(at)}"
        for i, (e, a) in enumerate(zip(et, at)):
            if e != a:
                return False, f"第 {i + 1} 个 token 不同: {e!r} vs {a!r}"
        return True, ""
