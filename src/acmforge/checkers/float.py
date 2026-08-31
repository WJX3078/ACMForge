"""浮点 checker：仅在 ProblemSpec 明确指定 checker.type=float 时使用。"""

from __future__ import annotations

import math

from acmforge.checkers.tokens import is_float_token, tokenize


class FloatChecker:
    name = "float"

    def __init__(self, abs_eps: float = 1e-9, rel_eps: float = 1e-9):
        self.abs_eps = abs_eps
        self.rel_eps = rel_eps

    def compare(self, expected: str, actual: str) -> tuple[bool, str]:
        et = tokenize(expected)
        at = tokenize(actual)
        if len(et) != len(at):
            return False, f"token 数不同: expected {len(et)}, actual {len(at)}"
        for i, (e, a) in enumerate(zip(et, at)):
            if e == a:
                continue
            if is_float_token(e) and is_float_token(a):
                try:
                    fe, fa = float(e), float(a)
                except ValueError:
                    return False, f"第 {i + 1} 个 token 不同: {e!r} vs {a!r}"
                if math.isclose(fe, fa, rel_tol=self.rel_eps, abs_tol=self.abs_eps):
                    continue
                return False, f"第 {i + 1} 个 token 数值超差: {e} vs {a} (eps={self.abs_eps}/{self.rel_eps})"
            return False, f"第 {i + 1} 个 token 不同: {e!r} vs {a!r}"
        return True, ""
