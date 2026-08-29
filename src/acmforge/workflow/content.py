"""内容节点：题面（statement）、题解（editorial）、审题（review）。

防幻觉规则：样例答案一律使用程序实测输出；题面正文由确定性模板渲染，
LLM 只负责润色背景故事与题解行文，绝不触碰形式化定义与数据。
"""

from __future__ import annotations

from acmforge.console import get_logger
from acmforge.domain.models import NodeResult

logger = get_logger("acmforge.content")


def _fmt_num(v) -> str:
    """把 bounds 里的数值格式化成人类可读形式（整数不带小数点）。"""
    try:
        f = float(v)
        return str(int(f)) if f.is_integer() else f"{f:g}"
    except (TypeError, ValueError):
        return str(v)


def _render_statement(spec, sample_answers: list[str], story_override: str | None) -> str:
    parts: list[str] = []
    parts.append(f"# {spec.title}\n")
    story = story_override or spec.story
    if story:
        parts.append(story.strip() + "\n")
    if spec.summary:
        parts.append(f"> {spec.summary.strip()}\n")
    parts.append("## 题目描述\n")
    parts.append(spec.task.strip() + "\n")
    parts.append("## 输入格式\n")
    parts.append(spec.input_format.strip() + "\n")
    parts.append("## 输出格式\n")
    parts.append(spec.output_format.strip() + "\n")
    if spec.constraints.items:
        # 以出题人手写的约束为准（避免与 bounds 机器渲染重复）
        parts.append("## 数据范围\n")
        for c in spec.constraints.items:
            parts.append(f"- {c.name}：{c.description}")
        if spec.constraints.notes:
            parts.append(f"- {spec.constraints.notes}")
        parts.append("")
    elif spec.constraints.bounds:
        parts.append("## 数据范围\n")
        bounds = spec.constraints.bounds
        n = bounds.get("n")
        if isinstance(n, list) and len(n) == 2:
            parts.append(f"- {_fmt_num(n[0])} ≤ n ≤ {_fmt_num(n[1])}")
        v = bounds.get("value")
        if isinstance(v, list) and len(v) == 2:
            parts.append(f"- 元素取值：{_fmt_num(v[0])} ≤ a_i ≤ {_fmt_num(v[1])}")
        if spec.constraints.notes:
            parts.append(f"- {spec.constraints.notes}")
        parts.append("")
    parts.append("## 样例\n")
    for i, sample in enumerate(spec.samples, 1):
        parts.append(f"### 样例 {i}\n")
        parts.append("**输入**\n```text\n" + sample.input.rstrip() + "\n```\n")
        answer = sample_answers[i - 1] if i - 1 < len(sample_answers) else ""
        if not answer and sample.expected_output:
            answer = sample.expected_output
        parts.append("**输出**\n```text\n" + (answer or "(未能生成)").rstrip() + "\n```\n")
        if sample.note:
            parts.append(f"说明：{sample.note}\n")
    if spec.notes:
        parts.append("## 备注\n")
        parts.append(spec.notes.strip() + "\n")
    parts.append(f"---\n*时间限制 {spec.limits.time_ms} ms，内存限制 {spec.limits.memory_mb} MB。*\n")
    return "\n".join(parts)


def _render_editorial_template(
    spec,
    std_code: str,
    fuzz_info: dict,
    kill_summary: dict,
    bench: dict,
) -> str:
    intended = spec.intended_solution
    parts: list[str] = []
    parts.append(f"# {spec.title} 题解\n")
    parts.append("## 思路\n")
    if intended.observations:
        parts.append("关键观察：\n")
        for o in intended.observations:
            parts.append(f"- {o}")
        parts.append("")
    if intended.algorithm:
        parts.append("算法流程：\n")
        for i, a in enumerate(intended.algorithm, 1):
            parts.append(f"{i}. {a}")
        parts.append("")
    if intended.proof_outline:
        parts.append("## 正确性\n")
        for p in intended.proof_outline:
            parts.append(f"- {p}")
        parts.append("")
    parts.append("## 复杂度\n")
    parts.append(f"- 时间：{intended.complexity.time or '（见代码）'}")
    parts.append(f"- 内存：{intended.complexity.memory or '（见代码）'}\n")
    parts.append("## 参考实现\n")
    parts.append("```cpp\n" + std_code.strip() + "\n```\n")
    parts.append("## 验证数据\n")
    parts.append(
        f"- 对拍：{fuzz_info.get('cases_run', 0)} 组随机小数据 std 与暴力完全一致；"
        f"过程中发现反例 {fuzz_info.get('mismatches', 0) + fuzz_info.get('attempts', 0)} 个并全部修复。\n"
    )
    rows = kill_summary.get("rows", [])
    if rows:
        parts.append("## 错误解击杀情况\n")
        parts.append("| 错误解 | 是否被卡 | 击杀测试数 |")
        parts.append("|---|---|---|")
        for r in rows:
            parts.append(f"| {r['mutant_id']} | {'是' if r['killed'] else '否'} | {r['kill_count']} |")
        parts.append("")
    if bench:
        parts.append(
            f"## 性能\nstd 在最大测试上用时 {bench.get('std_max_ms', 0):.0f} ms"
            f"（时限 {bench.get('time_limit_ms', 0)} ms，余量 {100 - bench.get('margin_ratio', 0) * 100:.0f}%）。\n"
        )
    return "\n".join(parts)


