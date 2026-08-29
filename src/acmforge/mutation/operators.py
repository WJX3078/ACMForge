"""确定性源码变异：对 std.cpp 做文本级算子替换，制造"典型错误"变异体。

设计约束：
- 每个变异体只应用"一个算子在一个位置"，保证错误可归因。
- 跳过 for 头部 / #include 行，避免制造只会越界的等价/崩溃变异体。
- 变异体必须编译通过才保留；语义等价的会在 Kill Matrix 阶段被如实报告。
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from acmforge.domain.models import MutantCategory

# 跳过这些行，避免无意义变异
_SKIP_LINE_RE = re.compile(r"(^\s*#|for\s*\(|while\s*\(|using\s+namespace)")


@dataclass
class MutationOperator:
    name: str
    pattern: str  # 正则
    replacement: str
    category: MutantCategory
    description: str
    expected_verdict: str  # "WA" | "TLE" | "MLE"
    max_sites: int = 2


OPERATORS: list[MutationOperator] = [
    # 注：max_sites 保守取值，避免制造"语义等价变异体"（它们不可击杀，会虚耗 kill rate）
    MutationOperator(
        name="longlong_to_int",
        pattern=r"\blong long\b",
        replacement="int",
        category=MutantCategory.OVERFLOW,
        description="用 int 保存可能溢出的累加器/答案（long long → int）",
        expected_verdict="WA",
        max_sites=1,
    ),
    MutationOperator(
        name="llmin_to_zero",
        pattern=r"\bLLONG_MIN\b",
        replacement="0LL",
        category=MutantCategory.BOUNDARY,
        description="初始值错误：把 -inf 初始化改为 0（全负数答案错）",
        expected_verdict="WA",
        max_sites=1,
    ),
    MutationOperator(
        name="llmax_to_zero",
        pattern=r"\bLLONG_MAX\b",
        replacement="0LL",
        category=MutantCategory.BOUNDARY,
        description="初始值错误：把 +inf 初始化改为 0",
        expected_verdict="WA",
        max_sites=1,
    ),
    MutationOperator(
        name="max_to_min",
        pattern=r"\bstd::max\b",
        replacement="std::min",
        category=MutantCategory.WRONG_GREEDY,
        description="贪心方向反转（std::max → std::min）",
        expected_verdict="WA",
        max_sites=2,
    ),
    MutationOperator(
        name="min_to_max",
        pattern=r"\bstd::min\b",
        replacement="std::max",
        category=MutantCategory.WRONG_GREEDY,
        description="贪心方向反转（std::min → std::max）",
        expected_verdict="WA",
        max_sites=2,
    ),
    MutationOperator(
        name="plus_to_minus",
        pattern=r"\+=",
        replacement="-=",
        category=MutantCategory.WRONG_TRANSITION,
        description="状态转移符号写反（+= → -=）",
        expected_verdict="WA",
        max_sites=1,
    ),
    MutationOperator(
        name="lt_to_le",
        pattern=r" < ",
        replacement=" <= ",
        category=MutantCategory.BOUNDARY,
        description="边界条件 off-by-one（< → <=）",
        expected_verdict="WA",
        max_sites=1,
    ),
]


def apply_mutations(
    source: str, operators: list[MutationOperator] | None = None
) -> list[tuple[MutationOperator, int, str]]:
    """返回 [(operator, site_index, mutated_source), ...]。

    只有当变异后的代码确实不同时才收录。
    """
    ops = operators if operators is not None else OPERATORS
    results: list[tuple[MutationOperator, int, str]] = []
    lines = source.split("\n")

    for op in ops:
        site = 0
        for li, line in enumerate(lines):
            if site >= op.max_sites:
                break
            if _SKIP_LINE_RE.search(line):
                continue
            new_line, n = re.subn(op.pattern, op.replacement, line)
            if n > 0 and new_line != line:
                mutated = "\n".join(lines[:li] + [new_line] + lines[li + 1 :])
                results.append((op, site, mutated))
                site += 1
    return results
