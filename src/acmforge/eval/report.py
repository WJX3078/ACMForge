"""Eval 报告（Phase H）：summary.json / summary.md。"""

from __future__ import annotations

import json
from pathlib import Path

from acmforge.domain.models import FAILURE_OWNER, FailureType
from acmforge.eval.models import EvalSummary, ProblemMetrics


def _pct(part: int, total: int) -> str:
    return f"{part / total * 100:.0f}%" if total else "-"


def aggregate(problems: list[ProblemMetrics]) -> dict:
    n = len(problems)
    ok = [p for p in problems if p.pipeline_success]
    compiled = sum(p.mutants_compiled for p in problems)
    generated = sum(p.mutants_generated for p in problems)
    killed = sum(p.mutants_killed for p in problems)
    tle_total = sum(p.tle_mutants for p in problems)
    tle_killed = sum(p.tle_mutants_killed for p in problems)
    repair_total = sum(p.std_repair_count for p in problems)

    failure_counts: dict[str, int] = {}
    for p in problems:
        for f in ([p.failure_type] if p.failure_type else []) + p.secondary_failures:
            failure_counts[f] = failure_counts.get(f, 0) + 1

    return {
        "problem_count": n,
        "pipeline_success": sum(1 for p in ok),
        "std_generated": sum(1 for p in problems if p.std_generated),
        "std_compile": sum(1 for p in problems if p.std_compile_success),
        "std_first_pass_correct": sum(1 for p in problems if p.std_first_pass_correct),
        "std_final_correct": sum(1 for p in problems if p.std_final_correct),
        "avg_repair_attempts": round(repair_total / n, 2) if n else 0.0,
        "brute_compile": sum(1 for p in problems if p.brute_compile_success),
        "mutants_generated": generated,
        "mutants_compiled": compiled,
        "mutant_compile_rate": round(compiled / generated, 4) if generated else 0.0,
        "duplicate_mutant_rate": round(
            sum(round(p.duplicate_mutant_rate * p.mutants_generated) for p in problems) / generated, 4
        ) if generated else 0.0,
        "meaningful_mutant_rate": round(killed / compiled, 4) if compiled else 0.0,
        "equivalent_mutant_rate": round(max(compiled - killed, 0) / compiled, 4) if compiled else 0.0,
        "mutant_kill_rate": round(killed / max(compiled, 0) , 4) if compiled else 0.0,
        "tle_total": tle_total,
        "tle_killed": tle_killed,
        "tle_kill_rate": round(tle_killed / tle_total, 4) if tle_total else None,
        "avg_selected_tests": round(sum(p.selected_test_count for p in problems) / n, 1) if n else 0.0,
        "avg_runtime_s": round(sum(p.runtime_s for p in problems) / n, 1) if n else 0.0,
        "avg_llm_calls": round(sum(p.llm_call_count for p in problems) / n, 1) if n else 0.0,
        "total_prompt_tokens": sum(p.prompt_tokens or 0 for p in problems) or None,
        "total_completion_tokens": sum(p.completion_tokens or 0 for p in problems) or None,
        "failure_counts": failure_counts,
    }


def _top_failures(agg: dict, problems: list[ProblemMetrics]) -> list[dict]:
    """Top 5 失败原因：primary 计数优先，带 owner 与代表例。"""
    prim: dict[str, int] = {}
    example: dict[str, str] = {}
    for p in problems:
        if p.failure_type:
            prim[p.failure_type] = prim.get(p.failure_type, 0) + 1
            example.setdefault(p.failure_type, f"{p.problem_id}: {p.failure_detail[:120]}")
    ranked = sorted(prim.items(), key=lambda kv: -kv[1])[:5]
    return [
        {
            "failure_type": f,
            "count": c,
            "owner": FAILURE_OWNER.get(FailureType(f), "unknown"),
            "example": example[f],
        }
        for f, c in ranked
    ]


def _best_agent_to_optimize(agg: dict, problems: list[ProblemMetrics]) -> str:
    owner_scores: dict[str, int] = {}
    for p in problems:
        f = p.failure_type
        if not f:
            continue
        owner = FAILURE_OWNER.get(FailureType(f), "unknown")
        owner_scores[owner] = owner_scores.get(owner, 0) + 2
        for s in p.secondary_failures:
            o = FAILURE_OWNER.get(FailureType(s), "unknown")
            owner_scores[o] = owner_scores.get(o, 0) + 1
    if not owner_scores:
        return "（本次无失败归因 —— 可靠性瓶颈需更大样本）"
    return max(owner_scores.items(), key=lambda kv: kv[1])[0]


