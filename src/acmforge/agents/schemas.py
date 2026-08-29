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
