"""失败分类器单元测试（Phase C）。"""

from acmforge.eval.failure_classifier import classify


def _state(status, failed_node=None, error=""):
    nodes = {}
    if failed_node:
        nodes[failed_node] = {"status": "fail", "error": error}
    return {"status": status, "failed_node": failed_node, "nodes": nodes}


def test_completed_no_primary():
    primary, secondaries = classify(_state("completed"), {})
    assert primary is None
    assert secondaries == []


def test_spec_invalid():
    primary, _ = classify(_state("failed", "load_spec", "slug 不合法"), {})
    assert primary == "SPEC_INVALID"


def test_llm_error_vs_parse_error():
    primary, _ = classify(_state("failed", "prepare_solutions", "LLMError: 重试耗尽: 网络错误"), {})
    assert primary == "LLM_ERROR"
    primary, _ = classify(_state("failed", "prepare_solutions", "结构化输出在 3 次尝试后仍不合法"), {})
    assert primary == "LLM_PARSE_ERROR"


def test_compile_errors():
    primary, _ = classify(_state("failed", "compile_solutions", "std 编译失败"), {})
    assert primary == "STD_COMPILE_ERROR"
    primary, _ = classify(_state("failed", "compile_solutions", "brute 编译失败:\nerror"), {})
    assert primary == "BRUTE_COMPILE_ERROR"


def test_std_logic_vs_repair_failed():
    manifests = {"fuzz": {"attempts": 0}}
    primary, _ = classify(_state("failed", "differential_fuzz", "仍有 1 个反例"), manifests)
    assert primary == "STD_LOGIC_ERROR"
    manifests = {"fuzz": {"attempts": 3}}
    primary, _ = classify(_state("failed", "differential_fuzz", "仍未解决"), manifests)
    assert primary == "STD_REPAIR_FAILED"


def test_tests_too_weak_secondary_on_success():
    state = _state("completed")
    manifests = {
        "final_verify": {"summary": {"kill_rate": 0.6}, "tle_mutants": {"total": 1, "killed": ["m1"]}},
    }
    primary, secondaries = classify(state, manifests, min_kill_rate=0.95)
    assert primary is None  # pipeline 本身完成了
    assert "TESTS_TOO_WEAK" in secondaries  # 但 kill rate 不达标如实记录


def test_tle_survived_secondary():
    manifests = {
        "final_verify": {"summary": {"kill_rate": 1.0}, "tle_mutants": {"total": 2, "killed": ["m1"]}},
    }
    _, secondaries = classify(_state("completed"), manifests)
    assert "TLE_SURVIVED" in secondaries


def test_unknown_node():
    primary, _ = classify(_state("failed", "mystery_node", "boom"), {})
    assert primary == "UNKNOWN"
