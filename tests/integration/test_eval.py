"""Eval 框架集成测试（Phase B/G）：MockProvider 全链路，不依赖网络。"""

import json
from pathlib import Path

import pytest
import yaml

from acmforge.eval.runner import run_eval

pytestmark = pytest.mark.usefixtures("gxx")

DATASET = Path(__file__).resolve().parents[2] / "benchmarks" / "v1"


def _tmp_config(tmp_path: Path) -> Path:
    cfg = {
        "workspace_dir": str(tmp_path / "workspace"),
        "llm": {"api_key": "", "api_key_env": "__NONE__"},
    }
    p = tmp_path / "eval_config.yaml"
    p.write_text(yaml.safe_dump(cfg), encoding="utf-8")
    return p


def test_eval_mock_three_problems(tmp_path):
    """mock 模式跑 3 道题：流水线机制、指标统计、报告产出全链路验证。"""
    out = tmp_path / "eval_out"
    summary = run_eval(
        DATASET,
        provider="mock",
        limit=3,
        preset="smoke",
        config_path=_tmp_config(tmp_path),
        output_dir=out,
    )

    assert (out / "summary.json").is_file()
    assert (out / "summary.md").is_file()
    assert len(summary.problems) == 3

    ids = [p.problem_id for p in summary.problems]
    assert ids == ["array-sum", "binary-search-lowerbound", "interval-scheduling"]

    for m in summary.problems:
        assert m.pipeline_success, f"{m.problem_id} 应成功: {m.failed_node} {m.failure_detail}"
        assert m.std_compile_success
        assert m.brute_compile_success
        assert m.std_first_pass_correct, "mock 的 solver 一次写对 => repair=0"
        assert m.std_final_correct
        assert m.differential_failures == 0
        assert m.kill_rate >= 0.95, f"{m.problem_id} kill_rate={m.kill_rate}"
        assert m.selected_test_count >= 3  # 样例 + min/max
        assert m.statement_review
        assert m.llm_call_count > 0  # mock 调用同样被追踪
        assert m.runtime_s > 0

    # max-subarray 的 mock mutant 不在前 3 题；这里验证 mutant 指标来自真实执行
    agg = json.loads((out / "summary.json").read_text(encoding="utf-8"))["aggregate"]
    assert agg["pipeline_success"] == 3
    assert agg["problem_count"] == 3


def test_eval_mock_with_idea_mutants(tmp_path):
    """max-subarray-sum 带 mutant mock：两段式生成 + 去重 + 击杀指标。"""
    out = tmp_path / "eval_out2"
    summary = run_eval(
        DATASET,
        provider="mock",
        limit=4,  # array-sum, binary-search, interval, max-subarray
        preset="smoke",
        config_path=_tmp_config(tmp_path),
        output_dir=out,
    )
    m = {x.problem_id: x for x in summary.problems}["max-subarray-sum"]
    assert m.pipeline_success, m.failure_detail
    # 2 个 mock idea（同 code）=> 至少 1 个 LLM_IDEA_MUTANT + 1 个重复被丢弃
    assert m.mutant_kinds.get("LLM_IDEA_MUTANT", 0) >= 1
    assert m.duplicate_mutant_rate > 0
    assert m.mutants_compiled >= m.mutants_killed > 0
    assert m.kill_rate >= 0.95
    assert m.std_first_pass_correct
