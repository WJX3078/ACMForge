"""打包：最终题包（Polygon 风格目录布局）+ report.md + quality.json + zip。

dist/<slug>/
├── problem.yaml          元数据
├── statement.md          题面（样例答案由程序实测生成）
├── editorial.md          题解
├── solutions/std.cpp brute.cpp
├── gen/gen.py + gen_manifest.yaml
├── tests/1.in/1.ans ...
├── wrong/*.cpp + wrong_report.json
├── checker/README.md     默认精确匹配 checker 说明（SPJ 预留）
├── reports/kill_matrix.md
├── report.md             流水线总报告
└── quality.json          QualityReport
"""

from __future__ import annotations

import json
import shutil
import zipfile
from pathlib import Path

from acmforge.console import get_logger
from acmforge.domain.models import NodeResult, ProblemSpec
from acmforge.util import format_ms

logger = get_logger("acmforge.package")


def build_quality_report(ctx) -> dict:
    spec: ProblemSpec = ctx.spec
    fuzz = ctx.manifest("fuzz") or {}
    mutants = ctx.manifest("mutants") or {}
    final = ctx.manifest("final_verify") or {}
    bench = ctx.manifest("benchmark") or {}
    selection = ctx.manifest("selection") or {}
    review = {}
    review_path = ctx.ws.content_dir / "review.json"
    if review_path.is_file():
        review = json.loads(review_path.read_text(encoding="utf-8"))

    kill_rate = final.get("summary", {}).get("kill_rate", 0.0)
    tle = final.get("tle_mutants", {"total": 0, "killed": []})
    rsem = final.get("resource_semantics", {})
    benchmark_passed = bench.get("passed", False)
    compile_passed = solutions_compile(ctx)

    decision = "accept"
    warnings: list[str] = []
    if fuzz.get("mismatches", 1) != 0:
        decision = "reject"
    elif kill_rate < ctx.cfg.tests.min_kill_rate:
        warnings.append(f"kill rate {kill_rate} < 目标 {ctx.cfg.tests.min_kill_rate}")
        decision = "needs_review"
    elif not benchmark_passed:
        warnings.append("std 性能余量不足")
        decision = "needs_review"
    elif not review.get("passed", False):
        decision = "needs_review"

    return {
        "slug": spec.slug,
        "run_id": ctx.ws.run_id,
        "compile_passed": compile_passed,
        "differential_cases": fuzz.get("cases_run", 0),
        "differential_mismatches": fuzz.get("mismatches", 0),
        "counterexamples": len(fuzz.get("counterexamples", [])),
        "std_version": fuzz.get("std_version", ""),
        "mutant_total": final.get("summary", {}).get("mutant_total", mutants.get("total", 0)),
        "mutant_killed": final.get("summary", {}).get("mutant_killed", 0),
        "kill_rate": kill_rate,
        "tle_mutant_total": tle["total"],
        "tle_mutant_killed": len(tle["killed"]),
        "tle_semantically_valid": len(rsem.get("tle_semantically_valid", [])),
        "mle_candidates_total": rsem.get("mle_candidates_total", 0),
        "mle_actually_mled": len(rsem.get("mle_actually_mled", [])),
        "final_test_count": len(selection.get("selected_ids", [])),
        "std_max_ms": bench.get("std_max_ms", 0.0),
        "time_limit_ms": spec.limits.time_ms,
        "std_margin_ratio": bench.get("margin_ratio", 0.0),
        "benchmark_passed": benchmark_passed,
        "statement_review_passed": review.get("passed", False),
        "decision": decision,
        "warnings": warnings,
    }


def solutions_compile(ctx) -> bool:
    solutions = ctx.manifest("solutions") or {}
    return bool(solutions.get("std", {}).get("compile", {}).get("ok")) and bool(
        solutions.get("brute", {}).get("compile", {}).get("ok")
    )


