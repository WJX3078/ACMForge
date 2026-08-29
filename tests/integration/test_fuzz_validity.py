"""P0-7/8/9 回归：fuzz 有效性门禁、mode coverage、fresh/holdout。"""

import json
from pathlib import Path

import pytest
import yaml

from acmforge.domain.models import FailureType
from acmforge.eval.runner import run_eval
from acmforge.fuzz.differential import build_fuzz_plan
from acmforge.config import FuzzConfig
from acmforge.validator import BuiltinValidator
from acmforge.domain.models import ProblemSpec

pytestmark = pytest.mark.usefixtures("gxx")

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures"


def _tmp_config(tmp_path: Path) -> Path:
    cfg = {
        "workspace_dir": str(tmp_path / "workspace"),
        "llm": {"api_key": "", "api_key_env": "__NONE__"},
    }
    p = tmp_path / "eval_config.yaml"
    p.write_text(yaml.safe_dump(cfg), encoding="utf-8")
    return p


def _run_fixture(name: str, tmp_path: Path):
    out = tmp_path / f"out_{name}"
    return run_eval(
        FIXTURES / f"eval-{name}",
        provider="mock",
        preset="smoke",
        config_path=_tmp_config(tmp_path),
        output_dir=out,
    ), out


def _run_dir(tmp_path: Path, slug: str) -> Path:
    run_dirs = list((tmp_path / "workspace").glob(f"{slug}/runs/*"))
    assert run_dirs
    return run_dirs[0]


def test_fuzz_fails_when_zero_valid_cases(tmp_path):
    """gen 产出的输入全部非法 => 有效 case 为 0 => 必须 FAIL（FUZZ_INVALID）。"""
    summary, _ = _run_fixture("invalid-gen", tmp_path)
    m = summary.problems[0]
    assert not m.pipeline_success
    assert m.failure_type == FailureType.FUZZ_INVALID.value
    assert "有效性门禁" in m.failure_detail


def test_fuzz_fails_when_oracle_crashes(tmp_path):
    """brute 全部 RE => oracle_errors > 上限 => FAIL，不得当成 correctness PASS。"""
    summary, _ = _run_fixture("bad-oracle", tmp_path)
    m = summary.problems[0]
    assert not m.pipeline_success
    assert m.failure_type == FailureType.FUZZ_INVALID.value
    assert "oracle" in m.failure_detail


def test_fuzz_fails_when_generator_failure_ratio_too_high(tmp_path):
    """gen 一半种子崩溃 => 有效占比 ~50% < 95% => FAIL。"""
    summary, _ = _run_fixture("flaky-gen", tmp_path)
    m = summary.problems[0]
    assert not m.pipeline_success
    assert m.failure_type == FailureType.FUZZ_INVALID.value

    run_dir = _run_dir(tmp_path, "flaky-sum")
    fuzz = json.loads((run_dir / "fuzz.json").read_text(encoding="utf-8"))
    assert fuzz["generator_errors"] > 0
    assert fuzz["cases_valid"] < fuzz["cases_requested"]
    assert fuzz["cases_run"] == fuzz["cases_valid"]  # 无效 case 不得计入


def test_invalid_generated_case_not_counted_as_fuzz_case(tmp_path):
    """validator 拒绝的输入不能出现在 cases_run / counterexample 中。"""
    summary, _ = _run_fixture("invalid-gen", tmp_path)
    run_dir = _run_dir(tmp_path, "invalid-sum")
    fuzz = json.loads((run_dir / "fuzz.json").read_text(encoding="utf-8"))
    assert fuzz["validator_errors"] > 0
    assert fuzz["cases_valid"] == 0
    assert fuzz["cases_run"] == 0
    assert fuzz["counterexamples"] == []


def test_mode_coverage_and_skip_reasons(tmp_path):
    """对抗模式必须进入对拍覆盖；不可缩小模式必须有显式 skip 理由。"""
    summary, _ = _run_fixture("invalid-gen", tmp_path)  # 借一个跑过的 fixture 结构无关性低，另测 plan 逻辑
    # build_fuzz_plan 的确定性单测：所有模式可覆盖时
    cfg = FuzzConfig(smoke_cases=30, small_n=10, seed=42, per_mode_cases=5)
    cases, skips = build_fuzz_plan(cfg, ["min", "small", "random", "all_neg", "max"], lambda m: m != "max")
    assert skips == {"max": skips["max"]} and "无法缩小" in skips["max"]
    per_mode_counts: dict[str, int] = {}
    for mode, _n, _s in cases:
        per_mode_counts[mode] = per_mode_counts.get(mode, 0) + 1
    for m in ("min", "small", "random", "all_neg"):
        assert per_mode_counts[m] >= 5, f"模式 {m} 覆盖不足"


def test_fresh_holdout_runs_after_repair(tmp_path):
    """repair 发生后必须追加 fresh + holdout 语料验证（repair-sum fixture 必然触发 repair）。"""
    summary, _ = _run_fixture("repair", tmp_path)
    assert summary.problems[0].pipeline_success
    run_dir = _run_dir(tmp_path, "repair-sum")
    fuzz = json.loads((run_dir / "fuzz.json").read_text(encoding="utf-8"))
    assert fuzz["attempts"] >= 1
    fh = fuzz["fresh_holdout"]
    assert fh is not None
    assert fh["fresh_cases"] > 0 and fh["fresh_mismatches"] == 0
    assert fh["holdout_cases"] > 0 and fh["holdout_mismatches"] == 0


def test_shrinker_rejects_invalid_candidate(tmp_path):
    """收缩候选只有通过 validator 后才可能被接受（复用节点内的谓词组合逻辑）。"""
    spec = ProblemSpec(
        slug="s", title="t", task="求和", input_format="n\na", output_format="s",
        samples=[{"input": "1\n1\n"}],
        constraints={"bounds": {"n": [1, 3], "value": [-10, 10]}},
    )
    validator = BuiltinValidator()

    calls: list[tuple[str, bool]] = []

    def fake_brute(text: str):
        vals = [int(t) for t in text.split()[1:]] if "\n" in text.strip() else [int(t) for t in text.split()[1:]]
        return json.dumps({"verdict": "AC", "stdout": str(sum(vals))})

    def still_bad(text: str) -> bool:
        vr = validator.validate(text, spec)
        if vr.status == "fail":
            calls.append((text, False))
            return False
        # brute 求和，std 恒返回 999 => 除全空外总是 mismatch
        vals = [int(t) for t in text.split()]
        brute_out = str(sum(vals[1:]) if len(vals) > 1 else 0)
        calls.append((text, brute_out != "999"))
        return brute_out != "999"

    from acmforge.fuzz.shrinker import shrink_input

    shrunk, improved, _ = shrink_input("3\n5\n", still_bad, max_evals=50)
    # 所有被 validator 拒绝的候选都不允许被接受为反例
    for text, accepted in calls:
        vr = validator.validate(text, spec)
        if vr.status == "fail":
            assert not accepted
    assert validator.validate(shrunk, spec).status != "fail"
