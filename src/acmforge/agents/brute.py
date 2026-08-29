"""BruteAgent：实现暴力解（对拍基准）。"""

from __future__ import annotations

from acmforge.agents.base import BaseAgent
from acmforge.agents.schemas import BruteSolution
from acmforge.prompts import spec_context


class BruteAgent(BaseAgent):
    name = "brute"

    def solve(self, spec) -> tuple[BruteSolution, dict]:
        return self._ask(spec_context(spec), BruteSolution)
