"""指标计算（Phase B/E）：从 run manifest 中提取 ProblemMetrics，不做任何推测。"""

from __future__ import annotations

import json
from typing import Any

from acmforge.eval.models import ProblemMetrics


def _llm_stats(ws) -> tuple[int, int | None, int | None]:
    """统计 llm_calls.jsonl：调用数与 token 总量（mock 无 usage 则为 None）。"""
    p = ws.logs_dir / "llm_calls.jsonl"
    if not p.is_file():
        return 0, None, None
    calls = 0
    prompt_tokens = 0
    completion_tokens = 0
    has_tokens = False
    with open(p, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue
            if rec.get("prompt_sha") or rec.get("output_sha"):
                calls += 1
            usage = rec.get("usage")
            if isinstance(usage, dict):
                has_tokens = True
                prompt_tokens += int(usage.get("prompt_tokens") or 0)
                completion_tokens += int(usage.get("completion_tokens") or 0)
    return calls, (prompt_tokens if has_tokens else None), (completion_tokens if has_tokens else None)


def compute_problem_metrics(
    problem,
    state: dict,
    manifests: dict[str, Any],
    ws,
    runtime_s: float,
    min_kill_rate: float = 0.95,
) -> ProblemMetrics:
    m = ProblemMetrics(
        problem_id=problem.problem_id,
        expected_difficulty=problem.expected_difficulty,
        expected_tags=list(problem.expected_tags),
        runtime_s=round(runtime_s, 1),
    )

    solutions = manifests.get("solutions") or {}
    fuzz = manifests.get("fuzz") or {}
    mutants = manifests.get("mutants") or {}
    km = manifests.get("kill_matrix") or {}
    selection = manifests.get("selection") or {}
    final = manifests.get("final_verify") or {}
    content = manifests.get("content") or {}
    review = manifests.get("review") or {}

    pipeline_success = state.get("status") == "completed"
    m.pipeline_success = pipeline_success
    m.failed_node = state.get("failed_node")

    # ---- STD ----
    m.std_generated = bool(solutions.get("std"))
    m.std_compile_success = bool(solutions.get("std", {}).get("compile", {}).get("ok"))
    m.brute_compile_success = bool(solutions.get("brute", {}).get("compile", {}).get("ok"))
    compile_repairs = int(solutions.get("std", {}).get("compile_repairs", 0) or 0)
    fuzz_attempts = int(fuzz.get("attempts", 0) or 0)
    m.std_repair_count = compile_repairs + fuzz_attempts
    fuzz_passed = pipeline_success and "differential_fuzz" in (state.get("nodes") or {}) and (
        state["nodes"]["differential_fuzz"]["status"] == "ok"
    )
    m.std_first_pass_correct = bool(
        fuzz_passed and m.std_repair_count == 0
    )
    m.std_final_correct = bool(
        fuzz_passed and not fuzz.get("sample_issues") and (pipeline_success or "final_verify" not in (state.get("nodes") or {}))
    )
    if pipeline_success:
        m.std_final_correct = True

    # ---- Differential ----
    m.differential_cases = int(fuzz.get("cases_run", 0) or 0)
    m.counterexample_count = len(fuzz.get("counterexamples", []) or [])
    m.differential_failures = m.counterexample_count

    # ---- Mutants（Phase E 质量指标）----
    mmetrics = mutants.get("metrics", {})
    total = int(mmetrics.get("total", 0) or 0)
    written = int(mmetrics.get("written", 0) or 0)
    m.mutants_generated = total
    compiled = sum(1 for c in mutants.get("candidates", []) if c.get("compile_ok"))
    m.mutants_compiled = compiled
    m.mutant_compile_rate = round(compiled / written, 4) if written else 0.0
    m.duplicate_mutant_rate = round(int(mmetrics.get("duplicates_dropped", 0) or 0) / total, 4) if total else 0.0
    m.mutant_kinds = mmetrics.get("kinds", {}) or {}

    final_summary = final.get("summary", {})
    m.mutants_killed = int(final_summary.get("mutant_killed", 0) or 0)
    m.kill_rate = float(final_summary.get("kill_rate", 0.0) or 0.0)
    survivors = max(compiled - m.mutants_killed, 0)
    m.meaningful_mutant_rate = round(m.mutants_killed / compiled, 4) if compiled else 0.0
    m.equivalent_mutant_rate = round(survivors / compiled, 4) if compiled else 0.0
    tle = final.get("tle_mutants", {})
    m.tle_mutants = int(tle.get("total", 0) or 0)
    m.tle_mutants_killed = len(tle.get("killed", []) or [])
    m.rounds = int(km.get("rounds", 0) or 0)

    # ---- Tests / Content ----
    m.selected_test_count = len(selection.get("selected_ids", []) or [])
    m.statement_review = bool(review.get("passed", False)) if review else bool(content.get("review_passed", False))
    m.editorial_review = m.statement_review  # v0.1 无独立 editorial 审校，随总体审题口径（如实标注）

    # ---- LLM ----
    calls, pt, ct = _llm_stats(ws)
    m.llm_call_count = calls
    m.prompt_tokens = pt
    m.completion_tokens = ct

    # ---- 失败分类（Phase C）----
    from acmforge.eval.failure_classifier import classify

    primary, secondaries = classify(state, manifests, min_kill_rate=min_kill_rate)
    m.failure_type = primary
    m.secondary_failures = secondaries
    if not pipeline_success and not primary:
        m.failure_type = "UNKNOWN"
    if primary:
        node = m.failed_node or ""
        m.failure_detail = str((state.get("nodes") or {}).get(node, {}).get("error") or "")[:500]

    return m
