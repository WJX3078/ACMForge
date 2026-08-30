"""P0-10/P0-12 回归：kill matrix 去重与 target_mutants 调度。"""

import json
from pathlib import Path

import pytest
import yaml

from acmforge.eval.runner import run_eval
from acmforge.workflow.nodes import order_candidates_for_mutant
from acmforge.domain.models import TestCaseRecord as _TCR  # 避免 pytest 收集 Test* 类

pytestmark = pytest.mark.usefixtures("gxx")

FIXTURE = Path(__file__).resolve().parents[1] / "fixtures" / "eval-survivor"


def _tmp_config(tmp_path: Path) -> Path:
    cfg = {
        "workspace_dir": str(tmp_path / "workspace"),
        "llm": {"api_key": "", "api_key_env": "__NONE__"},
        # min_kill_rate 不可达 => 强制跑满 2 轮 => 触发跨轮重复评估场景
        "tests": {"min_kill_rate": 1.5, "max_rounds": 2, "enforce_kill_rate": False},
    }
    p = tmp_path / "eval_config.yaml"
    p.write_text(yaml.safe_dump(cfg), encoding="utf-8")
    return p


def test_kill_records_unique_per_pair(tmp_path):
    out = tmp_path / "eval_out"
    summary = run_eval(
        FIXTURE, provider="mock", preset="smoke",
        config_path=_tmp_config(tmp_path), output_dir=out,
    )
    assert summary.problems[0].pipeline_success
    run_dir = next((tmp_path / "workspace").glob("survivor-sum/runs/*"))
    km = json.loads((run_dir / "kill_matrix.json").read_text(encoding="utf-8"))
    records = km["records"]
    pairs = [(r["testcase_id"], r["solution_id"]) for r in records]
    assert len(pairs) == len(set(pairs)), "kill matrix 存在重复 (testcase, mutant) 记录"
    # 多轮场景下第 2 轮新增的定向测试确实被评估过（增量而非全量重跑）
    assert km["rounds"] == 2
    new_tests = {p[0] for p in pairs if p[0].startswith("r1_")}
    assert new_tests, "round 2 新增候选未被评估"


def test_ordering_prefers_targeted_strategies():
    t_lo = _TCR(id="a", strategy="random_small", mode="random", seed=1,
                          input_path="x", answer_path="y", priority=100, size_bytes=999999)
    t_target = _TCR(id="b", strategy="targeted_r1_m1", mode="all_neg", seed=2,
                              input_path="x", answer_path="y", priority=10, size_bytes=10)
    ordered = order_candidates_for_mutant([t_lo, t_target], expected_tle=False,
                                          targeted_strategies={"targeted_r1_m1"})
    assert ordered[0].id == "b", "定向策略的测试必须最优先评估"
    # 无定向信息时保持原行为（优先级优先）
    ordered2 = order_candidates_for_mutant([t_lo, t_target], expected_tle=False)
    assert ordered2[0].id == "a"


def test_target_mutant_ids_reach_test_designer_prompt():
    """TestDesigner 的 prompt 必须包含真实 mutant id，否则无法引用。"""
    from acmforge.prompts import render_prompt

    system, user = render_prompt(
        "test_designer",
        {
            "slug": "s", "title": "t", "summary": "", "story": "", "task": "求和",
            "input_format": "n", "output_format": "s",
            "constraints_items": [], "bounds": {},
            "limits": {"time_ms": 1000, "memory_mb": 256},
            "intended": {"observations": [], "algorithm": [], "proof_outline": [],
                         "complexity": {"time": "", "memory": ""}},
            "samples": [], "notes": "",
            "modes": "min, small",
            "mutants": [
                {"id": "mutant_idea_reversed_sum", "category": "IMPLEMENTATION_BUG",
                 "description": "逆向累加", "expected_verdict": "WA", "origin": "llm"},
            ],
        },
    )
    assert "mutant_idea_reversed_sum" in user
    assert "target_mutants" in user