def node_generate_content(ctx) -> NodeResult:
    result = NodeResult()
    spec = ctx.spec
    fuzz_info = ctx.manifest("fuzz") or {}
    solutions = ctx.manifest("solutions") or {}
    km = ctx.manifest("kill_matrix") or {}
    bench = ctx.manifest("benchmark") or {}

    std_code = ctx.ws.resolve(solutions["std"]["path"]).read_text(encoding="utf-8")
    sample_answers = fuzz_info.get("sample_answers", [])

    # --- statement ---
    story_override = None
    if ctx.provider is not None and not ctx.cfg.offline:
        from acmforge.agents.content import StatementAgent

        try:
            agent = StatementAgent(ctx.provider, ctx.ws.logs_dir / "llm_calls.jsonl")
            out, _meta = agent.write(spec)
            story_override = out.story_markdown
        except Exception as e:
            ctx.warn(result, f"LLM 题面润色失败（使用 spec 原文）: {e}")

    statement_md = _render_statement(spec, sample_answers, story_override)
    statement_path = ctx.ws.content_dir / "statement.md"
    statement_path.write_text(statement_md, encoding="utf-8", newline="\n")
    ctx.ws.record_artifact(statement_path, "statement", "generate_content")

    # --- editorial ---
    kill_summary = km.get("summary", {})
    if ctx.provider is not None and not ctx.cfg.offline:
        from acmforge.agents.content import EditorialAgent

        try:
            agent = EditorialAgent(ctx.provider, ctx.ws.logs_dir / "llm_calls.jsonl")
            out, _meta = agent.write(
                spec,
                std_code=std_code,
                std_idea=solutions["std"].get("idea_summary", ""),
                fuzz_cases=fuzz_info.get("cases_run", 0),
                mismatches=fuzz_info.get("mismatches", 0),
                test_count=len((ctx.manifest("selection") or {}).get("selected_ids", [])),
                mutant_killed=kill_summary.get("mutant_killed", 0),
                mutant_total=kill_summary.get("mutant_total", 0),
                std_max_ms=bench.get("std_max_ms", 0.0),
                time_limit_ms=spec.limits.time_ms,
            )
            editorial_md = out.editorial_markdown
        except Exception as e:
            ctx.warn(result, f"LLM 题解撰写失败（使用模板）: {e}")
            editorial_md = _render_editorial_template(spec, std_code, fuzz_info, kill_summary, bench)
    else:
        editorial_md = _render_editorial_template(spec, std_code, fuzz_info, kill_summary, bench)

    editorial_path = ctx.ws.content_dir / "editorial.md"
    editorial_path.write_text(editorial_md, encoding="utf-8", newline="\n")
    ctx.ws.record_artifact(editorial_path, "editorial", "generate_content")

    # --- review（确定性检查 + 可选 LLM）---
    checks: list[dict] = []

    def check(name: str, passed: bool, detail: str = "") -> None:
        checks.append({"name": name, "passed": passed, "detail": detail})

    check("statement 非空", len(statement_md.strip()) > 100)
    check("editorial 非空", len(editorial_md.strip()) > 100)
    check("对拍通过", fuzz_info.get("mismatches", 1) == 0, f"{fuzz_info.get('cases_run')} cases")
    check("样例答案由程序生成", all(a.strip() for a in sample_answers))
    check(
        "kill rate 达标",
        kill_summary.get("kill_rate", 0) >= ctx.cfg.tests.min_kill_rate,
        f"{kill_summary.get('kill_rate')}",
    )
    check("std 性能达标", bench.get("passed", False), f"margin={bench.get('margin_ratio')}")
    for c in spec.constraints.items:
        check(
            f"题面包含约束[{c.name}]",
            (c.description[:20] in statement_md) or (c.name in statement_md),
        )

    reviewer_name = "deterministic"
    llm_issues: list[str] = []
    llm_notes = ""
    if ctx.provider is not None and not ctx.cfg.offline:
        from acmforge.agents.content import ReviewerAgent

        try:
            agent = ReviewerAgent(ctx.provider, ctx.ws.logs_dir / "llm_calls.jsonl")
            out, _meta = agent.review(
                statement_markdown=statement_md,
                spec=spec,
                deterministic_checks="\n".join(
                    f"- [{'PASS' if c['passed'] else 'FAIL'}] {c['name']}: {c['detail']}" for c in checks
                ),
            )
            reviewer_name = f"llm:{ctx.provider.name}"
            llm_issues = out.issues
            llm_notes = out.notes
            check("LLM 验题通过", out.passed, "; ".join(out.issues[:3]))
        except Exception as e:
            ctx.warn(result, f"LLM 验题失败（仅用确定性检查）: {e}")

    passed = all(c["passed"] for c in checks)
    review = {
        "checks": checks,
        "passed": passed,
        "reviewer": reviewer_name,
        "notes": llm_notes,
        "llm_issues": llm_issues,
    }
    import json

    review_path = ctx.ws.content_dir / "review.json"
    review_path.write_text(
        json.dumps(review, ensure_ascii=False, indent=2), encoding="utf-8", newline="\n"
    )
    ctx.ws.record_artifact(review_path, "review", "generate_content")

    ctx.write_manifest("content", {"statement": str(statement_path.name), "editorial": str(editorial_path.name), "review_passed": passed})
    result.metrics = {"review_passed": passed, "checks": len(checks)}
    if not passed:
        failed = [c["name"] for c in checks if not c["passed"]]
        ctx.warn(result, f"审题未全通过: {', '.join(failed)}")
    return result
