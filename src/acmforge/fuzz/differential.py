"""Differential Fuzzing：std vs brute 在种子化随机输入上逐例比对。

确定性：每个 case 的 (mode, n, seed) 都记录在案，可精确复现。
发现不一致 => 立即保存 Counterexample（input/std/brute/metadata.json）。

v0.1.1 硬化：
- 输入必须过 validator（FAIL 级非法输入计入 validator_errors，不作为有效 case）
- FuzzSummary 记录 requested/generated/valid 与三类错误计数，供有效性门禁判定
- "mismatches == 0" 不再等价于通过：有效 case 太少或 oracle 失败过多必须 FAIL
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

from acmforge.checkers import Checker, ExactTokenChecker
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
    validation_status: str = "pass"

    def metadata(self) -> dict:
        return {
            "mode": self.mode,
            "n": self.n,
            "seed": self.seed,
            "input_sha256": sha256_text(self.input_text),
            "reason": self.reason,
            "shrunk": self.shrunk,
            "validation_status": self.validation_status,
        }


@dataclass
class FuzzSummary:
    cases_requested: int = 0
    cases_generated: int = 0
    cases_valid: int = 0  # 通过 validator 并真正执行的 case 数
    cases_run: int = 0
    mismatches: int = 0
    generator_errors: int = 0
    validator_errors: int = 0
    oracle_errors: int = 0
    counterexamples: list[Counterexample] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    # 是否跑完全部计划 case（stop_on_mismatch 提前停止时为 False，此时有效性门禁不适用）
    completed: bool = False

    def validity_ratio(self) -> float:
        if self.cases_requested <= 0:
            return 0.0
        return self.cases_valid / self.cases_requested


class DifferentialFuzzer:
    """oracle（brute）与 candidate（std）都封装为 run(text)->ExecutionResult。"""

    def __init__(
        self,
        run_candidate: Callable[[bytes], ExecutionResult],
        run_oracle: Callable[[bytes], ExecutionResult],
        gen_case: Callable[[str, int, int], str | None],
        ce_dir: Path,
        max_saved_ce: int = 5,
        checker: Checker | None = None,
        validator=None,
        spec=None,
    ):
        self.run_candidate = run_candidate
        self.run_oracle = run_oracle
        self.gen_case = gen_case  # (mode, n, seed) -> input text
        self.ce_dir = Path(ce_dir)
        self.max_saved_ce = max_saved_ce
        self.checker = checker or ExactTokenChecker()
        self.validator = validator
        self.spec = spec

    def run(self, cases: list[CaseRequest], stop_on_mismatch: bool = True) -> FuzzSummary:
        summary = FuzzSummary(cases_requested=len(cases))
        stopped = False
        ce_index = 0
        for mode, n, seed in cases:
            text = self.gen_case(mode, n, seed)
            if text is None or not text.strip():
                summary.generator_errors += 1
                summary.errors.append(f"gen 失败: mode={mode} n={n} seed={seed}")
                continue
            summary.cases_generated += 1

            # P0-2：非法输入不进入验证链，也不计入有效 case
            if self.validator is not None and self.spec is not None:
                vr = self.validator.validate(text, self.spec)
                if vr.status == "fail":
                    summary.validator_errors += 1
                    summary.errors.append(
                        f"validator 拒绝: mode={mode} seed={seed}: {vr.reason}"
                    )
                    continue
                case_validation = vr.status
            else:
                case_validation = "unknown"

            brute_res = self.run_oracle(text.encode("utf-8"))
            if brute_res.verdict != Verdict.AC:
                # oracle 挂了是环境/题目问题，不是 std 的问题；单独计数，供门禁判定
                summary.oracle_errors += 1
                summary.errors.append(
                    f"oracle 异常 verdict={brute_res.verdict} mode={mode} seed={seed}"
                )
                continue

            std_res = self.run_candidate(text.encode("utf-8"))
            summary.cases_valid += 1
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
                    validation_status=case_validation,
                )
                self._save(ce, ce_index)
                summary.counterexamples.append(ce)
                summary.mismatches += 1
                ce_index += 1
                logger.error(
                    "differential mismatch: mode=%s n=%s seed=%s (%s)", mode, n, seed, std_res.verdict
                )
                if stop_on_mismatch:
                    stopped = True
                    break
                continue

            ok, reason = self.checker.compare(brute_res.stdout, std_res.stdout)
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
                    validation_status=case_validation,
                )
                self._save(ce, ce_index)
                summary.counterexamples.append(ce)
                summary.mismatches += 1
                ce_index += 1
                logger.error(
                    "differential mismatch: mode=%s n=%s seed=%s (%s)", mode, n, seed, reason
                )
                if stop_on_mismatch:
                    stopped = True
                    break
        summary.completed = not stopped
        return summary

    def _save(self, ce: Counterexample, index: int) -> None:
        import json

        d = self.ce_dir / f"ce_{index:03d}"
        d.mkdir(parents=True, exist_ok=True)
        (d / "input.txt").write_text(ce.input_text, encoding="utf-8", newline="\n")
        (d / "std.txt").write_text(ce.std_out, encoding="utf-8", newline="\n")
        (d / "brute.txt").write_text(ce.brute_out, encoding="utf-8", newline="\n")
        (d / "metadata.json").write_text(
            json.dumps(ce.metadata(), ensure_ascii=False, indent=2),
            encoding="utf-8",
            newline="\n",
        )
        ce.dir_path = str(d)


def make_small_cases(fuzz_cfg, modes: list[str], rng_seed: int) -> list[CaseRequest]:
    """基础对拍 case：只用暴力可解的小规模模式（small/min/tiny/edge）轮询。

    注意：不轮询 "random" —— 某些题的 random 模式会生成暴力不可解的规模。
    对抗模式的覆盖由 build_fuzz_plan 的 per-mode 覆盖补齐。
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


def build_fuzz_plan(
    fuzz_cfg,
    modes: list[str],
    oracle_can_handle: Callable[[str], bool],
) -> tuple[list[CaseRequest], dict[str, str]]:
    """构造带 per-mode 覆盖的对拍计划（P0-8）。

    - 每个声明模式先做一次 oracle 探针（小规模）：无法缩小规模的模式
      （如 mod-pow 的 max）不硬跑暴力，记录 skip 原因，绝不默默跳过。
    - 可覆盖的模式各跑 per_mode_cases 个 case（n 限制在 small_n 内）。
    - 其余额度用 small/min/tiny/edge 轮询补齐到 smoke_cases。
    """
    rng = random.Random(fuzz_cfg.seed)
    skips: dict[str, str] = {}
    coverable: list[str] = []
    for m in modes:
        if oracle_can_handle(m):
            coverable.append(m)
        else:
            skips[m] = "oracle 探针失败：该模式无法缩小到暴力可解规模"

    cases: list[CaseRequest] = []
    per_mode = max(0, getattr(fuzz_cfg, "per_mode_cases", 0))
    seed_counter = 0
    for m in coverable:
        for _ in range(per_mode):
            cases.append((m, rng.randint(1, fuzz_cfg.small_n), fuzz_cfg.seed + 3_000_000 + seed_counter))
            seed_counter += 1

    preferred = [m for m in modes if m in ("small", "min", "tiny", "edge")] or coverable[:1]
    for i in range(fuzz_cfg.smoke_cases):
        mode = preferred[i % len(preferred)]
        cases.append((mode, rng.randint(1, fuzz_cfg.small_n), fuzz_cfg.seed + i))
    return cases, skips
