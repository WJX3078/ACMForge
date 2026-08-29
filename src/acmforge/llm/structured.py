"""结构化输出：prompt -> JSON -> Pydantic 校验，失败带错误信息重试。"""

from __future__ import annotations

from pathlib import Path
from typing import TypeVar

from pydantic import BaseModel

from acmforge.llm.provider import LLMProvider, parse_json_output
from acmforge.util import sha256_text

T = TypeVar("T", bound=BaseModel)


def ask_structured(
    provider: LLMProvider,
    agent: str,
    system: str,
    user: str,
    model_cls: type[T],
    max_retries: int = 3,
    trace_path: Path | None = None,
    trace_meta: dict | None = None,
) -> T:
    """调用 LLM 并解析为 Pydantic 模型；格式错误会把校验错误反馈给模型重试。"""
    conversation_tail = ""
    last_error: Exception | None = None

    for attempt in range(1, max_retries + 1):
        prompt = user if not conversation_tail else user + conversation_tail
        started = __import__("time").perf_counter()
        captured: list = []
        raw = provider.complete(agent, system, prompt, usage_sink=captured.append)
        latency_ms = (__import__("time").perf_counter() - started) * 1000
        _trace(
            trace_path,
            agent=agent,
            attempt=attempt,
            prompt_sha=sha256_text(prompt),
            output_sha=sha256_text(raw),
            latency_ms=latency_ms,
            usage=captured[0] if captured else None,
            ok=True,
            meta=trace_meta,
        )
        try:
            data = parse_json_output(raw)
            return model_cls.model_validate(data)
        except Exception as e:  # JSONDecodeError / ValueError / ValidationError
            last_error = e
            conversation_tail = (
                "\n\n你上一次的输出无法通过校验，错误信息：\n"
                f"{str(e)[:1500]}\n"
                "请严格输出符合要求的 JSON（可放在 ```json 围栏中），不要输出其他内容。"
            )

    raise ValueError(
        f"agent={agent} 结构化输出在 {max_retries} 次尝试后仍不合法: {last_error}"
    )


def _trace(
    path: Path | None,
    **fields: object,
) -> None:
    if path is None:
        return
    import json

    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(fields, ensure_ascii=False, default=str) + "\n")
