"""Agent 基类：Agent = Think，只负责产生"智能结果"（结构化），不执行、不落盘。"""

from __future__ import annotations

from pathlib import Path
from typing import TypeVar

from pydantic import BaseModel

from acmforge.domain.errors import AcmforgeError
from acmforge.llm.provider import LLMProvider
from acmforge.llm.structured import ask_structured
from acmforge.prompts import prompt_version, render_prompt

T = TypeVar("T", bound=BaseModel)


class AgentError(AcmforgeError):
    pass


class BaseAgent:
    name: str = "base"

    def __init__(
        self,
        provider: LLMProvider,
        trace_path: Path | None = None,
        model_name: str = "",
    ):
        self.provider = provider
        self.trace_path = trace_path
        self.model_name = model_name or getattr(provider, "config", None) and getattr(  # type: ignore[operator]
            getattr(provider, "config", None), "model", ""
        ) or "mock"

    def _render(self, variables: dict) -> tuple[str, str]:
        return render_prompt(self.name, variables)

    def _ask(
        self,
        variables: dict,
        model_cls: type[T],
        max_retries: int = 3,
    ) -> tuple[T, dict]:
        system, user = self._render(variables)
        result = ask_structured(
            provider=self.provider,
            agent=self.name,
            system=system,
            user=user,
            model_cls=model_cls,
            max_retries=max_retries,
            trace_path=self.trace_path,
            trace_meta={"model": self.model_name, "prompt_version": prompt_version(self.name)},
        )
        meta = {
            "agent": self.name,
            "model": self.model_name,
            "provider": self.provider.name,
            "prompt_version": prompt_version(self.name),
        }
        return result, meta
