"""各路 Agent 的结构化输出模型（必须经 Pydantic 校验）。"""

from __future__ import annotations

from pydantic import BaseModel, Field, field_validator

from acmforge.domain.models import Complexity

_VALID_CATEGORIES = {
    "WRONG_GREEDY",
    "WRONG_TRANSITION",
    "BOUNDARY",
    "OVERFLOW",
    "MISSING_CASE",
    "TLE",
    "MLE",
    "IMPLEMENTATION_BUG",
}
_VALID_VERDICTS = {"WA", "TLE", "MLE"}


class CodeSolution(BaseModel):
    code: str = Field(min_length=20)
    idea_summary: str = ""
    complexity: Complexity = Field(default_factory=Complexity)


class BruteSolution(BaseModel):
    code: str = Field(min_length=20)
    approach: str = ""


class GenProgram(BaseModel):
    code: str = Field(min_length=50)
    modes: list[str] = Field(min_length=1)
    notes: str = ""

    @field_validator("modes")
    @classmethod
    def _modes_valid(cls, v: list[str]) -> list[str]:
        cleaned = [m.strip() for m in v if m.strip()]
        if not cleaned:
            raise ValueError("modes 不能为空")
        return cleaned


class WrongSolutionItem(BaseModel):
    code: str = Field(min_length=20)
    category: str
    description: str = ""
    expected_verdict: str = "WA"

    @field_validator("category")
    @classmethod
    def _cat(cls, v: str) -> str:
        v = v.strip().upper()
        if v not in _VALID_CATEGORIES:
            raise ValueError(f"未知 category: {v}")
        return v

    @field_validator("expected_verdict")
    @classmethod
    def _verd(cls, v: str) -> str:
        v = v.strip().upper()
        if v not in _VALID_VERDICTS:
            raise ValueError(f"未知 expected_verdict: {v}")
        return v


class SingleWrongSolution(BaseModel):
    """两段式 mutant 生成第二步：按给定 WrongIdeaSpec 写一个错误解。"""

    code: str = Field(min_length=20)
    description: str = ""
    expected_verdict: str = "WA"

    @field_validator("expected_verdict")
    @classmethod
    def _verd(cls, v: str) -> str:
        v = v.strip().upper()
        if v not in _VALID_VERDICTS:
            raise ValueError(f"未知 expected_verdict: {v}")
        return v


class WrongIdeaItem(BaseModel):
    """两段式 mutant 生成第一步：只描述错误思路，不写代码。"""

    id: str = Field(min_length=3)
    category: str
    title: str = Field(min_length=3)
    reasoning_summary: str = ""
    why_plausible: str = ""
    claimed_complexity: str = ""
    expected_failure_patterns: list[str] = Field(default_factory=list)
    counterexample_shape: str = ""
    target_constraints: list[str] = Field(default_factory=list)

    @field_validator("category")
    @classmethod
    def _cat(cls, v: str) -> str:
        v = v.strip().upper()
        if v not in _VALID_CATEGORIES:
            raise ValueError(f"未知 category: {v}")
        return v

    @field_validator("id")
    @classmethod
    def _id_slug(cls, v: str) -> str:
        import re

        if not re.fullmatch(r"[a-z0-9_\-]{3,40}", v):
            raise ValueError(f"idea id 必须是小写字母/数字/下划线（3-40 字符）: {v}")
        return v


class MutantIdeaSet(BaseModel):
    ideas: list[WrongIdeaItem] = Field(min_length=1)


class SurvivorAnalysisItem(BaseModel):
    """对幸存变异体的定向分析（Phase F）。"""

    target_mutant_id: str = Field(min_length=3)
    why_survived: str = Field(min_length=5)
    required_structure: str = ""
    required_scale: str = ""
    required_edge_case: str = ""
    mode: str  # gen.py 模式
    generator_parameters: dict = Field(default_factory=dict)
    purpose: str = ""


class SurvivorAnalysisSet(BaseModel):
    analyses: list[SurvivorAnalysisItem] = Field(min_length=1)


class MutantSet(BaseModel):
    mutants: list[WrongSolutionItem] = Field(min_length=1)


class StrategyItem(BaseModel):
    name: str
    purpose: str = ""
    mode: str
    params: dict = Field(default_factory=dict)
    count: int = Field(default=1, ge=1, le=1000)
    priority: int = 0
    target_mutants: list[str] = Field(default_factory=list)


class StrategySet(BaseModel):
    strategies: list[StrategyItem] = Field(min_length=1)


class StatementStory(BaseModel):
    story_markdown: str = Field(min_length=10)


class EditorialDoc(BaseModel):
    editorial_markdown: str = Field(min_length=50)


class ReviewVerdict(BaseModel):
    passed: bool
    issues: list[str] = Field(default_factory=list)
    notes: str = ""
