"""Eval 运行器：逐题构建独立 workspace 跑完整流水线，收集真实指标。"""

from __future__ import annotations

import time
from pathlib import Path

from acmforge.config import AppConfig, load_config
from acmforge.console import get_logger
from acmforge.eval.dataset import DatasetMockProvider, load_dataset
from acmforge.eval.models import EvalSummary, ProblemMetrics
from acmforge.eval.report import write_summary
from acmforge.util import now_iso
from acmforge.workflow import NodeContext, build_engine
from acmforge.workspace import Workspace

logger = get_logger("acmforge.eval")

_MANIFEST_NAMES = (
    "solutions",
    "fuzz",
    "mutants",
    "test_plan",
    "corpus",
    "kill_matrix",
    "selection",
    "final_verify",
    "benchmark",
    "content",
)

_PRESETS = {
    # eval 默认参数：比默认配置轻量，能在一台开发机上 10 题内跑完
    "standard": {"fuzz.smoke_cases": 150, "fuzz.small_n": 30, "fuzz.per_mode_cases": 10,
                 "fuzz.fresh_cases_after_repair": 60, "fuzz.holdout_cases_after_repair": 40,
                 "tests.candidate_batch": 12,
                 "tests.per_mutant_eval_budget": 25, "benchmark.repeats": 2, "benchmark.warmup": 0},
    "smoke": {"fuzz.smoke_cases": 40, "fuzz.small_n": 12, "fuzz.per_mode_cases": 4,
              "fuzz.fresh_cases_after_repair": 15, "fuzz.holdout_cases_after_repair": 15,
              "tests.candidate_batch": 8,
              "tests.per_mutant_eval_budget": 18, "benchmark.repeats": 1, "benchmark.warmup": 0},
}


def _apply_preset(cfg: AppConfig, preset: str) -> AppConfig:
    for key, value in _PRESETS.get(preset, {}).items():
        section, field = key.split(".")
        setattr(getattr(cfg, section), field, value)
    return cfg


def _collect_manifests(ws) -> dict:
    import json

    manifests = {}
    for name in _MANIFEST_NAMES:
        data = ws.read_manifest(name)
        if data is not None:
            manifests[name] = data
    review_path = ws.content_dir / "review.json"
    if review_path.is_file():
        manifests["review"] = json.loads(review_path.read_text(encoding="utf-8"))
    return manifests


def run_eval(
    dataset_root: Path,
    provider: str = "auto",
    limit: int | None = None,
    preset: str = "standard",
    config_path: Path | None = None,
    output_dir: Path | None = None,
) -> EvalSummary:
    from acmforge.eval.metrics import compute_problem_metrics

    cfg = _apply_preset(load_config(config_path), preset)

    if provider not in ("auto", "llm", "mock"):
        raise ValueError(f"未知 provider: {provider}")
    provider_mode = provider
    if provider_mode == "auto":
        provider_mode = "llm" if cfg.llm.is_enabled() else "mock"

    problems = load_dataset(Path(dataset_root))
    if limit:
        problems = problems[:limit]

    import secrets

    eval_id = time.strftime("%Y%m%d-%H%M%S") + "-" + secrets.token_hex(2)
    out = Path(output_dir) if output_dir else Path("evals") / eval_id
    out.mkdir(parents=True, exist_ok=True)

    summary = EvalSummary(
        eval_id=eval_id,
        dataset=str(dataset_root),
        provider=provider_mode,
        config={
            "preset": preset,
            "fuzz": cfg.fuzz.model_dump(),
            "tests": cfg.tests.model_dump(),
            "mutants": cfg.mutants.model_dump(),
            "benchmark": cfg.benchmark.model_dump(),
        },
        started_at=now_iso(),
    )

    llm_provider = None
    if provider_mode == "llm":
        from acmforge.llm.provider import OpenAICompatProvider

        llm_provider = OpenAICompatProvider(cfg.llm, cfg.llm.resolve_api_key())

    for problem in problems:
        logger.info("=== eval problem: %s (%s) ===", problem.problem_id, problem.expected_difficulty)
        problem_provider = llm_provider
        cfg_p = cfg.model_copy(deep=True)

        if provider_mode == "mock":
            if problem.mock_path is None:
                m = ProblemMetrics(problem_id=problem.problem_id, expected_difficulty=problem.expected_difficulty)
                m.failure_type = "LLM_ERROR"
                m.failure_detail = "mock 模式且题目无 mock 目录，跳过"
                summary.problems.append(m)
                continue
            problem_provider = DatasetMockProvider(problem)
            # 无 mutant mock 的题在 mock 模式下退化为纯源码变异（如实记录）
            if not (problem.mock_path / "mutant_ideas.json").is_file():
                cfg_p.mutants.llm_count = 0

        ws = Workspace.create(Path(cfg_p.workspace_dir), problem.spec.slug)
        ctx = NodeContext(
            cfg_p,
            problem.spec,
            Path(problem.spec_path),
            ws,
            problem_provider,
            base_dir=Path(problem.spec_path).parent,
        )
        engine = build_engine(ctx)

        started = time.perf_counter()
        engine.run()
        runtime_s = time.perf_counter() - started

        state = ws.read_state() or {"status": "unknown"}
        manifests = _collect_manifests(ws)
        metrics = compute_problem_metrics(
            problem, state, manifests, ws, runtime_s, min_kill_rate=cfg_p.tests.min_kill_rate
        )
        summary.problems.append(metrics)
        write_problem_artifacts(out, metrics, state, manifests, ws)

    summary.finished_at = now_iso()
    write_summary(out, summary)
    return summary


def write_problem_artifacts(out: Path, metrics, state: dict, manifests: dict, ws) -> None:
    import json

    problems_dir = out / "problems"
    problems_dir.mkdir(parents=True, exist_ok=True)
    (problems_dir / f"{metrics.problem_id}.json").write_text(
        json.dumps(metrics.model_dump(), ensure_ascii=False, indent=2), encoding="utf-8", newline="\n"
    )
    if not metrics.pipeline_success:
        failures_dir = out / "failures"
        failures_dir.mkdir(parents=True, exist_ok=True)
        node = metrics.failed_node or "?"
        lines = [
            f"# FAILURE: {metrics.problem_id}",
            "",
            f"- failed_node: `{node}`",
            f"- failure_type: `{metrics.failure_type}`",
            f"- detail: {metrics.failure_detail}",
            "",
            "## 各节点状态",
        ]
        for name, node_state in (state.get("nodes") or {}).items():
            lines.append(f"- {name}: {node_state.get('status')} {node_state.get('metrics') or ''}")
        if manifests.get("fuzz", {}).get("counterexamples"):
            lines.append("")
            lines.append("## Counterexamples")
            for ce in manifests["fuzz"]["counterexamples"]:
                lines.append(f"- ce_{ce.get('index')}: {ce.get('reason')} (seed={ce.get('seed')})")
        (failures_dir / f"{metrics.problem_id}.md").write_text(
            "\n".join(lines) + "\n", encoding="utf-8", newline="\n"
        )
