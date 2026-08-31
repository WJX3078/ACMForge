"""token 工具（独立模块，避免循环导入）。"""

from __future__ import annotations

import re

_FLOAT_RE = re.compile(r"^[+-]?(\d+\.\d*|\.\d+|\d+)([eE][+-]?\d+)?$")
_TOKEN_RE = re.compile(r"\S+")


def tokenize(text: str) -> list[str]:
    return _TOKEN_RE.findall(text)


def is_float_token(token: str) -> bool:
    return bool(_FLOAT_RE.match(token))
