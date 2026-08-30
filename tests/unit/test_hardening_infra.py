"""P0-14/15 + P0-6 单元测试：原子写入、artifact 唯一性、DockerRunner 骨架。"""

import json

import pytest

from acmforge.util import write_json
from acmforge.workspace import Workspace
from acmforge.runner.docker import DockerRunner, docker_available


def test_atomic_json_write(tmp_path):
    """写入后必须是合法 JSON 且不残留 .tmp 文件（P0-14）。"""
    p = tmp_path / "state.json"
    write_json(p, {"a": 1, "b": ["中文"]})
    assert json.loads(p.read_text(encoding="utf-8")) == {"a": 1, "b": ["中文"]}
    assert not (tmp_path / "state.json.tmp").exists()
    assert not list(tmp_path.glob("*.tmp"))


def test_atomic_json_overwrite_replaces(tmp_path):
    p = tmp_path / "m.json"
    write_json(p, {"v": 1})
    write_json(p, {"v": 2})
    assert json.loads(p.read_text(encoding="utf-8"))["v"] == 2


def test_artifact_ids_are_unique(tmp_path):
    """P0-15：不同子目录的同名文件 artifact id 必须不同。"""
    ws = Workspace.create(tmp_path, "p1")
    a = ws.write_new(ws.mutants_dir / "m1", "src.cpp", "// one")
    b = ws.write_new(ws.mutants_dir / "m2", "src.cpp", "// two")
    e1 = ws.record_artifact(a, "source_code", "generate_mutants")
    e2 = ws.record_artifact(b, "source_code", "generate_mutants")
    assert e1["id"] != e2["id"]
    assert "mutants/m1" in e1["id"] and "mutants/m2" in e2["id"]
    # id 含 sha 前缀且完整 sha 一致性成立
    assert e1["id"].endswith(e1["sha256"][:8])


def test_docker_runner_skeleton_isolation_flags():
    """DockerRunner 的隔离参数必须齐备（network/read-only/non-root/limits）。"""
    args = DockerRunner.build_run_args("acmforge-cpp20:latest", memory_mb=512, timeout_s=2.0)
    joined = " ".join(args)
    assert "--network none" in joined
    assert "--read-only" in joined
    assert "--user 65534:65534" in joined
    assert "--memory 512m" in joined
    assert "--pids-limit 128" in joined
    assert "--cpus 1" in joined
    assert "--tmpfs" in joined


def test_docker_runner_refuses_without_docker():
    """无 Docker 环境必须显式拒绝，绝不静默降级。"""
    if docker_available():
        pytest.skip("本机有 Docker，跳过拒绝路径")
    with pytest.raises(Exception) as ei:
        DockerRunner()  # require_running=True 默认
    assert "Docker" in str(ei.value)


def test_docker_runner_exec_layer_is_honest_skeleton():
    """骨架阶段执行层必须显式拒绝（不伪装可用）。"""
    if docker_available():
        pytest.skip("本机有 Docker，骨架执行层已可被真实实现替换")
    r = DockerRunner(require_running=False)
    with pytest.raises(Exception) as ei:
        r.run("a.exe")
    assert "骨架" in str(ei.value)
