"""流水线节点实现。

每个节点：读取前置 manifest -> 执行确定性工作 -> 写 manifest + artifacts。
节点内不做任何 LLM 决策以外的事后判断；所有"是否合格"的判断都基于实际执行结果。
"""

from __future__ import annotations

import random
import shutil
from pathlib import Path

from acmforge.checker import compare_outputs
from acmforge.config import AppConfig
from acmforge.console import get_logger
from acmforge.domain.errors import SpecError
from acmforge.domain.models import (
    Complexity,
    ExecutionResult,
    MutantCategory,
    MutantKind,
    KillRecord,
    NodeResult,
    NodeStatus,
    ProblemSpec,
    SolutionCandidate,
    SolutionRole,
    TestCaseRecord,
    TestStrategy,
    Verdict,
    WrongIdeaSpec,
)
from acmforge.fuzz.differential import (
    DifferentialFuzzer,
    FuzzSummary,
    build_fuzz_plan,
)
from acmforge.fuzz.gen_runner import GenRunner
from acmforge.fuzz.shrinker import shrink_input
from acmforge.mutation.operators import apply_mutations
from acmforge.runner.compiler import Compiler
from acmforge.runner.local import LocalRunner
from acmforge.selection import greedy_select, slow_solution_semantics, summarize_kill_matrix
from acmforge.util import sha256_text, truncate

logger = get_logger("acmforge.nodes")


# ---------------------------------------------------------------------------
# 共享上下文
# ---------------------------------------------------------------------------


class NodeContext:
    def __init__(
        self,
        cfg: AppConfig,
        spec: ProblemSpec,
        spec_path: Path,
        ws,
        provider=None,
        base_dir: Path | None = None,
    ):
        self.cfg = cfg
        self.spec = spec
        self.spec_path = spec_path
        self.ws = ws
        self.provider = provider  # LLMProvider | None
        self.base_dir = base_dir or spec_path.parent
        from acmforge.checkers import make_checker
        from acmforge.validator import BuiltinValidator

        self.checker = make_checker(spec.checker)
        self.validator = BuiltinValidator()

    # -- manifest 便捷 ---------------------------------------------------

    def manifest(self, name: str):
        return self.ws.read_manifest(name)

    def write_manifest(self, name: str, data) -> None:
        self.ws.write_manifest(name, data)

    def warn(self, result: NodeResult, msg: str) -> None:
        result.warnings.append(msg)
        logger.warning(msg)


# ---------------------------------------------------------------------------
# 辅助函数
# ---------------------------------------------------------------------------


def run_solution(exe_path: str, input_text: str, timeout_ms: int, runner) -> ExecutionResult:
    return runner.run(exe_path, stdin_bytes=input_text.encode("utf-8"), timeout_ms=timeout_ms)


def parse_bounds_n(spec: ProblemSpec) -> tuple[int | None, int | None]:
    b = spec.constraints.bounds.get("n")
    if isinstance(b, (list, tuple)) and len(b) == 2:
        try:
            return int(b[0]), int(b[1])
        except (TypeError, ValueError):
            return None, None
    return None, None


def _parse_verdict(value) -> Verdict | None:
    """manifest 反序列化出的 expected_verdict 可能是 dict（enum dump）或 str。"""
    if value is None:
        return None
    if isinstance(value, dict):
        value = value.get("value")
    try:
        return Verdict(str(value))
    except ValueError:
        return None


def _role_for(expected: Verdict) -> SolutionRole:
    if expected == Verdict.TLE:
        return SolutionRole.TLE
    if expected == Verdict.MLE:
        return SolutionRole.MLE
    return SolutionRole.WA


def judge_against_answer(
    er: ExecutionResult, expected_answer: str, checker=None
) -> tuple[Verdict, bool]:
    """以正确答案为基准判定：TLE/RE/MLE 直接击杀；正常退出则用 checker 比对输出。"""
    if er.verdict != Verdict.AC:
        return er.verdict, True
    compare = checker.compare if checker is not None else compare_outputs
    ok, _why = compare(expected_answer, er.stdout)
    if not ok:
        return Verdict.WA, True
    return Verdict.AC, False


def order_candidates_for_mutant(
    candidates: list[TestCaseRecord], expected_tle: bool
) -> list[TestCaseRecord]:
    """评估顺序：优先级高的先测；TLE 变异体在同级里先跑大规模，其余先跑小规模。"""

    def key(tc: TestCaseRecord):
        size = -tc.size_bytes if expected_tle else tc.size_bytes
        return (-tc.priority, size)

    return sorted(candidates, key=key)


# ---------------------------------------------------------------------------
# Node 1: load_spec
# ---------------------------------------------------------------------------


def node_load_spec(ctx: NodeContext) -> NodeResult:
    result = NodeResult()
    spec = ctx.spec

    # 语义校验（Pydantic 已做结构校验）
    n_min, n_max = parse_bounds_n(spec)
    if n_min is not None and n_min < 1:
        raise SpecError(f"bounds.n 最小值必须 >= 1，得到 {n_min}")

    # spec 快照
    snap = ctx.ws.run_dir / "spec.yaml"
    shutil.copyfile(ctx.spec_path, snap)
    ctx.ws.record_artifact(snap, "config", "load_spec")

    result.metrics = {
        "slug": spec.slug,
        "title": spec.title,
        "samples": len(spec.samples),
        "time_limit_ms": spec.limits.time_ms,
        "n_max": n_max,
    }
    return result


# ---------------------------------------------------------------------------
# Node 2: prepare_solutions
# ---------------------------------------------------------------------------


def _read_asset(ctx: NodeContext, rel: str) -> str:
    p = (ctx.base_dir / rel).resolve()
    if not p.is_file():
        raise SpecError(f"assets 引用的文件不存在: {rel}")
    return p.read_text(encoding="utf-8")


