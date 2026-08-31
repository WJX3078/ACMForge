"""数据集加载与 Mock Provider（Phase D）。

数据集布局：
    <root>/
      dataset.json                     # {"problems": [{"id": ..., "tags": [...], "difficulty": ...}]}
      problems/<id>/problem.yaml       # ProblemSpec（不含 assets —— 由 Agent 生成）
      problems/<id>/reference/         # 参考实现 std.cpp / brute.cpp / gen.py（可选）
      problems/<id>/mock/              # MockProvider 回应（可选，CI 无网络依赖）
"""

from __future__ import annotations

import json
from pathlib import Path

import yaml

from acmforge.domain.errors import LLMError
from acmforge.domain.models import ProblemSpec
from acmforge.eval.models import EvalProblem


def load_dataset(root: Path) -> list[EvalProblem]:
    root = Path(root)
    index_file = root / "dataset.json"
    if not index_file.is_file():
        raise FileNotFoundError(f"数据集缺少 dataset.json: {root}")
    index = json.loads(index_file.read_text(encoding="utf-8"))

    problems: list[EvalProblem] = []
    for entry in index.get("problems", []):
        pid = entry["id"]
        pdir = root / "problems" / pid
        spec_file = pdir / "problem.yaml"
        if not spec_file.is_file():
            raise FileNotFoundError(f"题目 {pid} 缺少 problem.yaml: {pdir}")
        spec = ProblemSpec(**yaml.safe_load(spec_file.read_text(encoding="utf-8")))

        def _read(rel: str) -> str | None:
            p = pdir / rel
            return p.read_text(encoding="utf-8") if p.is_file() else None

        problems.append(
            EvalProblem(
                problem_id=pid,
                spec_path=str(spec_file),
                spec=spec,
                expected_tags=entry.get("tags", []),
                expected_difficulty=entry.get("difficulty", "medium"),
                reference_solution=_read("reference/std.cpp"),
                reference_brute=_read("reference/brute.cpp"),
                reference_gen=_read("reference/gen.py"),
                mock_dir=str(pdir / "mock") if (pdir / "mock").is_dir() else None,
            )
        )
    if not problems:
        raise ValueError(f"数据集为空: {root}")
    return problems


class DatasetMockProvider:
    """按数据集目录中的 mock/<agent>.json 回应，不访问网络。

    mock 文件支持 {"__file__": "reference/std.cpp"} 间接引用（避免 JSON 转义大段代码）。
    未配置的 agent 抛 LLMError —— 与真实 provider 失败语义一致。
    """

    name = "dataset-mock"

    def __init__(self, problem: EvalProblem):
        self.problem = problem
        self.mock_dir = problem.mock_path
        self._call_counts: dict[str, int] = {}
        if self.mock_dir is None or not self.mock_dir.is_dir():
            raise LLMError(f"题目 {problem.problem_id} 没有可用的 mock 目录")

    def complete(self, agent: str, system: str, user: str, usage_sink=None) -> str:  # noqa: ARG002
        f = self.mock_dir / f"{agent}.json"
        if not f.is_file():
            raise LLMError(f"MockProvider 未配置 agent={agent}（problem={self.problem.problem_id}）")
        data = json.loads(f.read_text(encoding="utf-8"))
        if isinstance(data, dict) and "__sequence__" in data:
            # 按调用次序依次返回，超出后停留在最后一个 —— 模拟"第一次写错、修复后写对"
            seq = data["__sequence__"]
            idx = min(self._call_counts.get(agent, 0), len(seq) - 1)
            self._call_counts[agent] = idx + 1
            data = seq[idx]
        if isinstance(data, dict) and "__file__" in data:
            rel = data.pop("__file__")
            # 兼容两种基准：mock/ 目录内，或题目目录（如 reference/std.cpp）
            cand = (self.mock_dir / rel).resolve()
            if not cand.is_file():
                cand = (self.mock_dir.parent / rel).resolve()
            data["code"] = cand.read_text(encoding="utf-8")
        if usage_sink is not None:
            usage_sink(None)
        return json.dumps(data, ensure_ascii=False)
