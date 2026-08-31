"""SurvivorAgent：分析幸存变异体，给出定向测试策略（Phase F）。"""

from __future__ import annotations

from acmforge.agents.base import BaseAgent
from acmforge.agents.schemas import SurvivorAnalysisSet
from acmforge.prompts import spec_context


class SurvivorAnalyzerAgent(BaseAgent):
    name = "survivor"

    def analyze(
        self,
        spec,
        modes: list[str],
        survivors: list[dict],
        strategies: list[str],
    ) -> tuple[SurvivorAnalysisSet, dict]:
        variables = {
            **spec_context(spec),
            "modes": ", ".join(modes),
            "survivors": survivors,
            "strategies": strategies,
        }
        return self._ask(variables, SurvivorAnalysisSet)