def node_prepare_solutions(ctx: NodeContext) -> NodeResult:
    result = NodeResult()
    spec = ctx.spec
    assets = spec.assets
    use_llm = ctx.provider is not None and not ctx.cfg.offline

    sol_dir = ctx.ws.solutions_dir

    # --- std ---
    if assets.std:
        code = _read_asset(ctx, assets.std)
        origin = "import"
        idea, complexity = "", None
    elif use_llm:
        from acmforge.agents.solver import SolverAgent

        agent = SolverAgent(ctx.provider, ctx.ws.logs_dir / "llm_calls.jsonl")
        sol, meta = agent.solve(spec)
        code, origin, idea, complexity = sol.code, "llm", sol.idea_summary, sol.complexity
        logger.info("std generated by LLM (%s), idea: %s", meta["model"], idea[:80])
    else:
        raise SpecError(
            "offline 模式且未配置 LLM：spec 必须提供 assets.std（或配置 ACMFORGE_API_KEY 启用 LLM 生成）"
        )
    std_path = ctx.ws.next_version_path(sol_dir, "std", ".cpp")
    std_path.write_text(code, encoding="utf-8", newline="\n")
    ctx.ws.record_artifact(std_path, "source_code", "prepare_solutions")

    # --- brute ---
    if assets.brute:
        bcode, borigin, bapproach = _read_asset(ctx, assets.brute), "import", ""
    elif use_llm:
        from acmforge.agents.brute import BruteAgent

        agent = BruteAgent(ctx.provider, ctx.ws.logs_dir / "llm_calls.jsonl")
        sol, _meta = agent.solve(spec)
        bcode, borigin, bapproach = sol.code, "llm", sol.approach
    else:
        raise SpecError("offline 模式且未配置 LLM：spec 必须提供 assets.brute")
    brute_path = ctx.ws.next_version_path(sol_dir, "brute", ".cpp")
    brute_path.write_text(bcode, encoding="utf-8", newline="\n")
    ctx.ws.record_artifact(brute_path, "source_code", "prepare_solutions")

    # --- gen.py ---
    if assets.gen:
        gcode, gmodes, gorigin = _read_asset(ctx, assets.gen), [], "import"
        gen_path = sol_dir / "gen.py"
        gen_path.write_text(gcode, encoding="utf-8", newline="\n")
        gmodes = GenRunner(gen_path).modes()  # 询问支持的模式
    elif use_llm:
        from acmforge.agents.generator import GeneratorAgent
        from acmforge.fuzz.gen_runner import assert_gen_safe

        agent = GeneratorAgent(ctx.provider, ctx.ws.logs_dir / "llm_calls.jsonl")
        sol, _meta = agent.design(spec)
        assert_gen_safe(sol.code)  # LLM 生成器落盘前的静态安全检查
        gen_path = sol_dir / "gen.py"
        gen_path.write_text(sol.code, encoding="utf-8", newline="\n")
        gcode, gmodes, gorigin = sol.code, sol.modes, "llm"
    else:
        raise SpecError("offline 模式且未配置 LLM：spec 必须提供 assets.gen")

    ctx.ws.record_artifact(gen_path, "gen", "prepare_solutions")

    # gen.py 冒烟测试：声明的每个模式跑一次（seed=1）
    runner_gen = GenRunner(gen_path)
    smoke_modes = gmodes or runner_gen.modes()
    if not smoke_modes:
        smoke_modes = ["random"]
    for m in smoke_modes:
        out = runner_gen.run(m, seed=1)
        if not out.ok or not out.text.strip():
            raise SpecError(f"gen.py 模式 {m} 冒烟测试失败: {out.error or '空输出'}")

    ctx.write_manifest(
        "solutions",
        {
            "std": {
                "path": ctx.ws.rel(std_path),
                "version": std_path.stem,
                "origin": origin,
                "idea_summary": idea,
                "complexity": complexity.model_dump() if complexity else None,
            },
            "brute": {
                "path": ctx.ws.rel(brute_path),
                "version": brute_path.stem,
                "origin": borigin,
                "approach": bapproach,
            },
            "gen": {
                "path": ctx.ws.rel(gen_path),
                "origin": gorigin,
                "modes": smoke_modes,
            },
        },
    )
    result.metrics = {"std": std_path.name, "brute": brute_path.name, "gen_modes": smoke_modes}
    return result


# ---------------------------------------------------------------------------
# Node 3: compile_solutions
# ---------------------------------------------------------------------------


def node_compile_solutions(ctx: NodeContext) -> NodeResult:
    result = NodeResult()
    manifest = ctx.manifest("solutions")
    compiler = Compiler(ctx.cfg.runner)

    sol_dir = ctx.ws.solutions_dir

    def compile_one(rel_path: str, name: str) -> dict:
        src = ctx.ws.resolve(rel_path)
        cr = compiler.compile(src, sol_dir, name)
        return {"ok": cr.ok, "exe": cr.exe_path, "stderr": truncate(cr.compiler_stderr, 3000)}

    std_info = compile_one(manifest["std"]["path"], manifest["std"]["version"])
    attempts = 0
    while not std_info["ok"] and ctx.provider is not None and not ctx.cfg.offline:
        attempts += 1
        if attempts > ctx.cfg.repair.max_attempts:
            break
        logger.warning("std 编译失败，第 %d 次修复...", attempts)
        from acmforge.agents.solver import SolverAgent

        agent = SolverAgent(ctx.provider, ctx.ws.logs_dir / "llm_calls.jsonl")
        sol, _meta = agent.repair(
            ctx.spec,
            previous_code=ctx.ws.resolve(manifest["std"]["path"]).read_text(encoding="utf-8"),
            previous_version=manifest["std"]["version"],
            ce_input="(compile error)",
            ce_std_out=std_info["stderr"],
            ce_brute_out="(not run)",
        )
        new_path = ctx.ws.next_version_path(sol_dir, "std", ".cpp")
        new_path.write_text(sol.code, encoding="utf-8", newline="\n")
        ctx.ws.record_artifact(new_path, "source_code", "compile_repair")
        manifest["std"] = {
            "path": ctx.ws.rel(new_path),
            "version": new_path.stem,
            "origin": "llm-repair",
            "idea_summary": sol.idea_summary,
            "complexity": sol.complexity.model_dump(),
        }
        std_info = compile_one(manifest["std"]["path"], manifest["std"]["version"])

    if not std_info["ok"]:
        result.status = NodeStatus.FAIL
        result.error = f"std 编译失败（{manifest['std']['path']}）:\n{std_info['stderr']}"
        return result

    brute_info = compile_one(manifest["brute"]["path"], manifest["brute"]["version"])
    if not brute_info["ok"] and ctx.provider is not None and not ctx.cfg.offline:
        from acmforge.agents.brute import BruteAgent

        agent = BruteAgent(ctx.provider, ctx.ws.logs_dir / "llm_calls.jsonl")
        sol, _meta = agent.solve(ctx.spec)
        new_path = ctx.ws.next_version_path(sol_dir, "brute", ".cpp")
        new_path.write_text(sol.code, encoding="utf-8", newline="\n")
        ctx.ws.record_artifact(new_path, "source_code", "compile_repair")
        manifest["brute"] = {
            "path": ctx.ws.rel(new_path),
            "version": new_path.stem,
            "origin": "llm-retry",
            "approach": sol.approach,
        }
        brute_info = compile_one(manifest["brute"]["path"], manifest["brute"]["version"])

    if not brute_info["ok"]:
        result.status = NodeStatus.FAIL
        result.error = f"brute 编译失败:\n{brute_info['stderr']}"
        return result

    manifest["std"].update({"compile": std_info, "compile_repairs": attempts})
    manifest["brute"].update({"compile": brute_info})
    ctx.write_manifest("solutions", manifest)

    result.metrics = {
        "std_version": manifest["std"]["version"],
        "std_compile_ms": std_info.get("stderr") is not None,
    }
    return result


# ---------------------------------------------------------------------------
# Node 4: differential_fuzz
# ---------------------------------------------------------------------------


