"""Differential Fuzzing：std vs brute 在种子化随机输入上逐例比对。

确定性：每个 case 的 (mode, n, seed) 都记录在案，可精确复现。
发现不一致 => 立即保存 Counterexample（input/std/brute/metadata.json）。
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

from acmforge.checker import compare_outputs
from acmforge.console import get_logger
from acmforge.domain.models import ExecutionResult, Verdict
from acmforge.util import sha256_text

logger = get_logger("acmforge.fuzz")

# 生成一个 case 的请求
CaseRequest = tuple[str, int, int]  # (mode, n, seed)


@dataclass
class Counterexample:
    index: int
    mode: str
    n: int
    seed: int
    input_text: str
    std_out: str
    brute_out: str
    reason: str
    dir_path: str = ""
    shrunk: bool = False

    def metadata(self) -> dict:
        return {
            "mode": self.mode,
            "n": self.n,
            "seed": self.seed,
            "input_sha256": sha256_text(self.input_text),
            "reason": self.reason,
            "shrunk": self.shrunk,
        }


@dataclass
class FuzzSummary:
    cases_run: int = 0
    mismatches: int = 0
    counterexamples: list[Counterexample] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


class DifferentialFuzzer:
    """oracle（brute）与 candidate（std）都封装为 run(text)->ExecutionResult。"""

    def __init__(
        self,
        run_candidate: Callable[[bytes], ExecutionResult],
        run_oracle: Callable[[bytes], ExecutionResult],
        gen_case: Callable[[str, int, int], str | None],
        ce_dir: Path,
        max_saved_ce: int = 5,
    ):
        self.run_candidate = run_candidate
        self.run_oracle = run_oracle
        self.gen_case = gen_case  # (mode, n, seed) -> input text
        self.ce_dir = Path(ce_dir)
        self.max_saved_ce = max_saved_ce

    def run(self, cases: list[CaseRequest], stop_on_mismatch: bool = True) -> FuzzSummary:
        summary = FuzzSummary()
        ce_index = 0
        for mode, n, seed in cases:
            text = self.gen_case(mode, n, seed)
            if text is None:
                summary.errors.append(f"gen 失败: mode={mode} n={n} seed={seed}")
                continue

            brute_res = self.run_oracle(text.encode("utf-8"))
            if brute_res.verdict != Verdict.AC:
                # oracle 挂了是环境/题目问题，不是 std 的问题；记录但不算 mismatch
                summary.errors.append(
                    f"oracle 异常 verdict={brute_res.verdict} mode={mode} seed={seed}"
                )
                continue
            std_res = self.run_candidate(text.encode("utf-8"))
            summary.cases_run += 1

            if std_res.verdict != Verdict.AC:
                ce = Counterexample(
                    index=ce_index,
                    mode=mode,
                    n=n,
                    seed=seed,
                    input_text=text,
                    std_out=f"<{std_res.verdict}> {std_res.stderr[:300]}",
                    brute_out=brute_res.stdout,
                    reason=f"std verdict={std_res.verdict}",
                )
                self._save(ce, ce_index)
                summary.counterexamples.append(ce)
                summary.mismatches += 1
                ce_index += 1
                logger.error("differential mismatch: mode=%s n=%s seed=%s (%s)", mode, n, seed, std_res.verdict)
                if stop_on_mismatch:
                    break
                continue

            ok, reason = compare_outputs(brute_res.stdout, std_res.stdout)
            if not ok:
                ce = Counterexample(
                    index=ce_index,
                    mode=mode,
                    n=n,
                    seed=seed,
                    input_text=text,
                    std_out=std_res.stdout,
                    brute_out=brute_res.stdout,
                    reason=reason,
                )
                self._save(ce, ce_index)
                summary.counterexamples.append(ce)
                summary.mismatches += 1
                ce_index += 1
                logger.error("differential mismatch: mode=%s n=%s seed=%s (%s)", mode, n, seed, reason)
                if stop_on_mismatch:
                    break
        return summary

    def _save(self, ce: Counterexample, index: int) -> None:
        d = self.ce_dir / f"ce_{index:03d}"
        d.mkdir(parents=True, exist_ok=True)
        (d / "input.txt").write_text(ce.input_text, encoding="utf-8", newline="\n")
        (d / "std.txt").write_text(ce.std_out, encoding="utf-8", newline="\n")
        (d / "brute.txt").write_text(ce.brute_out, encoding="utf-8", newline="\n")
        (d / "metadata.json").write_text(
            __import__("json").dumps(ce.metadata(), ensure_ascii=False, indent=2),
            encoding="utf-8",
            newline="\n",
        )
        ce.dir_path = str(d)


def make_small_cases(fuzz_cfg, modes: list[str], rng_seed: int) -> list[CaseRequest]:
    """构造对拍 case 列表：只用暴力可解的小规模模式（small/min/tiny/edge）。

    注意：不轮询 "random" —— 某些题的 random 模式会生成暴力不可解的规模
    （如 mod-pow 的 e=10^18）。n 由 rng 在 [1, small_n] 内确定性产生，
    gen 侧把 n 解释为该模式的规模上限。
    """
    rng = random.Random(rng_seed)
    preferred = [m for m in modes if m in ("small", "min", "tiny", "edge")]
    if not preferred:
        preferred = modes[:1] if modes else ["random"]
    cases: list[CaseRequest] = []
    for i in range(fuzz_cfg.smoke_cases):
        mode = preferred[i % len(preferred)]
        n = rng.randint(1, fuzz_cfg.small_n)
        seed = fuzz_cfg.seed + i
        cases.append((mode, n, seed))
    return cases
