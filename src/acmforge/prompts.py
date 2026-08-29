"""Prompt 管理：所有 prompt 一律文件化、版本化，禁止硬编码在业务代码里。

布局：
    prompts/<agent>/system.md     # 角色与硬性规则
    prompts/<agent>/v1.md         # 用户 prompt 模板（Jinja2）
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from jinja2 import Environment, StrictUndefined, TemplateError

from acmforge.domain.errors import AcmforgeError

_PROMPTS_ROOT = Path(__file__).resolve().parents[2] / "prompts"


class PromptError(AcmforgeError):
    pass


@lru_cache(maxsize=64)
def _load(agent: str, filename: str) -> str:
    path = _PROMPTS_ROOT / agent / filename
    if not path.is_file():
        raise PromptError(f"prompt 文件缺失: {path}")
    return path.read_text(encoding="utf-8")


_env = Environment(undefined=StrictUndefined, keep_trailing_newline=True)


def render_prompt(agent: str, variables: dict) -> tuple[str, str]:
    """返回 (system, user)。变量缺失会直接报错（StrictUndefined）。"""
    system = _load(agent, "system.md")
    user_tpl = _load(agent, "v1.md")
    try:
        user = _env.from_string(user_tpl).render(**variables)
    except TemplateError as e:
        raise PromptError(f"渲染 agent={agent} 的 prompt 失败: {e}") from e
    return system, user


def prompt_version(agent: str) -> str:
    return "v1"


def spec_context(spec) -> dict:
    """把 ProblemSpec 拆成 prompt 模板可用的变量。"""
    return {
        "slug": spec.slug,
        "title": spec.title,
        "summary": spec.summary,
        "story": spec.story or "",
        "task": spec.task,
        "input_format": spec.input_format,
        "output_format": spec.output_format,
        "constraints_items": [f"- {c.name}: {c.description}" for c in spec.constraints.items],
        "bounds": spec.constraints.bounds,
        "limits": spec.limits.model_dump(),
        "intended": {
            "observations": spec.intended_solution.observations,
            "algorithm": spec.intended_solution.algorithm,
            "proof_outline": spec.intended_solution.proof_outline,
            "complexity": spec.intended_solution.complexity.model_dump(),
        },
        "samples": [
            {"input": s.input, "expected_output": s.expected_output or "", "note": s.note or ""}
            for s in spec.samples
        ],
        "notes": spec.notes or "",
    }
