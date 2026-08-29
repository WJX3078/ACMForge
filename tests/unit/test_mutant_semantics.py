"""P0-5 回归：TLE/MLE mutant 语义 —— generic kill 与 expected failure validation 分离。"""

from acmforge.domain.models import KillRecord, Verdict
from acmforge.agents.schemas import WrongSolutionItem
from acmforge.selection import slow_solution_semantics
from acmforge.workflow.nodes import _parse_verdict, _role_for


def _rec(test: str, verdict: Verdict, killed: bool | None = None) -> KillRecord:
    return KillRecord(
        testcase_id=test,
        solution_id="m1",
        verdict=verdict,
        killed=(verdict != Verdict.AC) if killed is None else killed,
    )


def test_tle_mutant_wa_does_not_count_as_complexity_kill():
    """TLE 解在某测试上 WA：generic kill 成立，但复杂度击杀不成立。"""
    recs = [_rec("sample_1", Verdict.AC), _rec("t_big", Verdict.WA)]
    out = slow_solution_semantics(recs, Verdict.TLE, small_test_ids={"sample_1"})
    assert out["generic_killed"] is True
    assert out["expected_failure_hit"] is False
    assert out["semantically_valid"] is True  # 小样例 AC，思路本身正确
    # 复杂度击杀口径 = semantically_valid AND expected_failure_hit => False


def test_tle_mutant_actual_tle_counts_as_complexity_kill():
    recs = [_rec("sample_1", Verdict.AC), _rec("t_max", Verdict.TLE)]
    out = slow_solution_semantics(recs, Verdict.TLE, small_test_ids={"sample_1"})
    assert out["expected_failure_hit"] is True
    assert out["semantically_valid"] is True
    assert out["semantically_valid"] and out["expected_failure_hit"]  # complexity kill


def test_invalid_slow_solution_not_counted_as_tle_mutant():
    """小规模上就 WA：这不是慢解，是错误解，不能计入 TLE 击杀。"""
    recs = [_rec("sample_1", Verdict.WA), _rec("t_max", Verdict.TLE)]
    out = slow_solution_semantics(recs, Verdict.TLE, small_test_ids={"sample_1"})
    assert out["semantically_valid"] is False
    assert out["expected_failure_hit"] is True
    # complexity kill 口径 => False
    assert not (out["semantically_valid"] and out["expected_failure_hit"])


def test_no_small_executions_means_invalid():
    """没有任何小规模执行记录时不能声称语义有效（无法证明答案正确）。"""
    recs = [_rec("t_max", Verdict.TLE)]
    out = slow_solution_semantics(recs, Verdict.TLE, small_test_ids={"sample_1"})
    assert out["semantically_valid"] is False


def test_mle_expected_verdict_is_preserved():
    """MLE 不再被降级成 WA：schema 与 role 映射都保留 MLE。"""
    item = WrongSolutionItem(code="int main(){ return 0; }", category="MLE", expected_verdict="MLE")
    assert item.expected_verdict == "MLE"
    assert _role_for(Verdict.MLE) == __import__("acmforge.domain.models", fromlist=["SolutionRole"]).SolutionRole.MLE


def test_parse_verdict_handles_manifest_shapes():
    # enum dump 形态（dict）与 str 形态都要能解析
    assert _parse_verdict({"value": "TLE"}) == Verdict.TLE
    assert _parse_verdict("MLE") == Verdict.MLE
    assert _parse_verdict(None) is None
    assert _parse_verdict("garbage") is None
