"""LLM Provider 抽象：Agent 只依赖本接口，不直接接触任何 SDK。

- OpenAICompatProvider：任何 OpenAI 兼容 HTTP 接口（GLM / DeepSeek / OpenAI / vLLM）。
- MockProvider：离线测试用，不访问网络。
- tracing：每次调用记录（agent/model/prompt哈希/输出哈希/耗时），供复盘。
"""

from __future__ import annotations

import json
import re
import time
import urllib.error
import urllib.request
from typing import Any, Protocol

from acmforge.config import LLMConfig
from acmforge.console import get_logger
from acmforge.domain.errors import LLMError

logger = get_logger("acmforge.llm")


class LLMProvider(Protocol):
    name: str

    def complete(self, agent: str, system: str, user: str) -> str:
        """返回模型文本输出。失败抛 LLMError。"""
        ...


class OpenAICompatProvider:
    name = "openai-compat"

    def __init__(self, config: LLMConfig, api_key: str):
        self.config = config
        self.api_key = api_key
        self.base_url = config.base_url.rstrip("/")

    def complete(self, agent: str, system: str, user: str) -> str:
        payload = {
            "model": self.config.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": self.config.temperature,
        }
        last_err: Exception | None = None
        for attempt in range(1, self.config.max_retries + 1):
            try:
                return self._post(payload)
            except LLMError as e:
                last_err = e
                logger.warning(
                    "llm call failed (agent=%s attempt=%d/%d): %s",
                    agent,
                    attempt,
                    self.config.max_retries,
                    e,
                )
                time.sleep(min(2**attempt, 10))
        raise LLMError(f"agent={agent} 重试耗尽: {last_err}")

    def _post(self, payload: dict[str, Any]) -> str:
        req = urllib.request.Request(
            f"{self.base_url}/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=self.config.timeout_s) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", "replace")[:500]
            raise LLMError(f"HTTP {e.code}: {detail}") from e
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            raise LLMError(f"网络错误: {e}") from e
        except json.JSONDecodeError as e:
            raise LLMError(f"响应不是 JSON: {e}") from e

        try:
            content = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError) as e:
            raise LLMError(f"响应结构异常: {json.dumps(data)[:500]}") from e
        if not isinstance(content, str):
            raise LLMError("响应 content 不是字符串")
        return content


class MockProvider:
    """离线 Mock：按 agent 名返回预置 JSON（仅用于测试，不伪造线上结果）。"""

    name = "mock"

    def __init__(self, responses: dict[str, str]):
        self.responses = responses

    def complete(self, agent: str, system: str, user: str) -> str:
        if agent not in self.responses:
            raise LLMError(f"MockProvider 未配置 agent={agent} 的响应")
        return self.responses[agent]


# ---------------------------------------------------------------------------
# JSON 提取
# ---------------------------------------------------------------------------

_FENCE_RE = re.compile(r"```(?:json)?\s*(.*?)```", re.DOTALL)


def extract_json(text: str) -> str:
    """从模型输出中提取 JSON：优先 ```json 围栏，否则截取第一个平衡的 {...} / [...]。"""
    fence = _FENCE_RE.search(text)
    if fence:
        return fence.group(1).strip()

    for opener, closer in (("{", "}"), ("[", "]")):
        start = text.find(opener)
        if start == -1:
            continue
        depth = 0
        in_str = False
        escape = False
        for i in range(start, len(text)):
            ch = text[i]
            if in_str:
                if escape:
                    escape = False
                elif ch == "\\":
                    escape = True
                elif ch == '"':
                    in_str = False
                continue
            if ch == '"':
                in_str = True
            elif ch == opener:
                depth += 1
            elif ch == closer:
                depth -= 1
                if depth == 0:
                    return text[start : i + 1]
    raise ValueError("输出中未找到 JSON")


def parse_json_output(text: str) -> Any:
    return json.loads(extract_json(text))
