"""P0-13 回归：resume 必须使用 run 创建时的配置快照。"""

import json
from pathlib import Path

import pytest
import yaml
from typer.testing import CliRunner as TyperCliRunner

from acmforge.cli import app

pytestmark = pytest.mark.usefixtures("gxx")

EXAMPLE = Path(__file__).resolve().parents[2] / "examples" / "max-subarray-sum" / "problem.yaml"


def _config(tmp_path: Path, seed: int) -> Path:
    cfg = {
        "workspace_dir": str(tmp_path / "workspace"),
        "llm": {"api_key": "", "api_key_env": "__NONE__"},
        "fuzz": {"smoke_cases": 20, "small_n": 12, "per_mode_cases": 3, "seed": seed},
        "tests": {"candidate_batch": 6, "per_mutant_eval_budget": 15},
        "benchmark": {"repeats": 1, "warmup": 0},
    }
    p = tmp_path / f"cfg_{seed}.yaml"
    p.write_text(yaml.safe_dump(cfg), encoding="utf-8")
    return p


def _corpus_shas(run_dir: Path) -> set:
    corpus = json.loads((run_dir / "corpus.json").read_text(encoding="utf-8"))
    return {r["input_sha256"] for r in corpus["records"]}


@pytest.fixture()
def partial_run(tmp_path):
    """用 seed=42 的配置跑到 design_tests，留下一个可续跑的 run。"""
    cfg = _config(tmp_path, seed=42)
    r = TyperCliRunner().invoke(
        app, ["run", str(EXAMPLE), "--offline", "--smoke", "--config", str(cfg), "--until", "design_tests"]
    )
    assert r.exit_code == 0, r.output
    run_dirs = list((tmp_path / "workspace").glob("max-subarray-sum/runs/*"))
    assert run_dirs
    return tmp_path, cfg, run_dirs[0]


def test_resume_uses_snapshotted_config(tmp_path, partial_run):
    """当前配置 seed 改成 99 后 resume：语料必须仍按快照 seed=42 生成。"""
    tmp_path, cfg42, run_dir = partial_run
    cfg99 = _config(tmp_path, seed=99)

    # 发现 run 用 cfg99（workspace 相同）；resume 必须无视它的 seed=99
    r = TyperCliRunner().invoke(
        app, ["resume", run_dir.name],
        env={"ACMFORGE_CONFIG": str(cfg99)},
    )
    assert r.exit_code == 0, r.output
    assert "配置快照" in r.output

    shas = _corpus_shas(run_dir)
    assert shas, "resume 后语料为空"

    # seed 溯源：语料 fill 种子 = fuzz.seed + 1_000_000 + i。
    # 快照 seed=42 → 1_000_042..；当前配置 seed=99 → 1_000_099..
    corpus = json.loads((run_dir / "corpus.json").read_text(encoding="utf-8"))
    seeds = [r["seed"] for r in corpus["records"]]
    assert any(1_000_042 <= sd < 1_000_099 for sd in seeds), "快照 seed=42 派生的语料缺失"
    assert not any(42 <= sd <= 81 for sd in seeds), "出现了裸 seed（不可能来自语料生成器）"
    # 99 派生区间与 42 派生区间在 1_000_099..1_000_140 重叠，因此只断言"存在 42 独占区间"


def _reference_corpus(tmp_path: Path, seed: int, ws_name: str) -> set:
    cfg_path = _config(tmp_path, seed=seed)
    cfg_data = yaml.safe_load(cfg_path.read_text(encoding="utf-8"))
    cfg_data["workspace_dir"] = str(tmp_path / ws_name)
    cfg2 = tmp_path / f"cfg_{seed}_{ws_name}.yaml"
    cfg2.write_text(yaml.safe_dump(cfg_data), encoding="utf-8")
    r = TyperCliRunner().invoke(
        app, ["run", str(EXAMPLE), "--offline", "--smoke", "--config", str(cfg2)]
    )
    assert r.exit_code == 0, r.output
    ref_dir = next((tmp_path / ws_name).glob("max-subarray-sum/runs/*"))
    return _corpus_shas(ref_dir)


def test_resume_with_override_config(tmp_path, partial_run):
    """--override-config 时才使用当前配置（seed=99 的派生语料出现）。"""
    tmp_path, cfg42, run_dir = partial_run
    cfg99 = _config(tmp_path, seed=99)

    r = TyperCliRunner().invoke(
        app, ["resume", run_dir.name, "--override-config"],
        env={"ACMFORGE_CONFIG": str(cfg99)},
    )
    assert r.exit_code == 0, r.output
    corpus = json.loads((run_dir / "corpus.json").read_text(encoding="utf-8"))
    seeds = [r["seed"] for r in corpus["records"]]
    # 注意：corpus.json 在 design_tests 时尚未生成 —— 本 run 续跑到 generate_candidates 之后的
    # 全量语料以 resume 期间生成部分为准；快照路径下无 99 派生 seed，override 路径必须有
    assert any(1_000_099 <= sd <= 1_000_140 for sd in seeds), "--override-config 未生效：没有 seed=99 派生语料"
    assert not any(1_000_042 <= sd < 1_000_099 for sd in seeds), "override 仍混入了快照 seed=42 的语料"