def node_differential_fuzz(ctx: NodeContext) -> NodeResult:
    result = NodeResult()
    manifest = ctx.manifest("solutions")
    std_exe = manifest["std"]["compile"]["exe"]
    brute_exe = manifest["brute"]["compile"]["exe"]
    gen = GenRunner(ctx.ws.resolve(manifest["gen"]["path"]))
    modes = manifest["gen"]["modes"]
    runner = LocalRunner()
    tl = ctx.spec.limits.time_ms
    ml = ctx.spec.limits.memory_mb

    def run_std(data: bytes) -> ExecutionResult:
        return runner.run(std_exe, stdin_bytes=data, timeout_ms=tl, memory_mb=ml)

    def run_brute(data: bytes) -> ExecutionResult:
        return runner.run(brute_exe, stdin_bytes=data, timeout_ms=max(tl * 10, 30000), memory_mb=ml)

    def gen_case(mode: str, n: int, seed: int) -> str | None:
        # 只负责产出原文；合法性由 fuzzer 内部 validator 判定并分类计数
        out = gen.run(mode, seed=seed, n=n)
        return out.text if out.ok and out.text.strip() else None

    def oracle_can_handle(mode: str) -> bool:
        """P0-8：探针 —— 该模式缩小到 small_n 后暴力是否可解；不可解则记录跳过。"""
        out = gen.run(mode, seed=ctx.cfg.fuzz.seed, n=ctx.cfg.fuzz.small_n)
        if not out.ok or not out.text.strip():
            return False
        vr = ctx.validator.validate(out.text, ctx.spec)
        if vr.status == "fail":
            return False
        br = run_brute(out.text.encode("utf-8"))
        if br.verdict == Verdict.TLE:
            return False
        return True

    fuzzer = DifferentialFuzzer(
        run_std,
        run_brute,
        gen_case,
        ctx.ws.ce_dir,
        checker=ctx.checker,
        validator=ctx.validator,
        spec=ctx.spec,
    )

    # P0-8：带 per-mode 覆盖的对拍计划（不可缩小的模式显式记录跳过原因）
    cases, mode_skips = build_fuzz_plan(ctx.cfg.fuzz, modes, oracle_can_handle)
    for m, reason in mode_skips.items():
        ctx.warn(result, f"fuzz 模式 {m} 跳过 oracle 覆盖: {reason}")

    def validity_gate_fail(s: FuzzSummary) -> str | None:
        """P0-7：有效 case 太少或 oracle 失败过多 => 不能当 correctness PASS。

        仅对跑完全程的 run 生效：stop_on_mismatch 提前停止的 run 由 mismatch 路径处理。
        """
        if not s.completed:
            return None
        if s.oracle_errors > ctx.cfg.fuzz.max_oracle_errors:
            return (
                f"fuzz 有效性门禁未通过: oracle 失败 {s.oracle_errors} 次 "
                f"> 允许上限 {ctx.cfg.fuzz.max_oracle_errors}（有效 case {s.cases_run}/{s.cases_requested}）"
            )
        ratio = s.validity_ratio()
        if s.cases_run < int(s.cases_requested * ctx.cfg.fuzz.min_success_ratio):
            return (
                f"fuzz 有效性门禁未通过: 有效 case {s.cases_run}/{s.cases_requested} "
                f"({ratio:.0%}) < 最低要求 {ctx.cfg.fuzz.min_success_ratio:.0%}"
                f"（gen 错误 {s.generator_errors}，validator 拒绝 {s.validator_errors}）"
            )
        return None

    summary = fuzzer.run(cases)
    gate_error = validity_gate_fail(summary)

    attempts = 0
    max_attempts = 0 if (ctx.provider is None or ctx.cfg.offline) else ctx.cfg.repair.max_attempts
    fresh_summary: FuzzSummary | None = None
    holdout_summary: FuzzSummary | None = None

    while summary.mismatches > 0:
        ce = summary.counterexamples[-1]

        # 最小化反例
        if ctx.cfg.fuzz.shrink:
            def still_bad(text: str) -> bool:
                # P0-2：收缩候选必须仍是合法输入（FAIL 级非法直接拒绝）
                vr = ctx.validator.validate(text, ctx.spec)
                if vr.status == "fail":
                    return False
                b = run_brute(text.encode("utf-8"))
                if b.verdict != Verdict.AC:
                    return False
                s = run_std(text.encode("utf-8"))
                if s.verdict != Verdict.AC:
                    return True
                ok, _ = ctx.checker.compare(b.stdout, s.stdout)
                return not ok

            shrunk, improved, evals = shrink_input(
                ce.input_text, still_bad, max_evals=ctx.cfg.fuzz.shrink_max_evals
            )
            if improved and still_bad(shrunk):
                ce.input_text = shrunk
                ce.shrunk = True
                ce.std_out = run_std(ce.input_text.encode("utf-8")).stdout
                ce.brute_out = run_brute(ce.input_text.encode("utf-8")).stdout
                # 重新落盘
                ce_dir = ctx.ws.ce_dir / f"ce_{ce.index:03d}"
                (ce_dir / "input.txt").write_text(ce.input_text, encoding="utf-8", newline="\n")
                (ce_dir / "std.txt").write_text(ce.std_out, encoding="utf-8", newline="\n")
                (ce_dir / "brute.txt").write_text(ce.brute_out, encoding="utf-8", newline="\n")
                (ce_dir / "metadata.json").write_text(
                    __import__("json").dumps(ce.metadata(), ensure_ascii=False, indent=2),
                    encoding="utf-8",
                    newline="\n",
                )
                ctx.ws.record_artifact(ce_dir / "input.txt", "counterexample", "shrinker")
            logger.info(
                "counterexample ce_%03d shrunk=%s evals=%d size=%d bytes",
                ce.index,
                improved,
                evals,
                len(ce.input_text),
            )

        if gate_error:
            # 有效性门禁失败优先于修复循环：不可信的 fuzz 不能驱动 repair
            result.status = NodeStatus.FAIL
            result.error = gate_error
            break

        if attempts >= max_attempts:
            result.status = NodeStatus.FAIL
            result.error = (
                f"differential mismatch 未能在 {max_attempts} 次修复内解决，"
                f"反例见 {ce.dir_path or ctx.ws.rel(ctx.ws.ce_dir)}：{ce.reason}"
            )
            break

        attempts += 1
        logger.warning("std 与 brute 不一致（attempt %d/%d），调用 Solver 修复...", attempts, max_attempts)
        from acmforge.agents.solver import SolverAgent

        agent = SolverAgent(ctx.provider, ctx.ws.logs_dir / "llm_calls.jsonl")
        current_code = ctx.ws.resolve(manifest["std"]["path"]).read_text(encoding="utf-8")
        sol, _meta = agent.repair(
            ctx.spec,
            previous_code=current_code,
            previous_version=manifest["std"]["version"],
            ce_input=ce.input_text,
            ce_std_out=ce.std_out,
            ce_brute_out=ce.brute_out,
        )
        new_path = ctx.ws.next_version_path(ctx.ws.solutions_dir, "std", ".cpp")
        new_path.write_text(sol.code, encoding="utf-8", newline="\n")
        ctx.ws.record_artifact(new_path, "source_code", "solver_repair")
        cr = Compiler(ctx.cfg.runner).compile(new_path, ctx.ws.solutions_dir, new_path.stem)
        if not cr.ok:
            logger.warning("修复版本编译失败，跳过: %s", truncate(cr.compiler_stderr, 300))
            continue
        std_exe = cr.exe_path
        manifest["std"] = {
            **manifest["std"],
            "path": ctx.ws.rel(new_path),
            "version": new_path.stem,
            "origin": "llm-repair",
            "idea_summary": sol.idea_summary,
            "compile": {"ok": True, "exe": cr.exe_path, "stderr": ""},
        }
        # 修复版本成为当前有效版本后必须立即持久化（P0-1）
        ctx.write_manifest("solutions", manifest)
        # 回归对拍（原 corpus）
        summary = fuzzer.run(cases)
        gate_error = validity_gate_fail(summary)

    # 有效性门禁（独立于修复循环）：mismatches==0 但有效 case 不足同样不能 PASS
    if gate_error is not None and result.status != NodeStatus.FAIL:
        result.status = NodeStatus.FAIL
        result.error = gate_error

    # P0-9：repair 之后必须额外通过 fresh + holdout 两套全新语料（repair agent 看不到 holdout）
    if (
        summary.mismatches == 0
        and gate_error is None
        and attempts > 0
        and result.status != NodeStatus.FAIL
    ):
        def offset_cases(offset: int, count: int) -> list:
            rng = random.Random(ctx.cfg.fuzz.seed + offset)
            preferred = [m for m in modes if m in ("small", "min", "tiny", "edge")] or modes[:1]
            return [
                (preferred[i % len(preferred)], rng.randint(1, ctx.cfg.fuzz.small_n),
                 ctx.cfg.fuzz.seed + offset + i)
                for i in range(count)
            ]

        fresh_cases = offset_cases(ctx.cfg.fuzz.fresh_seed_offset, ctx.cfg.fuzz.fresh_cases_after_repair)
        holdout_cases = offset_cases(ctx.cfg.fuzz.holdout_seed_offset, ctx.cfg.fuzz.holdout_cases_after_repair)
        fresh_summary = fuzzer.run(fresh_cases, stop_on_mismatch=True)
        holdout_summary = fuzzer.run(holdout_cases, stop_on_mismatch=True)
        fresh_gate = validity_gate_fail(fresh_summary)
        holdout_gate = validity_gate_fail(holdout_summary)
        if fresh_summary.mismatches > 0 or fresh_gate:
            result.status = NodeStatus.FAIL
            result.error = (
                f"repair 后 fresh 语料验证失败: mismatches={fresh_summary.mismatches}"
                f"{'; ' + fresh_gate if fresh_gate else ''}"
            )
        elif holdout_summary.mismatches > 0 or holdout_gate:
            result.status = NodeStatus.FAIL
            result.error = (
                f"repair 后 holdout 语料验证失败: mismatches={holdout_summary.mismatches}"
                f"{'; ' + holdout_gate if holdout_gate else ''}"
            )

    # 样例校验：样例答案必须由程序给出，且与 std/brute 一致
    sample_issues: list[str] = []
    sample_answers: list[str] = []
    for i, sample in enumerate(ctx.spec.samples, 1):
        s_res = run_std(sample.input.encode("utf-8"))
        b_res = run_brute(sample.input.encode("utf-8"))
        if s_res.verdict != Verdict.AC or b_res.verdict != Verdict.AC:
            sample_issues.append(f"样例 {i} 运行异常: std={s_res.verdict} brute={b_res.verdict}")
            sample_answers.append("")
            continue
        ok1, why1 = ctx.checker.compare(b_res.stdout, s_res.stdout)
        if not ok1:
            sample_issues.append(f"样例 {i} std 与 brute 输出不一致: {why1}")
        if sample.expected_output:
            ok2, why2 = ctx.checker.compare(sample.expected_output, s_res.stdout)
            if not ok2:
                sample_issues.append(f"样例 {i} 与 spec 给定的期望输出不一致: {why2}")
        sample_answers.append(s_res.stdout.strip())

    ctx.write_manifest(
        "fuzz",
        {
            "cases_requested": summary.cases_requested,
            "cases_generated": summary.cases_generated,
            "cases_valid": summary.cases_valid,
            "cases_run": summary.cases_run,
            "mismatches": summary.mismatches,
            "generator_errors": summary.generator_errors,
            "validator_errors": summary.validator_errors,
            "oracle_errors": summary.oracle_errors,
            "mode_skips": mode_skips,
            "attempts": attempts,
            "std_version": manifest["std"]["version"],
            "std_path": manifest["std"]["path"],
            "counterexamples": [
                {"index": c.index, "dir": ctx.ws.rel(Path(c.dir_path)) if c.dir_path else "", **c.metadata()}
                for c in summary.counterexamples
            ],
            "gen_errors": summary.errors[:20],
            "sample_issues": sample_issues,
            "sample_answers": sample_answers,
            "fresh_holdout": {
                "fresh_cases": fresh_summary.cases_run if fresh_summary else 0,
                "fresh_mismatches": fresh_summary.mismatches if fresh_summary else None,
                "holdout_cases": holdout_summary.cases_run if holdout_summary else 0,
                "holdout_mismatches": holdout_summary.mismatches if holdout_summary else None,
            }
            if (fresh_summary is not None or holdout_summary is not None)
            else None,
        },
    )

    if result.status == NodeStatus.FAIL and result.error:
        return result

    if summary.mismatches > 0:
        result.status = NodeStatus.FAIL
        result.error = f"differential fuzz 仍有 {summary.mismatches} 个反例（{manifest['std']['version']}）"
        return result

    if sample_issues:
        result.status = NodeStatus.FAIL
        result.error = "样例校验失败: " + "; ".join(sample_issues)
        return result

    result.metrics = {
        "cases_run": summary.cases_run,
        "cases_valid": summary.cases_valid,
        "mismatches": summary.mismatches,
        "repair_attempts": attempts,
        "mode_skips": len(mode_skips),
        "std_version": manifest["std"]["version"],
    }
    return result



