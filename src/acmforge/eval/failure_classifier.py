"""失败分类器（Phase C）：把 pipeline 失败/质量问题归入 FailureType 体系。"""

from __future__ import annotations

from typing import Any

from acmforge.domain.models import FailureType


def _error_of(state: dict, node: str) -> str:
    return str((state.get("nodes") or {}).get(node, {}).get("error") or "")


def _match(error: str, *needles: str) -> bool:
    low = error.lower()
    return any(n.lower() in low for n in needles)


def classify(
    state: dict,
    manifests: dict[str, Any],
    min_kill_rate: float = 0.95,
) -> tuple[str | None, list[str]]:
    """返回 (primary_failure_type | None, secondary_failures)。

    - pipeline FAILED：primary 必有（按 failed_node 与错误文本归类）。
    - pipeline COMPLETED：primary=None，但质量问题以 secondary 形式如实记录。
    """
    secondaries: list[str] = []
    status = state.get("status")
    failed_node = state.get("failed_node")

    primary: FailureType | None = None
    if status == "failed" and failed_node:
        error = _error_of(state, failed_node)
        primary = _classify_failed_node(failed_node, error, manifests)

    # ---- 质量类 secondary（无论成败都检查）----
    try:
        final = manifests.get("final_verify") or {}
        summary = final.get("summary", {})
        kill_rate = summary.get("kill_rate", 1.0)
        if manifests.get("final_verify") is not None and kill_rate < min_kill_rate:
            secondaries.append(FailureType.TESTS_TOO_WEAK.value)
        tle = final.get("tle_mutants", {})
        if tle.get("total") and len(tle.get("killed", [])) < tle["total"]:
            secondaries.append(FailureType.TLE_SURVIVED.value)
        review = manifests.get("review") or {}
        if manifests.get("review") is not None and not review.get("passed", True):
            secondaries.append(FailureType.STATEMENT_MISMATCH.value)
        fuzz = manifests.get("fuzz") or {}
        if fuzz.get("mismatches", 0) > 0:
            secondaries.append(FailureType.STD_REPAIR_FAILED.value)
    except Exception:
        pass

    return (primary.value if primary else None), secondaries


def _classify_failed_node(node: str, error: str, manifests: dict[str, Any]) -> FailureType:
    if node == "load_spec":
        return FailureType.SPEC_INVALID

    if node == "prepare_solutions":
        if _match(error, "重试耗尽", "网络错误", "mockprovider 未配置", "http "):
            return FailureType.LLM_ERROR
        if _match(error, "结构化输出", "不是合法", "校验失败", "未找到 json"):
            return FailureType.LLM_PARSE_ERROR
        if _match(error, "gen.py 包含被禁止", "冒烟测试失败"):
            return FailureType.GENERATOR_ERROR
        return FailureType.SPEC_INVALID

    if node == "compile_solutions":
        if "brute" in error.lower():
            return FailureType.BRUTE_COMPILE_ERROR
        return FailureType.STD_COMPILE_ERROR

    if node == "differential_fuzz":
        if _match(error, "有效性门禁"):
            return FailureType.FUZZ_INVALID
        if _match(error, "fresh 语料验证失败", "holdout 语料验证失败"):
            return FailureType.STD_REPAIR_FAILED
        if _match(error, "oracle"):
            return FailureType.BRUTE_LOGIC_ERROR
        if _match(error, "超时"):
            return FailureType.BRUTE_TOO_SLOW
        if _match(error, "样例"):
            return FailureType.STD_LOGIC_ERROR
        fuzz = manifests.get("fuzz") or {}
        if fuzz.get("attempts", 0) > 0:
            return FailureType.STD_REPAIR_FAILED
        return FailureType.STD_LOGIC_ERROR

    if node == "generate_mutants":
        return FailureType.MUTANT_COMPILE_ERROR

    if node in ("design_tests", "generate_candidates"):
        return FailureType.TEST_GENERATION_ERROR

    if node in ("kill_matrix", "select_tests"):
        if _match(error, "没有任何可用的变异体"):
            return FailureType.MUTANT_COMPILE_ERROR
        if _match(error, "gen 失败"):
            return FailureType.TEST_GENERATION_ERROR
        return FailureType.TESTS_TOO_WEAK

    if node == "final_verify":
        final = manifests.get("final_verify") or {}
        tle = final.get("tle_mutants", {})
        if tle.get("total") and len(tle.get("killed", [])) < tle["total"]:
            return FailureType.TLE_SURVIVED
        if _match(error, "benchmark 中 std"):
            # std 自身超时/异常 —— 归因 solver 输出质量
            return FailureType.STD_LOGIC_ERROR
        if _match(error, "超过目标"):
            # std 用时余量不足 —— 同样是 solver 输出质量问题
            return FailureType.STD_LOGIC_ERROR
        if _match(error, "kill rate"):
            return FailureType.TESTS_TOO_WEAK
        return FailureType.UNKNOWN

    if node == "generate_content":
        if _match(error, "editorial"):
            return FailureType.EDITORIAL_MISMATCH
        return FailureType.STATEMENT_MISMATCH

    if node == "package":
        return FailureType.RUNNER_ERROR

    return FailureType.UNKNOWN
