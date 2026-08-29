"""SolverAgent：实现 std（含修复模式）。"""

from __future__ import annotations

from acmforge.agents.base import BaseAgent
from acmforge.agents.schemas import CodeSolution
from acmforge.prompts import spec_context


class SolverAgent(BaseAgent):
    name = "solver"

    def solve(self, spec) -> tuple[CodeSolution, dict]:
        variables = {
            **spec_context(spec),
            "counterexample": None,
            "previous_code": None,
            "previous_version": "",
        }
        result, meta = self._ask(variables, CodeSolution)
        return result, meta

    def repair(
        self,
        spec,
        previous_code: str,
        previous_version: str,
        ce_input: str,
        ce_std_out: str,
        ce_brute_out: str,
    ) -> tuple[CodeSolution, dict]:
        variables = {
            **spec_context(spec),
            "counterexample": {
                "input": ce_input,
                "std_out": ce_std_out,
                "brute_out": ce_brute_out,
            },
            "previous_code": previous_code,
            "previous_version": previous_version,
        }
        return self._ask(variables, CodeSolution)