def node_generate_mutants(ctx: NodeContext) -> NodeResult:
    result = NodeResult()
    manifest = ctx.manifest("solutions")
    std_code = ctx.ws.resolve(manifest["std"]["path"]).read_text(encoding="utf-8")
    compiler = Compiler(ctx.cfg.runner)

    candidates: list[SolutionCandidate] = []
    seen_hashes: set[str] = set()
    duplicates_dropped = 0
    ideas_accepted: list[dict] = []

    def add_candidate(c: SolutionCandidate) -> bool:
        nonlocal duplicates_dropped
        h = sha256_text(c.code)
        if h in seen_hashes:
            duplicates_dropped += 1
            return False
        seen_hashes.add(h)
        d = ctx.ws.mutants_dir / c.id
        src = d / "src.cpp"
        src.parent.mkdir(parents=True, exist_ok=True)
        src.write_text(c.code, encoding="utf-8", newline="\n")
        c.path = ctx.ws.rel(src)
        cr = compiler.compile(src, d, "mutant")
        c.compile_ok = cr.ok
        c.compile_stderr = truncate(cr.compiler_stderr, 2000)
        c.exe_path = cr.exe_path
        if not cr.ok:
            c.enabled = False
        candidates.append(c)
        ctx.ws.record_artifact(src, "source_code", "generate_mutants")
        return True

    # 1) 导入的 mutants（assets）
    for i, m in enumerate(ctx.spec.assets.mutants, 1):
        rel = m.get("path") if isinstance(m, dict) else str(m)
        code = _read_asset(ctx, rel)
        category = (m.get("category", "IMPLEMENTATION_BUG") if isinstance(m, dict) else "IMPLEMENTATION_BUG").upper()
        try:
            cat = MutantCategory(category)
        except ValueError:
            cat = MutantCategory.IMPLEMENTATION_BUG
        expected = (m.get("expected_verdict", "WA") if isinstance(m, dict) else "WA").upper()
        expected = Verdict.TLE if expected == "TLE" else (Verdict.MLE if expected == "MLE" else Verdict.WA)
        add_candidate(
            SolutionCandidate(
                id=f"mutant_import_{i:03d}",
                role=_role_for(expected),
                code=code,
                origin="import",
                origin_detail=rel,
                mutant_kind=MutantKind.SLOW_SOLUTION if expected in (Verdict.TLE, Verdict.MLE) else MutantKind.IMPORTED,
                category=cat,
                description=m.get("description", rel) if isinstance(m, dict) else rel,
                expected_verdict=expected,
            )
        )

    # 2) 源码变异（确定性 baseline，kind=SOURCE_MUTANT）
    if ctx.cfg.mutants.source_mutations:
        for op, site, mutated in apply_mutations(std_code):
            add_candidate(
                SolutionCandidate(
                    id=f"mutant_mut_{op.name}_{site}",
                    role=SolutionRole.TLE if op.expected_verdict == "TLE" else SolutionRole.WA,
                    code=mutated,
                    origin="mutation",
                    origin_detail=f"operator={op.name} site={site}",
                    mutant_kind=MutantKind.SOURCE_MUTANT,
                    category=op.category,
                    description=op.description,
                    expected_verdict=Verdict.WA if op.expected_verdict != "TLE" else Verdict.TLE,
                )
            )

    # 3) LLM 错误解（两段式：ProblemSpec → WrongIdeaSpec → Wrong Solution）
    if ctx.provider is not None and not ctx.cfg.offline and ctx.cfg.mutants.llm_count > 0:
        from acmforge.agents.mutant import MutantIdeaAgent, MutantSolutionAgent

        idea_agent = MutantIdeaAgent(ctx.provider, ctx.ws.logs_dir / "llm_calls.jsonl")
        sol_agent = MutantSolutionAgent(ctx.provider, ctx.ws.logs_dir / "llm_calls.jsonl")
        try:
            ideas_out, _meta = idea_agent.design_ideas(ctx.spec, std_code, ctx.cfg.mutants.llm_count)
        except Exception as e:
            ctx.warn(result, f"WrongIdeaSpec 生成失败（继续用已有变异体）: {truncate(str(e), 300)}")
            ideas_out = None

        if ideas_out is not None:
            for idea in ideas_out.ideas[: ctx.cfg.mutants.llm_count]:
                try:
                    cat = MutantCategory(idea.category)
                except ValueError:
                    cat = MutantCategory.IMPLEMENTATION_BUG
                idea_dict = idea.model_dump()
                idea_dict["category"] = cat.value
                idea_dict["claimed_complexity"] = {"time": idea.claimed_complexity, "memory": ""}
                try:
                    sol_out, _m = sol_agent.design_for_idea(ctx.spec, std_code, idea_dict)
                except Exception as e:
                    ctx.warn(result, f"mutant 代码生成失败（idea={idea.id}）: {truncate(str(e), 200)}")
                    continue
                expected = Verdict.TLE if sol_out.expected_verdict == "TLE" else (
                    Verdict.MLE if sol_out.expected_verdict == "MLE" else Verdict.WA
                )
                if cat == MutantCategory.TLE:
                    expected = Verdict.TLE
                ok = add_candidate(
                    SolutionCandidate(
                        id=f"mutant_idea_{idea.id}",
                        role=_role_for(expected),
                        code=sol_out.code,
                        origin="llm",
                        origin_detail=f"wrong_idea={idea.id}",
                        mutant_kind=MutantKind.SLOW_SOLUTION if expected in (Verdict.TLE, Verdict.MLE) else MutantKind.LLM_IDEA_MUTANT,
                        wrong_idea=WrongIdeaSpec(
                            id=idea.id,
                            category=cat,
                            title=idea.title,
                            reasoning_summary=idea.reasoning_summary,
                            why_plausible=idea.why_plausible,
                            claimed_complexity=Complexity(time=idea.claimed_complexity),
                            expected_failure_patterns=idea.expected_failure_patterns,
                            counterexample_shape=idea.counterexample_shape,
                            target_constraints=idea.target_constraints,
                        ),
                        category=cat,
                        description=sol_out.description or idea.title,
                        expected_verdict=expected,
                        idea_summary=idea.title,
                    )
                )
                if ok:
                    ideas_accepted.append(idea_dict)

    # 超出上限的丢弃
    if len(candidates) > ctx.cfg.mutants.max_total:
        for c in candidates[ctx.cfg.mutants.max_total :]:
            c.enabled = False
        ctx.warn(result, f"mutant 数量超上限，禁用了 {len(candidates) - ctx.cfg.mutants.max_total} 个")

    enabled = [c for c in candidates if c.enabled]
    if not enabled:
        result.status = NodeStatus.FAIL
        result.error = "没有任何可用的变异体（全部编译失败或为空）"
        return result

    written = len(candidates)
    compile_failed = sum(1 for c in candidates if c.compile_ok is False)
    ctx.write_manifest(
        "mutants",
        {
            "candidates": [c.model_dump(mode="json") for c in candidates],
            "enabled_ids": [c.id for c in enabled],
            "ideas_accepted": ideas_accepted,
            "metrics": {
                "total": written + duplicates_dropped,
                "written": written,
                "duplicates_dropped": duplicates_dropped,
                "compile_failed": compile_failed,
                "enabled": len(enabled),
                "kinds": {
                    k: sum(1 for c in candidates if c.enabled and c.mutant_kind and c.mutant_kind.value == k)
                    for k in ("SOURCE_MUTANT", "LLM_IDEA_MUTANT", "SLOW_SOLUTION", "IMPORTED")
                },
            },
        },
    )
    result.metrics = {
        "total": written + duplicates_dropped,
        "enabled": len(enabled),
        "duplicates_dropped": duplicates_dropped,
        "compile_failed": compile_failed,
        "kinds": {
            k: sum(1 for c in candidates if c.enabled and c.mutant_kind and c.mutant_kind.value == k)
            for k in ("SOURCE_MUTANT", "LLM_IDEA_MUTANT", "SLOW_SOLUTION", "IMPORTED")
        },
    }
    return result


