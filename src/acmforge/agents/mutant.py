"""MutantAgent：两段式生成 —— 先 WrongIdeaSpec（想清楚错在哪），再写错误解。"""

from __future__ import annotations

from acmforge.agents.base import BaseAgent
from acmforge.agents.schemas import MutantIdeaSet, SingleWrongSolution
from acmforge.prompts import spec_context


class MutantIdeaAgent(BaseAgent):
    name = "mutant_ideas"

    def design_ideas(self, spec, std_code: str, count: int) -> tuple[MutantIdeaSet, dict]:
        variables = {**spec_context(spec), "std_code": std_code, "count": count}
        return self._ask(variables, MutantIdeaSet)


class MutantSolutionAgent(BaseAgent):
    name = "mutant"

    def design_for_idea(self, spec, std_code: str, idea: dict) -> tuple[SingleWrongSolution, dict]:
        variables = {**spec_context(spec), "std_code": std_code, "idea": idea}
        return self._ask(variables, SingleWrongSolution)
