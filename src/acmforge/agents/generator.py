"""GeneratorAgent：编写确定性数据生成器 gen.py。"""

from __future__ import annotations

from acmforge.agents.base import BaseAgent
from acmforge.agents.schemas import GenProgram
from acmforge.prompts import spec_context


class GeneratorAgent(BaseAgent):
    name = "generator"

    def design(self, spec) -> tuple[GenProgram, dict]:
        return self._ask(spec_context(spec), GenProgram)