# ---------------------------------------------------------------------------
# Node 6: design_tests
# ---------------------------------------------------------------------------


def builtin_strategies(ctx: NodeContext, modes: list[str]) -> list[TestStrategy]:
    n_min, n_max = parse_bounds_n(ctx.spec)
    out: list[TestStrategy] = []

    def has(m: str) -> bool:
        return m in modes

    if has("min"):
        out.append(TestStrategy(name="min", purpose="最小规模", mode="min", priority=90))
    if has("max"):
        out.append(TestStrategy(name="max", purpose="最大规模", mode="max", priority=100))
    if has("random"):
        out.append(TestStrategy(name="random_small", purpose="小随机（正确性）", mode="random", params={"n": 20}, count=8, seeds=[], priority=20))
        out.append(TestStrategy(name="random_mid", purpose="中随机", mode="random", params={"n": min(2000, n_max or 2000)}, count=4, priority=30))
        if n_max:
            out.append(TestStrategy(name="random_large", purpose="大随机", mode="random", params={"n": n_max}, count=2, priority=40))
    for m in modes:
        if m in ("min", "max", "random"):
            continue
        out.append(TestStrategy(name=m, purpose=f"对抗模式 {m}", mode=m, priority=80))
    return out


def node_design_tests(ctx: NodeContext) -> NodeResult:
    result = NodeResult()
    manifest = ctx.manifest("solutions")
    modes = manifest["gen"]["modes"]
    strategies = builtin_strategies(ctx, modes)

    # LLM 策略
    if ctx.provider is not None and not ctx.cfg.offline:
        mutants_manifest = ctx.manifest("mutants") or {}
        from acmforge.agents.test_designer import TestDesignerAgent

        agent = TestDesignerAgent(ctx.provider, ctx.ws.logs_dir / "llm_calls.jsonl")
        try:
            set_out, _meta = agent.design(ctx.spec, modes, mutants_manifest.get("candidates", []))
            known = set(modes)
            for s in set_out.strategies:
                if s.mode not in known:
                    ctx.warn(result, f"LLM 策略 {s.name} 使用未知模式 {s.mode}，已丢弃")
                    continue
                strategies.append(
                    TestStrategy(
                        name=s.name,
                        purpose=s.purpose,
                        mode=s.mode,
                        params=s.params,
                        count=s.count,
                        priority=s.priority,
                        target_mutants=s.target_mutants,
                        origin="llm",
                    )
                )
        except Exception as e:
            ctx.warn(result, f"LLM 测试策略生成失败（使用内置策略）: {e}")

    # 去重
    seen: set[str] = set()
    unique: list[TestStrategy] = []
    for s in strategies:
        if s.name in seen:
            continue
        seen.add(s.name)
        unique.append(s)

    ctx.write_manifest("test_plan", {"strategies": [s.model_dump(mode="json") for s in unique]})
    result.metrics = {"strategies": len(unique), "llm_strategies": sum(1 for s in unique if s.origin == "llm")}
    return result


# ---------------------------------------------------------------------------
# Node 7: generate_candidates
# ---------------------------------------------------------------------------


def expand_strategies(ctx: NodeContext, strategies: list[TestStrategy], start_seed: int) -> list[tuple[TestStrategy, int, int]]:
    """展开为 (strategy, index, seed)。seed 确定性分配。"""
    plans: list[tuple[TestStrategy, int, int]] = []
    n_min, n_max = parse_bounds_n(ctx.spec)
    seed = start_seed
    for s in strategies:
        seeds = s.seeds or []
        for i in range(s.count):
            if i < len(seeds):
                use_seed = seeds[i]
            else:
                use_seed = seed
                seed += 1
            plans.append((s, i, use_seed))
    return plans


