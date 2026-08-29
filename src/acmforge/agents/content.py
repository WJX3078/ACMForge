"""内容类 Agent：题面润色 / 题解撰写 / 验题审查。"""

from __future__ import annotations

from acmforge.agents.base import BaseAgent
from acmforge.agents.schemas import EditorialDoc, ReviewVerdict, StatementStory
from acmforge.prompts import spec_context


class StatementAgent(BaseAgent):
    name = "statement"

    def write(self, spec) -> tuple[StatementStory, dict]:
        variables = {**spec_context(spec), "spec_story": spec.story or "", "language": spec.language}
        return self._ask(variables, StatementStory)


class EditorialAgent(BaseAgent):
    name = "editorial"

    def write(
        self,
        spec,
        std_code: str,
        std_idea: str,
        fuzz_cases: int,
        mismatches: int,
        test_count: int,
        mutant_killed: int,
        mutant_total: int,
        std_max_ms: float,
        time_limit_ms: int,
    ) -> tuple[EditorialDoc, dict]:
        variables = {
            **spec_context(spec),
            "std_code": std_code,
            "std_idea": std_idea,
            "fuzz_cases": fuzz_cases,
            "mismatches": mismatches,
            "test_count": test_count,
            "mutant_killed": mutant_killed,
            "mutant_total": mutant_total,
            "std_max_ms": round(std_max_ms, 1),
            "time_limit_ms": time_limit_ms,
            "language": spec.language,
        }
        return self._ask(variables, EditorialDoc)


class ReviewerAgent(BaseAgent):
    name = "reviewer"

    def review(
        self,
        statement_markdown: str,
        spec,
        deterministic_checks: str,
    ) -> tuple[ReviewVerdict, dict]:
        variables = {
            "statement_markdown": statement_markdown,
            "task": spec.task,
            "input_format": spec.input_format,
            "output_format": spec.output_format,
            "constraints_items": "; ".join(f"{c.name}: {c.description}" for c in spec.constraints.items),
            "sample_count": len(spec.samples),
            "deterministic_checks": deterministic_checks,
        }
        return self._ask(variables, ReviewVerdict)
