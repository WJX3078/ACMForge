"""Validator 协议与结果模型。"""

from __future__ import annotations

from typing import Protocol

from pydantic import BaseModel

from acmforge.domain.models import ProblemSpec

ValidationStatus = str  # "pass" | "fail" | "unknown"


class ValidationResult(BaseModel):
    valid: bool  # 仅 status == "pass" 时为 True
    status: ValidationStatus
    reason: str = ""


class InputValidator(Protocol):
    name: str

    def validate(self, text: str, spec: ProblemSpec) -> ValidationResult:
        ...