def generate_corpus_batch(
    ctx: NodeContext,
    strategies: list[TestStrategy],
    start_seed: int,
    tid_prefix: str = "",
) -> tuple[list[TestCaseRecord], list[str]]:
    """执行策略生成候选测试，std 计算答案。返回 (records, warnings)。"""
    from acmforge.runner.local import LocalRunner

    warnings: list[str] = []
    manifest = ctx.manifest("solutions")
    std_exe = manifest["std"]["compile"]["exe"]
    gen = GenRunner(ctx.ws.resolve(manifest["gen"]["path"]))
    runner = LocalRunner()
    tl = ctx.spec.limits.time_ms

    # 已有语料（增量轮次时复用 tid）
    existing = ctx.manifest("corpus") or {"records": []}
    records: list[TestCaseRecord] = [TestCaseRecord(**r) for r in existing.get("records", [])]
    seen_input_sha = {r.input_sha256 for r in records if r.input_sha256}
    max_n = len(records)

    plans = expand_strategies(ctx, strategies, start_seed)
    for strategy, idx, seed in plans:
        n_param = strategy.params.get("n")
        out = gen.run(strategy.mode, seed=seed, n=n_param)
        if not out.ok or not out.text.strip():
            warnings.append(f"策略 {strategy.name}#{idx} gen 失败: {out.error}")
            continue
        text = out.text
        # P0-2：generator 产出必须过 validator，非法输入不进入验证链
        vr = ctx.validator.validate(text, ctx.spec)
        if vr.status == "fail":
            warnings.append(f"策略 {strategy.name}#{idx} 生成非法输入被拒绝: {vr.reason}")
            continue
        input_sha = sha256_text(text)
        if input_sha in seen_input_sha:
            continue
        seen_input_sha.add(input_sha)

        # 答案由已验证的 std 计算
        ans = runner.run(std_exe, stdin_bytes=text.encode("utf-8"), timeout_ms=max(tl * 2, 5000), memory_mb=ctx.spec.limits.memory_mb)
        if ans.verdict != Verdict.AC:
            warnings.append(f"策略 {strategy.name}#{idx} 上 std 异常({ans.verdict})，跳过该候选")
            continue

        max_n += 1
        tid = f"{tid_prefix}{strategy.name}_{max_n:04d}"
        in_path = ctx.ws.corpus_dir / f"{tid}.in"
        ans_path = ctx.ws.corpus_dir / f"{tid}.ans"
        in_path.write_text(text, encoding="utf-8", newline="\n")
        ans_path.write_text(ans.stdout, encoding="utf-8", newline="\n")
        records.append(
            TestCaseRecord(
                id=tid,
                strategy=strategy.name,
                mode=strategy.mode,
                params=strategy.params,
                seed=seed,
                input_path=ctx.ws.rel(in_path),
                answer_path=ctx.ws.rel(ans_path),
                input_sha256=input_sha,
                answer_sha256=sha256_text(ans.stdout),
                size_bytes=len(text.encode("utf-8")),
                priority=strategy.priority,
            )
        )

    ctx.write_manifest("corpus", {"records": [r.model_dump(mode="json") for r in records]})
    return records, warnings


def node_generate_candidates(ctx: NodeContext) -> NodeResult:
    result = NodeResult()

    # 样例也进入语料（必须保留进最终测试集）
    sample_strategies = [
        TestStrategy(
            name=f"sample_{i}",
            purpose="题面样例",
            mode="__sample__",
            params={"text": s.input},
            priority=95,
            origin="builtin",
        )
        for i, s in enumerate(ctx.spec.samples, 1)
    ]
    real_strategies = [
        TestStrategy(**s)
        for s in (ctx.manifest("test_plan") or {}).get("strategies", [])
    ]

    from acmforge.runner.local import LocalRunner

    manifest = ctx.manifest("solutions")
    std_exe = manifest["std"]["compile"]["exe"]
    runner = LocalRunner()

    records: list[TestCaseRecord] = []
    warnings: list[str] = []
    existing = ctx.manifest("corpus") or {"records": []}
    records = [TestCaseRecord(**r) for r in existing.get("records", [])]
    max_n = len(records)
    existing_strategies = {r.strategy for r in records}

    for s in sample_strategies:
        if s.name in existing_strategies:
            continue  # resume 重跑：样例已在语料中，跳过（幂等，不重写文件）
        text = s.params["text"]
        # 样例同样是输入数据：非法样例说明 spec 本身有错
        sample_vr = ctx.validator.validate(text, ctx.spec)
        if sample_vr.status == "fail":
            result.status = NodeStatus.FAIL
            result.error = f"样例输入未通过 validator: {sample_vr.reason}（spec 数据错误）"
            return result
        tid = f"{s.name}_{max_n + 1:04d}"
        max_n += 1
        in_path = ctx.ws.corpus_dir / f"{tid}.in"
        ans_path = ctx.ws.corpus_dir / f"{tid}.ans"
        in_path.write_text(text, encoding="utf-8", newline="\n")
        ans = runner.run(std_exe, stdin_bytes=text.encode("utf-8"), timeout_ms=max(ctx.spec.limits.time_ms * 2, 5000), memory_mb=ctx.spec.limits.memory_mb)
        if ans.verdict != Verdict.AC:
            result.status = NodeStatus.FAIL
            result.error = f"样例 {s.name} 上 std 运行异常: {ans.verdict}"
            return result
        ans_path.write_text(ans.stdout, encoding="utf-8", newline="\n")
        records.append(
            TestCaseRecord(
                id=tid,
                strategy=s.name,
                mode="sample",
                seed=0,
                input_path=ctx.ws.rel(in_path),
                answer_path=ctx.ws.rel(ans_path),
                input_sha256=sha256_text(text),
                answer_sha256=sha256_text(ans.stdout),
                size_bytes=len(text.encode("utf-8")),
                priority=s.priority,
            )
        )

    ctx.write_manifest("corpus", {"records": [r.model_dump(mode="json") for r in records]})

    batch, warnings2 = generate_corpus_batch(ctx, real_strategies, start_seed=ctx.cfg.fuzz.seed + 1_000_000)
    warnings.extend(warnings2)

    all_records = (ctx.manifest("corpus") or {}).get("records", [])
    for w in warnings:
        ctx.warn(result, w)
    result.metrics = {"candidates": len(all_records), "samples": len(sample_strategies)}
    return result


# ---------------------------------------------------------------------------
# Node 8: kill_matrix（含追加轮次）
# ---------------------------------------------------------------------------


def _analyze_survivors(
    ctx: NodeContext, survivor_ids: list[str], candidates: dict[str, dict]
) -> list[dict]:
    """调用 SurvivorAnalyzer 分析幸存者；失败返回空列表（由调用方退回随机策略）。"""
    from acmforge.agents.survivor import SurvivorAnalyzerAgent

    modes = ctx.manifest("solutions")["gen"]["modes"]
    strategies = [
        f"{s['name']} (mode={s['mode']}, params={s.get('params')})"
        for s in (ctx.manifest("test_plan") or {}).get("strategies", [])
    ]
    survivors = []
    for mid in survivor_ids:
        c = candidates[mid]
        survivors.append(
            {
                "id": mid,
                "category": c.get("category", ""),
                "description": c.get("description", ""),
                "expected_verdict": str(c.get("expected_verdict", "WA")),
            }
        )
    try:
        agent = SurvivorAnalyzerAgent(ctx.provider, ctx.ws.logs_dir / "llm_calls.jsonl")
        out, _meta = agent.analyze(ctx.spec, modes, survivors, strategies)
        return [
            {
                "target_mutant_id": a.target_mutant_id,
                "why_survived": a.why_survived,
                "required_structure": a.required_structure,
                "required_scale": a.required_scale,
                "required_edge_case": a.required_edge_case,
                "mode": a.mode,
                "generator_parameters": a.generator_parameters,
                "purpose": a.purpose,
            }
            for a in out.analyses
        ]
    except Exception as e:
        logger.warning("survivor 分析失败: %s", e)
        return []


