"""MutantAgent：编写典型错误解（卡人候选）。"""

from __future__ import annotations

from acmforge.agents.base import BaseAgent
from acmforge.agents.schemas import MutantSet
from acmforge.prompts import spec_context


class MutantAgent(BaseAgent):
    name = "mutant"

    def design(self, spec, std_code: str, count: int) -> tuple[MutantSet, dict]:
        variables = {
            **spec_context(spec),
            "std_code": std_code,
            "count": count,
        }
        return self._ask(variables, MutantSet)
