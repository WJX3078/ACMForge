"""Survivor 闭环测试（Phase F）：等价变异体幸存 → SurvivorAnalyzer 定向分析 → 轮次记录可回溯。"""

import json
from pathlib import Path

import pytest
import yaml

from acmforge.eval.runner import run_eval

pytestmark = pytest.mark.usefixtures("gxx")

FIXTURE = Path(__file__).resolve().parents[1] / "fixtures" / "eval-survivor"


def _tmp_config(tmp_path: Path, min_kill_rate: float = 1.5) -> Path:
    """min_kill_rate=1.5 故意不可达：迫使 kill_matrix 走满轮次并触发 survivor 分析。"""
    cfg = {
        "workspace_dir": str(tmp_path / "workspace"),
        "llm": {"api_key": "", "api_key_env": "__NONE__"},
        "tests": {"min_kill_rate": min_kill_rate, "max_rounds": 2, "enforce_kill_rate": False},
    }
    p = tmp_path / "eval_config.yaml"
    p.write_text(yaml.safe_dump(cfg), encoding="utf-8")
    return p


def test_survivor_analysis_loop(tmp_path):
    out = tmp_path / "eval_out"
    summary = run_eval(
        FIXTURE,
        provider="mock",
        preset="smoke",
        config_path=_tmp_config(tmp_path),
        output_dir=out,
    )
    assert len(summary.problems) == 1
    m = summary.problems[0]

    # 流水线本身完成（kill rate 不达标只是 warning，因为 enforce=False）
    assert m.pipeline_success, m.failure_detail

    # 等价变异体必然幸存 => meaningful=0、equivalent=1
    assert m.mutants_killed < m.mutants_compiled
    assert m.equivalent_mutant_rate > 0
    assert "TESTS_TOO_WEAK" in m.secondary_failures

    # 轮次与 survivor 分析必须落盘、可回溯
    ws_root = tmp_path / "workspace"
    run_dirs = list(ws_root.glob("survivor-sum/runs/*"))
    assert run_dirs, "找不到 run 目录"
    state_file = run_dirs[0]
    km = json.loads((state_file / "kill_matrix.json").read_text(encoding="utf-8"))
    assert km["rounds"] == 2
    assert km["rounds_log"][0]["action"] == "survivor_analysis"
    assert km["rounds_log"][1]["action"] == "max_rounds_reached"
    analyses = km["rounds_log"][0]["analyses"]
    assert analyses and analyses[0]["target_mutant_id"] == "mutant_idea_reversed_sum"
    assert analyses[0]["mode"] == "small"

    # 定向策略固化进 test_plan（可回溯"为什么生成这个测试"）
    plan = json.loads((state_file / "test_plan.json").read_text(encoding="utf-8"))
    names = [s["name"] for s in plan["strategies"]]
    assert any(n.startswith("targeted_r1_") for n in names)

    # survivor 分析调用被追踪
    trace = (state_file / "logs" / "llm_calls.jsonl").read_text(encoding="utf-8")
    assert '"agent": "survivor"' in trace or '"agent":"survivor"' in trace