def build_kill_matrix_report(ctx) -> str:
    final = ctx.manifest("final_verify") or {}
    bench = ctx.manifest("benchmark") or {}
    mutants = ctx.manifest("mutants") or {}
    candidates = {c["id"]: c for c in mutants.get("candidates", [])}

    lines = ["# 最终击杀矩阵（mutant × final tests）\n"]
    records = final.get("records", [])
    by_mutant: dict[str, list[dict]] = {}
    for r in records:
        by_mutant.setdefault(r["solution_id"], []).append(r)

    lines.append("| 错误解 | 类别 | 来源 | 预期 | 被杀测试数 | 击杀它的测试（前3） | 典型用时 |")
    lines.append("|---|---|---|---|---|---|---|")
    for mid in sorted(by_mutant):
        rows = by_mutant[mid]
        kills = [r for r in rows if r["killed"]]
        cand = candidates.get(mid, {})
        killing = ", ".join(k["testcase_id"] for k in kills[:3]) or "-"
        worst = max((k["runtime_ms"] for k in kills), default=0.0)
        lines.append(
            f"| {mid} | {cand.get('category', '')} "
            f"| {cand.get('origin', '')} | {cand.get('expected_verdict', '')} "
            f"| {len(kills)}/{len(rows)} | {killing} | {format_ms(worst)} |"
        )
    lines.append("")
    lines.append(
        f"**最终 kill rate：{final.get('summary', {}).get('kill_rate', 0):.2%}**"
        f"（{final.get('summary', {}).get('mutant_killed', 0)}/{final.get('summary', {}).get('mutant_total', 0)}）\n"
    )
    tle = final.get("tle_mutants", {})
    if tle.get("total"):
        lines.append(
            f"错误复杂度解（TLE 类）：{len(tle.get('killed', []))}/{tle['total']} 被时限卡掉。\n"
        )

    lines.append("## std 性能\n")
    points = bench.get("points", [])
    if points:
        lines.append("| 测试 | 中位用时 | 最大用时 | 内存 |")
        lines.append("|---|---|---|---|")
        for p in points:
            mem = f"{p['memory_kb'] / 1024:.1f} MB" if p.get("memory_kb") else "-"
            lines.append(
                f"| {p['testcase_id']} | {format_ms(p['median_ms'])} | {format_ms(p['max_ms'])} | {mem} |"
            )
        lines.append("")
        lines.append(
            f"std 最大用时 **{format_ms(bench.get('std_max_ms', 0))}** / 时限 {bench.get('time_limit_ms', 0)} ms"
            f"（占用 {bench.get('margin_ratio', 0) * 100:.1f}%）。\n"
        )
    return "\n".join(lines)


