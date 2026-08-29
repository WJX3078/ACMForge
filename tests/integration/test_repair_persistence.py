"""P0-1 回归：repair 产生的新 STD 必须持久化到 solutions manifest，
并被后续所有节点（mutants/candidates/final_verify/package）一致使用。
"""

import json
from pathlib import Path

import pytest

from acmforge.eval.runner import run_eval
from acmforge.util import sha256_file

pytestmark = pytest.mark.usefixtures("gxx")

FIXTURE = Path(__file__).resolve().parents[1] / "fixtures" / "eval-repair"


def _tmp_config(tmp_path: Path) -> Path:
    import yaml

    cfg = {
        "workspace_dir": str(tmp_path / "workspace"),
        "llm": {"api_key": "", "api_key_env": "__NONE__"},
    }
    p = tmp_path / "eval_config.yaml"
    p.write_text(yaml.safe_dump(cfg), encoding="utf-8")
    return p


def test_repaired_std_persisted_to_manifest(tmp_path):
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
    # 修复必须发生且最终成功
    assert m.pipeline_success, m.failure_detail
    assert m.std_repair_count >= 1
    assert m.std_first_pass_correct is False  # 第一次是错的
    assert m.std_final_correct is True

    # 定位 run 目录
    ws_root = tmp_path / "workspace"
    run_dirs = list(ws_root.glob("repair-sum/runs/*"))
    assert run_dirs
    run_dir = run_dirs[0]

    solutions = json.loads((run_dir / "solutions.json").read_text(encoding="utf-8"))
    fuzz = json.loads((run_dir / "fuzz.json").read_text(encoding="utf-8"))

    # 1) manifest 中记录的必须是修复后版本，且与 fuzz 门禁使用的版本一致
    assert solutions["std"]["version"] == fuzz["std_version"]
    assert solutions["std"]["version"] != "std_v1"  # v1 是故意写错的版本
    assert solutions["std"]["origin"] == "llm-repair"

    # 2) package 中的 std.cpp 必须来自修复后版本（比较内容 SHA，而非字符串标签）
    pkg = json.loads((run_dir / "package.json").read_text(encoding="utf-8"))
    pkg_dir = run_dir / pkg["dir"]
    packaged_sha = sha256_file(pkg_dir / "solutions" / "std.cpp")
    manifest_sha = sha256_file(run_dir / solutions["std"]["path"])
    assert packaged_sha == manifest_sha

    # 3) 修复版内容必须是正确实现（包含对负数的处理），而不是被丢弃的 v1
    fixed_code = (run_dir / solutions["std"]["path"]).read_text(encoding="utf-8")
    assert "if (x > 0) s += x;" not in fixed_code
