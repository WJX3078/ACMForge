"""TestDesignerAgent：输出测试策略（不直接生成数据）。"""

from __future__ import annotations

from acmforge.agents.base import BaseAgent
from acmforge.agents.schemas import StrategySet
from acmforge.prompts import spec_context


class TestDesignerAgent(BaseAgent):
    name = "test_designer"

    def design(
        self,
        spec,
        modes: list[str],
        mutants: list[dict],
    ) -> tuple[StrategySet, dict]:
        variables = {
            **spec_context(spec),
            "modes": ", ".join(modes),
            "mutants": [
                {
                    "category": m.get("category", ""),
                    "description": m.get("description", ""),
                    "expected_verdict": m.get("expected_verdict", "WA"),
                }
                for m in mutants
            ],
        }
        return self._ask(variables, StrategySet)
