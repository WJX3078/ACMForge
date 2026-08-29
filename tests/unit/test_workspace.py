from pathlib import Path

import pytest

from acmforge.workspace import Workspace


def test_run_isolation(tmp_path: Path):
    w1 = Workspace.create(tmp_path, "p1")
    w2 = Workspace.create(tmp_path, "p1")
    assert w1.run_dir != w2.run_dir
    assert w1.run_dir.parent.parent == tmp_path / "p1"


def test_write_new_refuses_overwrite(tmp_path: Path):
    w = Workspace.create(tmp_path, "p1")
    p = w.write_new(w.solutions_dir, "a.txt", "hello")
    assert p.read_text(encoding="utf-8") == "hello"
    with pytest.raises(FileExistsError):
        w.write_new(w.solutions_dir, "a.txt", "world")


def test_version_paths_never_overlap(tmp_path: Path):
    w = Workspace.create(tmp_path, "p1")
    p1 = w.next_version_path(w.solutions_dir, "std", ".cpp")
    p1.write_text("v1", encoding="utf-8")
    p2 = w.next_version_path(w.solutions_dir, "std", ".cpp")
    p2.write_text("v2", encoding="utf-8")
    assert p1.name == "std_v1.cpp"
    assert p2.name == "std_v2.cpp"


def test_artifact_registry_records_sha256(tmp_path: Path):
    w = Workspace.create(tmp_path, "p1")
    p = w.write_new(w.solutions_dir, "a.txt", "hello")
    entry = w.record_artifact(p, "source_code", "test")
    assert entry["sha256"] and len(entry["sha256"]) == 64
    arts = w.artifacts()
    assert len(arts) == 1
    assert arts[0]["producer"] == "test"


def test_manifest_roundtrip(tmp_path: Path):
    w = Workspace.create(tmp_path, "p1")
    w.write_manifest("demo", {"a": [1, 2], "b": "中文"})
    assert w.read_manifest("demo") == {"a": [1, 2], "b": "中文"}
    assert w.read_manifest("missing") is None
