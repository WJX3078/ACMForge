from acmforge.domain.models import KillRecord, Verdict
from acmforge.selection import greedy_select, is_kill, summarize_kill_matrix


def _rec(test: str, mutant: str, killed: bool) -> KillRecord:
    return KillRecord(
        testcase_id=test,
        solution_id=mutant,
        verdict=Verdict.WA if killed else Verdict.AC,
        killed=killed,
    )


def test_is_kill():
    assert is_kill(Verdict.WA)
    assert is_kill(Verdict.TLE)
    assert is_kill(Verdict.RE)
    assert not is_kill(Verdict.AC)


def test_greedy_select_covers_all():
    records = [
        _rec("t1", "m1", True),
        _rec("t2", "m1", True),
        _rec("t2", "m2", True),
        _rec("t3", "m3", True),
        _rec("t1", "m2", False),
        _rec("t3", "m1", False),
    ]
    sel = greedy_select(records, ["m1", "m2", "m3"], must_include=[])
    # 贪心：先选新增击杀最多的 t2（m1+m2），再选 t3（m3）；t1 无新增不选
    assert set(sel.selected_ids) == {"t2", "t3"}
    assert sel.kill_rate == 1.0
    assert sel.unkillable == []


def test_greedy_select_minimal_set():
    # t_all 杀掉所有 mutant，应该只选它 + must_include
    records = [
        _rec("t_all", "m1", True),
        _rec("t_all", "m2", True),
        _rec("t_one", "m1", True),
    ]
    sel = greedy_select(records, ["m1", "m2"], must_include=[])
    assert sel.selected_ids == ["t_all"]
    assert sel.kill_rate == 1.0


def test_must_include_always_selected():
    records = [_rec("t_edge", "m1", False), _rec("t_killer", "m1", True)]
    sel = greedy_select(records, ["m1"], must_include=["t_edge"])
    assert "t_edge" in sel.selected_ids
    assert "t_killer" in sel.selected_ids


def test_unkillable_reported():
    records = [_rec("t1", "m1", True)]
    sel = greedy_select(records, ["m1", "m_equiv"], must_include=[])
    assert "m_equiv" in sel.unkillable
    assert sel.kill_rate == 0.5


def test_empty_mutants():
    sel = greedy_select([], [], must_include=["t1"])
    assert sel.kill_rate == 1.0
    assert sel.selected_ids == ["t1"]


def test_summary():
    records = [
        _rec("t1", "m1", True),
        _rec("t2", "m1", True),
        _rec("t1", "m2", False),
    ]
    s = summarize_kill_matrix(records, ["m1", "m2"])
    assert s["mutant_total"] == 2
    assert s["mutant_killed"] == 1
    assert s["kill_rate"] == 0.5
    rows = {r["mutant_id"]: r for r in s["rows"]}
    assert rows["m1"]["kill_count"] == 2
    assert not rows["m2"]["killed"]
