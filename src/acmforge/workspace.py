"""Workspace 管理：每次 run 一个独立目录，互不污染，产物可复现。

布局：
    workspace/<slug>/runs/<run_id>/
        spec.yaml                 # 本次 run 使用的 spec 快照
        state.json                # workflow 状态（支持 resume）
        artifacts.jsonl           # Artifact 注册表（sha256 追加）
        solutions/                # std_v1.cpp / brute_v1.cpp / gen.py ...
        mutants/<mid>/src.cpp
        corpus/                   # 候选测试 <tid>.in / <tid>.ans + corpus.json
        tests/                    # 最终选中的测试
        counterexamples/ce_xxx/
        content/                  # statement.md / editorial.md / review.json
        reports/
        final/                    # 打包产物
        logs/run.log  logs/llm_calls.jsonl
"""

from __future__ import annotations

import json
import secrets
import threading
from pathlib import Path
from typing import Any

from acmforge.util import now_iso, sha256_file, write_json

_ARTIFACTS_LOCK = threading.Lock()


class Workspace:
    def __init__(self, root: Path, slug: str, run_id: str):
        self.root = root
        self.slug = slug
        self.run_id = run_id
        self.run_dir = root / slug / "runs" / run_id

        self.solutions_dir = self.run_dir / "solutions"
        self.mutants_dir = self.run_dir / "mutants"
        self.corpus_dir = self.run_dir / "corpus"
        self.tests_dir = self.run_dir / "tests"
        self.ce_dir = self.run_dir / "counterexamples"
        self.content_dir = self.run_dir / "content"
        self.reports_dir = self.run_dir / "reports"
        self.final_dir = self.run_dir / "final"
        self.logs_dir = self.run_dir / "logs"

        for d in (
            self.solutions_dir,
            self.mutants_dir,
            self.corpus_dir,
            self.tests_dir,
            self.ce_dir,
            self.content_dir,
            self.reports_dir,
            self.final_dir,
            self.logs_dir,
        ):
            d.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------
    # 基础
    # ------------------------------------------------------------------

    @staticmethod
    def new_run_id() -> str:
        import time

        return time.strftime("%Y%m%d-%H%M%S") + "-" + secrets.token_hex(2)

    @classmethod
    def create(cls, workspace_root: Path, slug: str, run_id: str | None = None) -> "Workspace":
        return cls(workspace_root, slug, run_id or cls.new_run_id())

    def rel(self, path: Path) -> str:
        """把 run 内的绝对路径转成相对 run 目录的路径（便于跨机器移动）。"""
        return str(path.relative_to(self.run_dir)).replace("\\", "/")

    def resolve(self, rel_path: str) -> Path:
        return self.run_dir / rel_path

    # ------------------------------------------------------------------
    # 状态与清单（JSON）
    # ------------------------------------------------------------------

    def write_state(self, state: dict[str, Any]) -> None:
        write_json(self.run_dir / "state.json", state)

    def read_state(self) -> dict[str, Any] | None:
        p = self.run_dir / "state.json"
        if not p.is_file():
            return None
        with open(p, "r", encoding="utf-8") as f:
            return json.load(f)

    def write_manifest(self, name: str, data: Any) -> None:
        write_json(self.run_dir / f"{name}.json", data)

    def read_manifest(self, name: str) -> Any | None:
        p = self.run_dir / f"{name}.json"
        if not p.is_file():
            return None
        with open(p, "r", encoding="utf-8") as f:
            return json.load(f)

    # ------------------------------------------------------------------
    # Artifact 注册表：所有重要生成结果统一登记（sha256 防篡改、可追溯）
    # ------------------------------------------------------------------

    def record_artifact(self, path: Path, type_name: str, producer: str) -> dict[str, Any]:
        rel = self.rel(path)
        entry_sha = sha256_file(path)
        entry = {
            # P0-15：producer + 相对路径 + sha 前缀，保证全局唯一
            # （旧 id 仅 producer:filename，mutants/m1 与 mutants/m2 会撞车）
            "id": f"{producer}:{rel}:{entry_sha[:8]}",
            "type": type_name,
            "path": rel,
            "sha256": entry_sha,
            "producer": producer,
            "created_at": now_iso(),
        }
        with _ARTIFACTS_LOCK:
            with open(self.run_dir / "artifacts.jsonl", "a", encoding="utf-8") as f:
                f.write(json.dumps(entry, ensure_ascii=False) + "\n")
        return entry

    def artifacts(self) -> list[dict[str, Any]]:
        p = self.run_dir / "artifacts.jsonl"
        if not p.is_file():
            return []
        out = []
        with open(p, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    out.append(json.loads(line))
        return out

    # ------------------------------------------------------------------
    # 文件写入（不无声覆盖）
    # ------------------------------------------------------------------

    def write_new(self, directory: Path, filename: str, content: str | bytes) -> Path:
        """写入新文件；若同名文件已存在则报错（绝不无声覆盖旧版本）。"""
        directory.mkdir(parents=True, exist_ok=True)
        path = directory / filename
        if path.exists():
            raise FileExistsError(f"拒绝覆盖已存在文件: {path}")
        if isinstance(content, bytes):
            path.write_bytes(content)
        else:
            path.write_text(content, encoding="utf-8", newline="\n")
        return path

    def next_version_path(self, directory: Path, stem: str, suffix: str) -> Path:
        """返回下一个可用版本号路径：std_v1.cpp, std_v2.cpp, ...（旧版本永不覆盖）。"""
        directory.mkdir(parents=True, exist_ok=True)
        i = 1
        while (directory / f"{stem}_v{i}{suffix}").exists():
            i += 1
        return directory / f"{stem}_v{i}{suffix}"