def build_main_report(ctx, quality: dict) -> str:
    spec = ctx.spec
    fuzz = ctx.manifest("fuzz") or {}
    selection = ctx.manifest("selection") or {}
    solutions = ctx.manifest("solutions") or {}

    lines = [f"# ACMForge 出题流水线报告：{spec.title}\n"]
    lines.append(f"- Run: `{ctx.ws.run_id}`（{spec.slug}）")
    lines.append(f"- 决策：**{quality['decision']}**")
    lines.append(
        f"- 对拍：{fuzz.get('cases_run', 0)} 组随机数据 + 全部样例，std 与 brute 完全一致；"
        f"修复轮次 {fuzz.get('attempts', 0)}"
    )
    lines.append(
        f"- 错误解：{quality['mutant_killed']}/{quality['mutant_total']} 被击杀"
        f"（kill rate {quality['kill_rate']:.2%}）；"
        f"错误复杂度解实际被 TLE 卡掉 {quality['tle_mutant_killed']}/{quality['tle_mutant_total']}"
        f"（语义有效 {quality.get('tle_semantically_valid', 0)}/{quality['tle_mutant_total']}）"
    )
    lines.append(
        f"- 最终测试集：{quality['final_test_count']} 组；std 最大用时 {format_ms(quality['std_max_ms'])}"
        f"（时限 {quality['time_limit_ms']} ms 的 {quality['std_margin_ratio'] * 100:.1f}%）"
    )
    lines.append(f"- 审题：{'通过' if quality['statement_review_passed'] else '存在问题，见 review.json'}")
    lines.append("")

    if quality["warnings"]:
        lines.append("## ⚠️ 警告\n")
        for w in quality["warnings"]:
            lines.append(f"- {w}")
        lines.append("")

    unkillable = selection.get("unkillable", [])
    if unkillable:
        lines.append("## 未被击杀的错误解\n")
        mutants = ctx.manifest("mutants") or {}
        cands = {c["id"]: c for c in mutants.get("candidates", [])}
        for mid in unkillable:
            c = cands.get(mid, {})
            lines.append(f"- **{mid}**：{c.get('description', '')}")
        lines.append("")

    lines.append("## 对拍与反例\n")
    ces = fuzz.get("counterexamples", [])
    if ces:
        for ce in ces:
            lines.append(f"- `counterexamples/{Path(ce['dir']).name if ce.get('dir') else ''}`：{ce.get('reason', '')}（shrunk={ce.get('shrunk')}）")
    else:
        lines.append("- 全程未发现不一致。")
    lines.append("")

    lines.append("## 解法清单\n")
    lines.append("| 组件 | 版本 | 来源 | 说明 |")
    lines.append("|---|---|---|---|")
    lines.append(
        f"| std | {solutions.get('std', {}).get('version', '')} | {solutions.get('std', {}).get('origin', '')} "
        f"| {solutions.get('std', {}).get('idea_summary', '')[:60]} |"
    )
    lines.append(
        f"| brute | {solutions.get('brute', {}).get('version', '')} | {solutions.get('brute', {}).get('origin', '')} "
        f"| {solutions.get('brute', {}).get('approach', '')[:60]} |"
    )
    lines.append(
        f"| gen | gen.py | {solutions.get('gen', {}).get('origin', '')} "
        f"| modes: {', '.join(solutions.get('gen', {}).get('modes', []))} |"
    )
    lines.append("")
    lines.append("详细击杀矩阵见 `reports/kill_matrix.md`。")
    return "\n".join(lines)