def node_kill_matrix(ctx: NodeContext) -> NodeResult:
    from acmforge.runner.local import LocalRunner

    result = NodeResult()
    runner = LocalRunner()
    tl = ctx.spec.limits.time_ms
    mutants_manifest = ctx.manifest("mutants")
    enabled_ids = mutants_manifest["enabled_ids"]
    candidates = {c["id"]: c for c in mutants_manifest["candidates"] if c["enabled"]}

    must_include: list[str] = []
    corpus_records = [TestCaseRecord(**r) for r in (ctx.manifest("corpus") or {}).get("records", [])]
    for r in corpus_records:
        # 样例、min/max 边界、以及所有高优先级对抗测试都强制进入最终测试集
        if r.strategy.startswith("sample_") or r.strategy in ("min", "max") or r.priority >= 80:
            must_include.append(r.id)

    all_records: list[KillRecord] = []
    rounds = 0
    selection = None
    kill_rate = 0.0
    rounds_log: list[dict] = []

    def _survivors_now() -> list[str]:
        killed_set = {r.solution_id for r in all_records if r.killed}
        return [m for m in enabled_ids if m not in killed_set]

    for round_no in range(1, ctx.cfg.tests.max_rounds + 1):
        rounds = round_no
        corpus_records = [TestCaseRecord(**r) for r in (ctx.manifest("corpus") or {}).get("records", [])]

        for mid in enabled_ids:
            # 已在早前轮次被击杀的 mutant 跳过增量评估
            if any(r.solution_id == mid and r.killed for r in all_records):
                continue
            cand = candidates[mid]
            expected_tle = cand["expected_verdict"] == "TLE"
            ordered = order_candidates_for_mutant(corpus_records, expected_tle)
            budget = ctx.cfg.tests.per_mutant_eval_budget
            kills = 0
            for tc in ordered:
                if budget <= 0 or kills >= 3:
                    break
                budget -= 1
                input_text = ctx.ws.resolve(tc.input_path).read_text(encoding="utf-8")
                expected = ctx.ws.resolve(tc.answer_path).read_text(encoding="utf-8")
                er = runner.run(
                    candidates[mid]["exe_path"],
                    stdin_bytes=input_text.encode("utf-8"),
                    timeout_ms=tl,
                    memory_mb=ctx.spec.limits.memory_mb,
                )
                verdict, killed = judge_against_answer(er, expected, ctx.checker)
                if killed:
                    kills += 1
                expected_verdict = _parse_verdict(candidates[mid].get("expected_verdict"))
                all_records.append(
                    KillRecord(
                        testcase_id=tc.id,
                        solution_id=mid,
                        verdict=verdict,
                        runtime_ms=er.runtime_ms,
                        memory_kb=er.memory_kb,
                        killed=killed,
                        expected_verdict=expected_verdict,
                        expected_failure_hit=(verdict == expected_verdict) if expected_verdict else False,
                    )
                )

        mutant_ids = list(candidates.keys())
        selection = greedy_select(all_records, mutant_ids, must_include)
        kill_rate = selection.kill_rate
        logger.info("round %d: kill_rate=%.3f unkillable=%d", round_no, kill_rate, len(selection.unkillable))

        round_entry: dict = {
            "round": round_no,
            "kill_rate": kill_rate,
            "survivors": _survivors_now(),
            "action": "done",
            "analyses": [],
        }

        if kill_rate >= ctx.cfg.tests.min_kill_rate:
            rounds_log.append(round_entry)
            break

        if round_no >= ctx.cfg.tests.max_rounds:
            round_entry["action"] = "max_rounds_reached"
            rounds_log.append(round_entry)
            break

        # 幸存者反馈闭环（Phase F）：优先做定向分析；无 LLM 时退回随机追加
        targeted: list[TestStrategy] = []
        if ctx.provider is not None and not ctx.cfg.offline and round_entry["survivors"]:
            analyses = _analyze_survivors(ctx, round_entry["survivors"], candidates)
            round_entry["analyses"] = analyses
            known_modes = set(ctx.manifest("solutions")["gen"]["modes"])
            for a in analyses:
                if a.get("mode") not in known_modes:
                    ctx.warn(result, f"survivor 分析给出未知模式 {a.get('mode')!r}，已丢弃（{a.get('target_mutant_id')}）")
                    continue
                targeted.append(
                    TestStrategy(
                        name=f"targeted_r{round_no}_{a.get('target_mutant_id', 'x')}",
                        purpose=a.get("purpose") or a.get("why_survived", "")[:200],
                        mode=a["mode"],
                        params=a.get("generator_parameters") or {},
                        count=1,
                        priority=100,
                        origin="survivor",
                    )
                )
            round_entry["action"] = "survivor_analysis" if targeted else "survivor_analysis_failed"

        if not targeted:
            # fallback：随机追加（确定性种子延续）
            random_strats = [
                TestStrategy(**s)
                for s in (ctx.manifest("test_plan") or {}).get("strategies", [])
                if s["mode"] == "random"
            ]
            if not random_strats:
                round_entry["action"] = "no_fallback_strategies"
                rounds_log.append(round_entry)
                break
            targeted = random_strats
            round_entry["action"] = "random_batch"

        # 把本轮策略固化进 test_plan（可回溯：为什么生成这些测试）
        plan = ctx.manifest("test_plan") or {"strategies": []}
        plan["strategies"].extend([t.model_dump(mode="json") for t in targeted])
        ctx.write_manifest("test_plan", plan)

        _, warns = generate_corpus_batch(
            ctx,
            targeted,
            start_seed=ctx.cfg.fuzz.seed + 2_000_000 * round_no,
            tid_prefix=f"r{round_no}_",
        )
        for w in warns:
            ctx.warn(result, w)
        rounds_log.append(round_entry)

    if selection is None:
        result.status = NodeStatus.FAIL
        result.error = "kill matrix 未产生任何结果"
        return result

    matrix_summary = summarize_kill_matrix(all_records, list(candidates.keys()))
    ctx.write_manifest(
        "kill_matrix",
        {
            "records": [r.model_dump(mode="json") for r in all_records],
            "selection": selection.model_dump(mode="json"),
            "rounds": rounds,
            "rounds_log": rounds_log,
            "summary": matrix_summary,
        },
    )

    result.metrics = {
        "rounds": rounds,
        "kill_rate": kill_rate,
        "unkillable": selection.unkillable,
        "candidate_count": len(corpus_records),
    }
    if kill_rate < ctx.cfg.tests.min_kill_rate:
        msg = (
            f"kill rate {kill_rate:.3f} < 目标 {ctx.cfg.tests.min_kill_rate}；"
            f"未击杀: {', '.join(selection.unkillable)}"
        )
        if ctx.cfg.tests.enforce_kill_rate:
            result.status = NodeStatus.FAIL
            result.error = msg
        else:
            ctx.warn(result, msg)
    return result


# ---------------------------------------------------------------------------
# Node 9: select_tests
# ---------------------------------------------------------------------------


