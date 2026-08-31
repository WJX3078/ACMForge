"""Eval 数据模型。"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field

from acmforge.domain.models import ProblemSpec


class EvalProblem(BaseModel):
    """数据集中的一道题。"""

    problem_id: str
    spec_path: str
    spec: ProblemSpec
    expected_tags: list[str] = Field(default_factory=list)
    expected_difficulty: str = "medium"  # easy | medium | hard
    # 参考实现（可选）：mock 模式下充当"正确 Agent"的回应；也供人工比对
    reference_solution: str | None = None
    reference_brute: str | None = None
    reference_gen: str | None = None
    # mock 回应目录（可选；无则该题只能跑 offline 式路径或真实 LLM）
    mock_dir: str | None = None

    @property
    def mock_path(self) -> Path | None:
        return Path(self.mock_dir) if self.mock_dir else None


class ProblemMetrics(BaseModel):
    problem_id: str
    expected_difficulty: str = "medium"
    expected_tags: list[str] = Field(default_factory=list)

    pipeline_success: bool = False
    failed_node: str | None = None
    failure_type: str | None = None
    failure_detail: str = ""
    secondary_failures: list[str] = Field(default_factory=list)

    std_generated: bool = False
    std_compile_success: bool = False
    std_first_pass_correct: bool = False
    std_repair_count: int = 0
    std_final_correct: bool = False

    brute_compile_success: bool = False

    differential_cases: int = 0
    differential_failures: int = 0
    counterexample_count: int = 0

    mutants_generated: int = 0
    mutants_compiled: int = 0
    mutants_killed: int = 0
    duplicate_mutant_rate: float = 0.0
    mutant_compile_rate: float = 0.0
    equivalent_mutant_rate: float = 0.0  # 幸存/已编译（未做 survivor 分析时的代理指标）
    meaningful_mutant_rate: float = 0.0  # killed / compiled
    kill_rate: float = 0.0
    tle_mutants: int = 0
    tle_mutants_killed: int = 0
    mutant_kinds: dict[str, int] = Field(default_factory=dict)

    selected_test_count: int = 0
    statement_review: bool = False
    editorial_review: bool = False

    llm_call_count: int = 0
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    runtime_s: float = 0.0
    rounds: int = 0


class EvalSummary(BaseModel):
    eval_id: str
    dataset: str
    provider: str
    config: dict[str, Any] = Field(default_factory=dict)
    started_at: str = ""
    finished_at: str = ""
    problems: list[ProblemMetrics] = Field(default_factory=list)
