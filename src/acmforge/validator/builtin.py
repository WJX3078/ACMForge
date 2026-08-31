"""内置校验器：基于 ProblemSpec.constraints.bounds 的保守检查。

规则（按顺序）：
1. 空输入 => FAIL
2. 存在无法解析为整数的 token => UNKNOWN（格式未知，不误判）
3. 第一行只有一个 token 且 bounds 声明了 n => 该 token 必须落在 n 范围内，否则 FAIL
4. bounds 声明了 value => 第一行之后的整数 token 必须落在 value 范围内，否则 FAIL
5. 以上均未触发 => UNKNOWN（没有足够信息下结论）
"""

from __future__ import annotations

from acmforge.domain.models import ProblemSpec
from acmforge.validator.base import ValidationResult


def _int_or_none(token: str) -> int | None:
    try:
        return int(token)
    except ValueError:
        return None


class BuiltinValidator:
    name = "builtin"

    def validate(self, text: str, spec: ProblemSpec) -> ValidationResult:
        stripped = text.strip()
        if not stripped:
            return ValidationResult(valid=False, status="fail", reason="输入为空")

        lines = stripped.split("\n")
        tokens = stripped.split()
        parsed: list[int | None] = [_int_or_none(t) for t in tokens]
        if any(v is None for v in parsed):
            return ValidationResult(
                valid=False, status="unknown", reason="存在非整数 token，builtin validator 无法校验该格式"
            )

        bounds = spec.constraints.bounds or {}
        checks_applied = 0

        first_line_tokens = lines[0].split()

        # 规则 3：仅在"第一行唯一 token"这一可确证格式下检查 n
        n_bounds = bounds.get("n")
        if n_bounds is not None and len(first_line_tokens) == 1:
            n = _int_or_none(first_line_tokens[0])
            checks_applied += 1
            if n is None or not (int(n_bounds[0]) <= n <= int(n_bounds[1])):
                return ValidationResult(
                    valid=False,
                    status="fail",
                    reason=f"首 token n={n} 超出 bounds.n={n_bounds}",
                )

        # 规则 4：第一行之后的 token 必须落在 value 范围内
        value_bounds = bounds.get("value")
        if value_bounds is not None:
            rest_tokens = [t for line in lines[1:] for t in line.split()]
            lo, hi = int(value_bounds[0]), int(value_bounds[1])
            checks_applied += 1
            for t in rest_tokens:
                v = _int_or_none(t)
                if v is None or not (lo <= v <= hi):
                    return ValidationResult(
                        valid=False,
                        status="fail",
                        reason=f"token {t!r} 超出 bounds.value=[{lo}, {hi}]",
                    )

        if checks_applied == 0:
            return ValidationResult(
                valid=False,
                status="unknown",
                reason="bounds 不足以确证任何检查，状态 UNKNOWN（放行但记录）",
            )
        return ValidationResult(valid=True, status="pass", reason=f"通过 {checks_applied} 项检查")