def node_select_tests(ctx: NodeContext) -> NodeResult:
    result = NodeResult()
    km = ctx.manifest("kill_matrix")
    selection = km["selection"]
    corpus_records = [TestCaseRecord(**r) for r in (ctx.manifest("corpus") or {}).get("records", [])]
    by_id = {r.id: r for r in corpus_records}

    selected = [tid for tid in selection["selected_ids"] if tid in by_id]
    if not selected:
        result.status = NodeStatus.FAIL
        result.error = "没有选中任何测试"
        return result

    # 复制到 tests/（最终测试集）
    for tid in selected:
        src_in = ctx.ws.resolve(by_id[tid].input_path)
        src_ans = ctx.ws.resolve(by_id[tid].answer_path)
        (ctx.ws.tests_dir / f"{tid}.in").write_text(
            src_in.read_text(encoding="utf-8"), encoding="utf-8", newline="\n"
        )
        (ctx.ws.tests_dir / f"{tid}.ans").write_text(
            src_ans.read_text(encoding="utf-8"), encoding="utf-8", newline="\n"
        )

    ctx.write_manifest(
        "selection",
        {
            "selected_ids": selected,
            "must_include_ids": selection.get("must_include_ids", []),
            "kill_rate": selection["kill_rate"],
            "unkillable": selection.get("unkillable", []),
            "coverage": selection.get("coverage", {}),
        },
    )
    ctx.ws.record_artifact(ctx.ws.tests_dir / f"{selected[0]}.in", "testcase", "select_tests")
    result.metrics = {"selected": len(selected), "kill_rate": selection["kill_rate"]}
    return result


# ---------------------------------------------------------------------------
# Node 10: final_verify（最终击杀矩阵复核 + std benchmark）
# ---------------------------------------------------------------------------


def node_final_verify(ctx: NodeContext) -> NodeResult:
    from acmforge.runner.local import LocalRunner

    result = NodeResult()
    runner = LocalRunner()
    tl = ctx.spec.limits.time_ms

    manifest = ctx.manifest("solutions")
    std_exe = manifest["std"]["compile"]["exe"]
    mutants_manifest = ctx.manifest("mutants")
    candidates = {c["id"]: c for c in mutants_manifest["candidates"] if c["enabled"]}
    selection = ctx.manifest("selection")
    selected = selection["selected_ids"]

    # 1) 最终击杀矩阵：mutant × selected
    final_records: list[KillRecord] = []
    for mid, cand in candidates.items():
        for tid in selected:
            input_text = (ctx.ws.tests_dir / f"{tid}.in").read_text(encoding="utf-8")
            expected = (ctx.ws.tests_dir / f"{tid}.ans").read_text(encoding="utf-8")
            er = runner.run(cand["exe_path"], stdin_bytes=input_text.encode("utf-8"), timeout_ms=tl, memory_mb=ctx.spec.limits.memory_mb)
            verdict, killed = judge_against_answer(er, expected, ctx.checker)
            expected_verdict = _parse_verdict(cand.get("expected_verdict"))
            final_records.append(
                KillRecord(
                    testcase_id=tid,
                    solution_id=mid,
                    verdict=verdict,
                    runtime_ms=er.runtime_ms,
                    memory_kb=er.memory_kb,
                    killed=killed,
                    expected_verdict=expected_verdict,
                    expected_failure_hit=(verdict == expected_verdict) if expected_verdict else False,
                )
            )

    summary = summarize_kill_matrix(final_records, list(candidates.keys()))
    # P0-5：慢解语义验证 —— 小规模（样例/min）上必须 AC 才配称"错误复杂度解"
    corpus_records = [TestCaseRecord(**r) for r in (ctx.manifest("corpus") or {}).get("records", [])]
    selected_set = set(selected)
    small_test_ids = {
        r.id for r in corpus_records
        if r.id in selected_set and (r.strategy.startswith("sample_") or r.strategy == "min")
    }
    resource_semantics: dict[str, dict] = {}
    for mid, cand in candidates.items():
        ev = _parse_verdict(cand.get("expected_verdict"))
        if ev not in (Verdict.TLE, Verdict.MLE):
            continue
        recs = [r for r in final_records if r.solution_id == mid]
        resource_semantics[mid] = slow_solution_semantics(recs, ev, small_test_ids)
    tle_ids = [m for m, c in candidates.items() if _parse_verdict(c.get("expected_verdict")) == Verdict.TLE]
    tle_semantically_valid = [m for m in tle_ids if resource_semantics[m]["semantically_valid"]]
    tle_actually_tled = [m for m in tle_ids if resource_semantics[m]["semantically_valid"] and resource_semantics[m]["expected_failure_hit"]]
    mle_ids = [m for m, c in candidates.items() if _parse_verdict(c.get("expected_verdict")) == Verdict.MLE]
    mle_actually_mled = [m for m in mle_ids if resource_semantics[m]["semantically_valid"] and resource_semantics[m]["expected_failure_hit"]]

    # 2) std benchmark：warmup + repeats
    bench_cfg = ctx.cfg.benchmark
    points = []
    std_max_ms = 0.0
    for tid in selected:
        input_bytes = (ctx.ws.tests_dir / f"{tid}.in").read_bytes()
        times: list[float] = []
        mem_kb: int | None = None
        for rep in range(bench_cfg.warmup + bench_cfg.repeats):
            er = runner.run(std_exe, stdin_bytes=input_bytes, timeout_ms=max(tl * 3, 10000), memory_mb=ctx.spec.limits.memory_mb)
            if er.verdict != Verdict.AC:
                result.status = NodeStatus.FAIL
                result.error = f"benchmark 中 std 在 {tid} 上异常: {er.verdict}（{er.stderr[:200]}）"
                return result
            if rep >= bench_cfg.warmup:
                times.append(er.runtime_ms)
                if er.memory_kb:
                    mem_kb = max(mem_kb or 0, er.memory_kb)
        times.sort()
        median = times[len(times) // 2] if times else 0.0
        mx = max(times) if times else 0.0
        std_max_ms = max(std_max_ms, mx)
        points.append({"testcase_id": tid, "median_ms": median, "max_ms": mx, "memory_kb": mem_kb})

    margin = std_max_ms / tl if tl else 0.0
    benchmark_passed = margin <= bench_cfg.std_target_ratio

    ctx.write_manifest(
        "final_verify",
        {
            "records": [r.model_dump(mode="json") for r in final_records],
            "summary": summary,
            "tle_mutants": {"total": len(tle_ids), "killed": tle_actually_tled},
            "resource_semantics": {
                "tle_candidates_total": len(tle_ids),
                "tle_semantically_valid": tle_semantically_valid,
                "tle_actually_tled": tle_actually_tled,
                "mle_candidates_total": len(mle_ids),
                "mle_actually_mled": mle_actually_mled,
                "detail": resource_semantics,
            },
        },
    )
    ctx.write_manifest(
        "benchmark",
        {
            "points": points,
            "std_max_ms": std_max_ms,
            "time_limit_ms": tl,
            "margin_ratio": round(margin, 4),
            "passed": benchmark_passed,
        },
    )

    result.metrics = {
        "final_kill_rate": summary["kill_rate"],
        "tle_semantically_valid": f"{len(tle_semantically_valid)}/{len(tle_ids)}",
        "tle_actually_tled": f"{len(tle_actually_tled)}/{len(tle_ids)}",
        "std_max_ms": round(std_max_ms, 1),
        "margin_ratio": round(margin, 3),
    }

    if summary["kill_rate"] < ctx.cfg.tests.min_kill_rate:
        msg = f"最终 kill rate {summary['kill_rate']:.3f} < 目标 {ctx.cfg.tests.min_kill_rate}"
        if ctx.cfg.tests.enforce_kill_rate:
            result.status = NodeStatus.FAIL
            result.error = msg
        else:
            ctx.warn(result, msg)
    if not benchmark_passed:
        msg = f"std 最大用时 {std_max_ms:.0f}ms 超过目标的 {bench_cfg.std_target_ratio:.0%} TL"
        if bench_cfg.enforce_std_margin:
            result.status = NodeStatus.FAIL
            result.error = msg
        else:
            ctx.warn(result, msg)
    return result