def render_markdown(summary: EvalSummary, agg: dict) -> str:
    n = agg["problem_count"]
    lines = [f"# ACMForge Eval Report — {summary.eval_id}", ""]
    lines.append(f"- Dataset: `{summary.dataset}`  Provider: `{summary.provider}`  Preset: `{summary.config.get('preset')}`")
    lines.append(f"- 时间: {summary.started_at} → {summary.finished_at}")
    lines.append("")

    def row(label: str, value: str) -> str:
        lines.append(f"{label:<26}{value}")

    row("Problems:", f"{n}")
    row("Pipeline success:", f"{agg['pipeline_success']}/{n} = {_pct(agg['pipeline_success'], n)}")
    row("STD compile:", f"{agg['std_compile']}/{n} = {_pct(agg['std_compile'], n)}")
    row("STD first-pass correct:", f"{agg['std_first_pass_correct']}/{n} = {_pct(agg['std_first_pass_correct'], n)}")
    row("STD final correct:", f"{agg['std_final_correct']}/{n} = {_pct(agg['std_final_correct'], n)}")
    lines.append("")
    row("Mutant compile:", f"{_pct(agg['mutants_compiled'], agg['mutants_generated'])} ({agg['mutants_compiled']}/{agg['mutants_generated']})")
    row("Duplicate mutants:", f"{agg['duplicate_mutant_rate'] * 100:.0f}%")
    row("Meaningful mutants:", f"{agg['meaningful_mutant_rate'] * 100:.0f}%")
    row("Mutant kill:", f"{agg['mutant_kill_rate'] * 100:.0f}%")
    if agg["tle_kill_rate"] is not None:
        row("TLE kill:", f"{agg['tle_kill_rate'] * 100:.0f}% ({agg['tle_killed']}/{agg['tle_total']})")
    lines.append("")
    row("Average repair attempts:", f"{agg['avg_repair_attempts']}")
    row("Average selected tests:", f"{agg['avg_selected_tests']}")
    row("Average runtime:", f"{agg['avg_runtime_s']}s")
    row("LLM calls/problem:", f"{agg['avg_llm_calls']}")
    if agg.get("total_prompt_tokens"):
        row("Total tokens:", f"prompt={agg['total_prompt_tokens']} completion={agg['total_completion_tokens']}")
    lines.append("")

    lines.append("## Failure distribution")
    lines.append("")
    lines.append("| FailureType | Count | Owner |")
    lines.append("|---|---|---|")
    for f, c in sorted(agg["failure_counts"].items(), key=lambda kv: -kv[1]):
        owner = FAILURE_OWNER.get(FailureType(f), "unknown") if f in FailureType.__members__ else "unknown"
        lines.append(f"| {f} | {c} | {owner} |")
    lines.append("")

    lines.append("## Top 5 failure causes")
    top = _top_failures(agg, summary.problems)
    if not top:
        lines.append("（无 pipeline 级失败）")
    for i, t in enumerate(top, 1):
        lines.append(f"{i}. **{t['failure_type']}** ×{t['count']}（owner: {t['owner']}）— 例：{t['example']}")
    lines.append("")
    lines.append("## 最值得优化的 Agent")
    lines.append("")
    lines.append(f"**{_best_agent_to_optimize(agg, summary.problems)}**")
    lines.append("")

    lines.append("## Per-problem")
    lines.append("")
    lines.append("| problem | difficulty | success | failure_type | std_repair | kill | tle_kill | tests | llm_calls | runtime |")
    lines.append("|---|---|---|---|---|---|---|---|---|---|")
    for p in summary.problems:
        lines.append(
            f"| {p.problem_id} | {p.expected_difficulty} | {'✓' if p.pipeline_success else '✗'} "
            f"| {p.failure_type or '-'} | {p.std_repair_count} | {p.kill_rate:.2f} "
            f"| {p.tle_mutants_killed}/{p.tle_mutants} | {p.selected_test_count} | {p.llm_call_count} | {p.runtime_s}s |"
        )
    lines.append("")
    lines.append("> 注：`equivalent_mutant_rate` 是幸存/已编译的代理指标（幸存 = 等价或测试不足，"
                 "survivor 分析结果见各 run 的 kill_matrix.jsonl rounds_log）。"
                 "`editorial_review` 目前与总体审题同口径（无独立题解审校）。")
    return "\n".join(lines)


def write_summary(out: Path, summary: EvalSummary) -> None:
    out.mkdir(parents=True, exist_ok=True)
    agg = aggregate(summary.problems)
    (out / "summary.json").write_text(
        json.dumps(
            {"summary": summary.model_dump(mode="json"), "aggregate": agg},
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
        newline="\n",
    )
    (out / "summary.md").write_text(render_markdown(summary, agg), encoding="utf-8", newline="\n")
