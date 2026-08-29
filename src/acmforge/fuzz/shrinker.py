"""输入最小化（Shrinker）。

v0.1 采用通用保守策略：按行删除 + 行内 token 缩短，每次修改后重新验证
"仍然触发失败"才接受。不做格式感知的复杂收缩（后续版本接入 gen 感知策略）。
"""

from __future__ import annotations

from typing import Callable

# is_bad(input_text) -> bool：输入是否仍然触发失败（如 std != brute）
Predicate = Callable[[str], bool]


def _try_line_removals(text: str, is_bad: Predicate, max_evals: int) -> tuple[str, int]:
    evals = 0
    lines = text.split("\n")
    i = 0
    while i < len(lines) and evals < max_evals:
        candidate = "\n".join(lines[:i] + lines[i + 1 :])
        evals += 1
        if candidate.strip() and is_bad(candidate):
            lines = lines[:i] + lines[i + 1 :]
            # 不前进 i：同一位置可能还能继续删
        else:
            i += 1
    return "\n".join(lines), evals


def _try_token_shrink(text: str, is_bad: Predicate, max_evals: int) -> tuple[str, int]:
    """把行内每个大整数 token 逐个替换为其一半，仍失败则接受。"""
    evals = 0
    lines = text.split("\n")
    for li, line in enumerate(lines):
        toks = line.split()
        if len(toks) > 200:  # 超长行不做 token 收缩（代价过高）
            continue
        for ti, tok in enumerate(toks):
            if evals >= max_evals:
                return "\n".join(lines), evals
            if tok.lstrip("+-").isdigit() and abs(int(tok)) > 1:
                shrunk = str(int(tok) // 2)
                new_line = " ".join(toks[:ti] + [shrunk] + toks[ti + 1 :])
                candidate_lines = lines[:li] + [new_line] + lines[li + 1 :]
                candidate = "\n".join(candidate_lines)
                evals += 1
                if is_bad(candidate):
                    lines = candidate_lines
                    toks = new_line.split()
    return "\n".join(lines), evals


def shrink_input(
    text: str,
    is_bad: Predicate,
    max_evals: int = 200,
    token_shrink: bool = True,
) -> tuple[str, bool, int]:
    """最小化反例。

    返回 (最小化文本, 是否有改进, 评估次数)。
    所有修改仅在"失败仍复现"时被接受 —— 反例性质永不丢失。
    """
    original = text
    evals = 0
    improved = False

    text, used = _try_line_removals(text, is_bad, max_evals - evals)
    evals += used
    improved = improved or (text != original)

    if token_shrink and evals < max_evals:
        text2, used = _try_token_shrink(text, is_bad, max_evals - evals)
        evals += used
        improved = improved or (text2 != text)
        text = text2

    return text, improved, evals
