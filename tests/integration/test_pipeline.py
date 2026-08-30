"""完整流水线集成测试（offline 模式，真实编译执行）。"""

import json
from pathlib import Path

import pytest
import yaml

from acmforge.config import AppConfig
from acmforge.domain.models import RunStatus
from acmforge.workflow import NodeContext, build_engine
from acmforge.workspace import Workspace

pytestmark = pytest.mark.usefixtures("gxx")


def _load_spec(example_dir: Path):
    from acmforge.cli import load_spec

    return load_spec(example_dir / "problem.yaml")


def _make_ctx(cfg: AppConfig, example_dir: Path, ws: Workspace):
    spec = _load_spec(example_dir)
    return NodeContext(cfg, spec, example_dir / "problem.yaml", ws, provider=None, base_dir=example_dir)


def test_full_pipeline_offline(cfg: AppConfig, example_dir: Path, tmp_path: Path):
    ws = Workspace.create(Path(cfg.workspace_dir), "max-subarray-sum")
    ctx = _make_ctx(cfg, example_dir, ws)
    engine = build_engine(ctx)

    status = engine.run()
    assert status == RunStatus.COMPLETED, ws.read_state()

    pkg = ctx.manifest("package")
    assert pkg and ws.resolve(pkg["dir"]).is_dir()
    quality = pkg["quality"]
    assert quality["decision"] == "ready_for_human_review"
    assert quality["differential_mismatches"] == 0
    assert quality["kill_rate"] >= 0.95
    assert quality["tle_mutant_killed"] == quality["tle_mutant_total"]
    assert quality["std_margin_ratio"] <= cfg.benchmark.std_target_ratio

    # 题包完整性
    pkg_dir = ws.resolve(pkg["dir"])
    for rel in (
        "problem.yaml",
        "statement.md",
        "editorial.md",
        "solutions/std.cpp",
        "solutions/brute.cpp",
        "gen/gen.py",
        "wrong/wrong_report.json",
        "reports/kill_matrix.md",
        "report.md",
        "quality.json",
    ):
        assert (pkg_dir / rel).is_file(), f"题包缺少 {rel}"
    tests = sorted((pkg_dir / "tests").glob("*.in"))
    assert tests, "最终测试集为空"

    # 样例答案必须来自程序（非空 .ans）
    first_ans = (pkg_dir / "tests" / "1.ans").read_text(encoding="utf-8").strip()
    assert first_ans


def test_buggy_std_fails_with_counterexample(cfg: AppConfig, example_dir: Path, tmp_path: Path):
    """植入 bug 的 std：offline 模式无法修复 => differential_fuzz 节点失败 + 反例落盘。"""
    spec_data = yaml.safe_load((example_dir / "problem.yaml").read_text(encoding="utf-8"))
    assets_dir = tmp_path / "assets"
    assets_dir.mkdir()
    buggy = assets_dir / "std.cpp"
    buggy.write_text(
        "\n".join(
            line.replace("cur = std::max(x, cur + x);", "cur = cur + x;")
            for line in (example_dir / "assets" / "std.cpp").read_text(encoding="utf-8").splitlines()
        ),
        encoding="utf-8",
    )
    # 相对 problem.yaml 的路径；brute/gen 沿用示例题的绝对定位方式（同样相对 spec 所在目录）
    import shutil

    shutil.copyfile(example_dir / "assets" / "brute.cpp", assets_dir / "brute.cpp")
    shutil.copyfile(example_dir / "assets" / "gen.py", assets_dir / "gen.py")
    for m in spec_data["assets"]["mutants"]:
        src = example_dir / m["path"]
        shutil.copyfile(src, assets_dir / Path(m["path"]).name)
        m["path"] = f"assets/{Path(m['path']).name}"
    spec_data["assets"]["std"] = "assets/std.cpp"
    spec_data["assets"]["brute"] = "assets/brute.cpp"
    spec_data["assets"]["gen"] = "assets/gen.py"

    spec_path = tmp_path / "problem.yaml"
    spec_path.write_text(yaml.safe_dump(spec_data, allow_unicode=True), encoding="utf-8")

    from acmforge.cli import load_spec

    spec = load_spec(spec_path)
    ws = Workspace.create(Path(cfg.workspace_dir), spec.slug)
    ctx = NodeContext(cfg, spec, spec_path, ws, provider=None, base_dir=tmp_path)
    engine = build_engine(ctx)

    status = engine.run()
    assert status == RunStatus.FAILED
    state = ws.read_state()
    assert state["failed_node"] == "differential_fuzz"

    ce_files = sorted(ws.ce_dir.glob("ce_*/input.txt"))
    assert ce_files, "反例应落盘"
    meta = json.loads((ce_files[0].parent / "metadata.json").read_text(encoding="utf-8"))
    assert "seed" in meta and "reason" in meta


def test_resume_from_node(cfg: AppConfig, example_dir: Path, tmp_path: Path):
    """--until 停在 compile_solutions，再跑完整流水线应跳过已完成节点。"""
    ws = Workspace.create(Path(cfg.workspace_dir), "max-subarray-sum")
    ctx = _make_ctx(cfg, example_dir, ws)
    engine = build_engine(ctx)

    status = engine.run(until="compile_solutions")
    assert status == RunStatus.COMPLETED
    state = ws.read_state()
    assert state["nodes"]["compile_solutions"]["status"] == "ok"
    assert "differential_fuzz" not in state["nodes"]

    status2 = engine.run()
    assert status2 == RunStatus.COMPLETED
    state2 = ws.read_state()
    assert state2["nodes"]["package"]["status"] == "ok"
    assert state2["nodes"]["compile_solutions"]["status"] == "ok"  # 未重跑