def node_package(ctx) -> NodeResult:
    result = NodeResult()
    spec = ctx.spec
    solutions = ctx.manifest("solutions") or {}
    selection = ctx.manifest("selection") or {}
    mutants = ctx.manifest("mutants") or {}
    final = ctx.manifest("final_verify") or {}

    pkg = ctx.ws.final_dir / spec.slug
    if pkg.exists():
        # 同一 run 内重新打包（如 --from package）：显式记录，绝不无声覆盖
        logger.warning("重新打包：替换已存在的 final 包 %s", pkg)
        result.warnings.append(f"重新打包：替换已存在的 final 包 {ctx.ws.rel(pkg)}")
        shutil.rmtree(pkg)
    (pkg / "solutions").mkdir(parents=True)
    (pkg / "gen").mkdir()
    (pkg / "tests").mkdir()
    (pkg / "wrong").mkdir()
    (pkg / "checker").mkdir()
    (pkg / "reports").mkdir()

    # problem.yaml（spec 快照）
    shutil.copyfile(ctx.ws.run_dir / "spec.yaml", pkg / "problem.yaml")

    # statement / editorial
    shutil.copyfile(ctx.ws.content_dir / "statement.md", pkg / "statement.md")
    shutil.copyfile(ctx.ws.content_dir / "editorial.md", pkg / "editorial.md")

    # solutions
    shutil.copyfile(ctx.ws.resolve(solutions["std"]["path"]), pkg / "solutions" / "std.cpp")
    shutil.copyfile(ctx.ws.resolve(solutions["brute"]["path"]), pkg / "solutions" / "brute.cpp")

    # gen
    shutil.copyfile(ctx.ws.resolve(solutions["gen"]["path"]), pkg / "gen" / "gen.py")
    gen_manifest = {
        "modes": solutions["gen"].get("modes", []),
        "strategy_count": len((ctx.manifest("test_plan") or {}).get("strategies", [])),
        "seed_base": ctx.cfg.fuzz.seed,
    }
    (pkg / "gen" / "gen_manifest.yaml").write_text(
        json.dumps(gen_manifest, ensure_ascii=False, indent=2), encoding="utf-8", newline="\n"
    )

    # tests（重命名为 1.in / 1.ans ... 并保留映射）
    mapping = {}
    for i, tid in enumerate(selection.get("selected_ids", []), 1):
        shutil.copyfile(ctx.ws.tests_dir / f"{tid}.in", pkg / "tests" / f"{i}.in")
        shutil.copyfile(ctx.ws.tests_dir / f"{tid}.ans", pkg / "tests" / f"{i}.ans")
        mapping[str(i)] = tid
    (pkg / "tests" / "mapping.json").write_text(
        json.dumps(mapping, ensure_ascii=False, indent=2), encoding="utf-8", newline="\n"
    )

    # wrong/
    wrong_rows = []
    cands = {c["id"]: c for c in mutants.get("candidates", [])}
    for mid in sorted(cands):
        c = cands[mid]
        if not c.get("enabled"):
            continue
        shutil.copyfile(ctx.ws.resolve(c["path"]), pkg / "wrong" / f"{mid}.cpp")
        kills = [
            r for r in final.get("records", []) if r["solution_id"] == mid and r["killed"]
        ]
        wrong_rows.append(
            {
                "id": mid,
                "category": str(c.get("category", "")),
                "origin": c.get("origin", ""),
                "description": c.get("description", ""),
                "expected_verdict": str(c.get("expected_verdict", "")),
                "killed": bool(kills),
                "killing_tests": [r["testcase_id"] for r in kills[:5]],
            }
        )
    (pkg / "wrong" / "wrong_report.json").write_text(
        json.dumps(wrong_rows, ensure_ascii=False, indent=2), encoding="utf-8", newline="\n"
    )

    # checker 说明（v0.1 默认精确匹配；SPJ 预留）
    (pkg / "checker" / "README.md").write_text(
        "# Checker\n\n"
        "v0.1 使用默认精确匹配 checker（token 级比较，数值支持 1e-6 容差）。\n\n"
        "SPJ / testlib checker 为预留扩展点：在 problem.yaml 中设置 checker: custom 后"
        "在 checker/ 下提供 checker.cpp（后续版本接入）。\n",
        encoding="utf-8",
        newline="\n",
    )

    # reports
    (pkg / "reports" / "kill_matrix.md").write_text(
        build_kill_matrix_report(ctx), encoding="utf-8", newline="\n"
    )

    # quality + report
    quality = build_quality_report(ctx)
    (pkg / "quality.json").write_text(
        json.dumps(quality, ensure_ascii=False, indent=2), encoding="utf-8", newline="\n"
    )
    (pkg / "report.md").write_text(build_main_report(ctx, quality), encoding="utf-8", newline="\n")

    # zip
    zip_path = ctx.ws.final_dir / f"{spec.slug}.zip"
    if zip_path.exists():
        zip_path.unlink()
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for p in sorted(pkg.rglob("*")):
            if p.is_file():
                zf.write(p, p.relative_to(ctx.ws.final_dir))

    for rel, typ in (
        ("statement.md", "statement"),
        ("editorial.md", "editorial"),
        ("report.md", "report"),
        ("quality.json", "report"),
    ):
        ctx.ws.record_artifact(pkg / rel, typ, "package")
    ctx.ws.record_artifact(zip_path, "package", "package")

    ctx.write_manifest("package", {"dir": ctx.ws.rel(pkg), "zip": ctx.ws.rel(zip_path), "quality": quality})
    result.metrics = {
        "package_dir": str(pkg),
        "zip": str(zip_path),
        "decision": quality["decision"],
    }
    if quality["decision"] == "needs_review":
        for w in quality["warnings"]:
            ctx.warn(result, w)
    return result
