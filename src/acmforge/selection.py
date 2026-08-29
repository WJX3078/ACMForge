"""Kill Matrix 与贪心 Set Cover 测试选择。

- Kill：错误解在某测试上 verdict != AC（WA/TLE/MLE/RE 都算击杀）。
- 数据库不存大二维矩阵：只存 KillRecord 列表，按需物化。
- 选择：must-include（样例/边界/最大规模）+ 贪心 set cover（单位新增击杀最大化）。
"""

from __future__ import annotations

from acmforge.domain.models import KillRecord, SelectionResult, Verdict


def is_kill(verdict: Verdict) -> bool:
    return verdict != Verdict.AC


def build_coverage(kill_records: list[KillRecord]) -> tuple[dict[str, list[str]], dict[str, list[str]]]:
    """返回 (mutant -> 杀它的测试列表, test -> 它杀的 mutant 列表)。"""
    mutant_kills: dict[str, list[str]] = {}
    test_kills: dict[str, list[str]] = {}
    for r in kill_records:
        if r.killed:
            mutant_kills.setdefault(r.solution_id, []).append(r.testcase_id)
            test_kills.setdefault(r.testcase_id, []).append(r.solution_id)
    return mutant_kills, test_kills


def greedy_select(
    kill_records: list[KillRecord],
    mutant_ids: list[str],
    must_include: list[str],
    max_tests: int = 60,
) -> SelectionResult:
    """贪心 set cover：每步选能新增击杀最多未覆盖 mutant 的测试。"""
    mutant_kills, test_kills = build_coverage(kill_records)
    covered: set[str] = set()
    selected: list[str] = list(dict.fromkeys(must_include))

    for t in selected:
        covered.update(test_kills.get(t, []))

    remaining_tests = [
        t for t in test_kills if t not in set(selected)
    ]
    while len(selected) < max_tests:
        best_test: str | None = None
        best_gain = 0
        for t in remaining_tests:
            gain = sum(1 for m in test_kills[t] if m not in covered)
            if gain > best_gain:
                best_gain = gain
                best_test = t
        if best_test is None or best_gain == 0:
            break
        selected.append(best_test)
        remaining_tests.remove(best_test)
        covered.update(test_kills[best_test])

    unkillable = [m for m in mutant_ids if m not in covered]
    coverage = {m: sorted(set(mutant_kills.get(m, []))) for m in mutant_ids}
    kill_rate = (len(mutant_ids) - len(unkillable)) / len(mutant_ids) if mutant_ids else 1.0

    return SelectionResult(
        selected_ids=selected,
        must_include_ids=list(dict.fromkeys(must_include)),
        coverage=coverage,
        unkillable=unkillable,
        kill_rate=round(kill_rate, 4),
    )


def summarize_kill_matrix(
    kill_records: list[KillRecord], mutant_ids: list[str]
) -> dict:
    """报告用：每个 mutant 的击杀情况一览。"""
    mutant_kills, _ = build_coverage(kill_records)
    rows = []
    for m in mutant_ids:
        kills = mutant_kills.get(m, [])
        rows.append(
            {
                "mutant_id": m,
                "killed": bool(kills),
                "kill_count": len(kills),
                "killing_tests": kills[:10],
            }
        )
    killed_count = sum(1 for r in rows if r["killed"])
    return {
        "rows": rows,
        "mutant_total": len(mutant_ids),
        "mutant_killed": killed_count,
        "kill_rate": round(killed_count / len(mutant_ids), 4) if mutant_ids else 1.0,
    }


def slow_solution_semantics(
    records_for_mutant: list[KillRecord],
    expected: Verdict,
    small_test_ids: set[str],
) -> dict:
    """慢解（TLE/MLE）语义验证（P0-5）。

    真正的"错误复杂度解"必须：小规模测试上全部 AC（答案正确），
    且在某个测试上 observed verdict == expected（TLE/MLE）。

    返回:
        semantically_valid: 小规模测试全部 AC（否则它只是个错误解，不是慢解）
        expected_failure_hit: 是否在某个测试上出现了预期 verdict
        generic_killed: 是否被 generic kill（verdict != AC）
    """
    executions = [r for r in records_for_mutant]
    small = [r for r in executions if r.testcase_id in small_test_ids]
    semantically_valid = bool(small) and all(r.verdict == Verdict.AC for r in small)
    expected_failure_hit = any(
        r.verdict == expected for r in executions
    )
    generic_killed = any(r.killed for r in executions)
    return {
        "semantically_valid": semantically_valid,
        "expected_failure_hit": expected_failure_hit,
        "generic_killed": generic_killed,
    }
