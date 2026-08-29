"""ACMForge CLI。

常用命令：
    acmforge spec validate <problem.yaml>
    acmforge run <problem.yaml> [--offline] [--until <node>] [--from <node>] [--smoke]
    acmforge run-cpp <src.cpp> <input.txt> [--tl-ms 2000]
    acmforge resume <run_id> [--from <node>]
    acmforge inspect <run_id | run 目录>
    acmforge runs
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

import typer
import yaml

from acmforge import __version__
from acmforge.checker import compare_outputs
from acmforge.config import load_config
from acmforge.console import get_logger, setup_console
from acmforge.domain.errors import AcmforgeError
from acmforge.domain.models import ProblemSpec, RunStatus, Verdict
from acmforge.util import format_ms

app = typer.Typer(
    name="acmforge",
    no_args_is_help=True,
    add_completion=False,
    help="ACMForge —— ACM 自动出题机（spec → 对拍 → 卡测 → 标准题包）",
)
spec_app = typer.Typer(no_args_is_help=True, help="ProblemSpec 相关命令")
app.add_typer(spec_app, name="spec")

logger = get_logger("acmforge.cli")


def _version_callback(value: bool) -> None:
    if value:
        typer.echo(f"ACMForge v{__version__}")
        raise typer.Exit()


@app.callback()
def main(
    version: bool = typer.Option(
        False, "--version", "-V", callback=_version_callback, is_eager=True, help="显示版本"
    ),
) -> None:
    setup_console()


# ---------------------------------------------------------------------------
# spec validate
# ---------------------------------------------------------------------------


@spec_app.command("validate")
def spec_validate(
    path: Path = typer.Argument(..., exists=True, help="problem.yaml 路径"),
) -> None:
    """解析并用 Pydantic 校验 ProblemSpec。"""
    try:
        spec = load_spec(path)
    except AcmforgeError as e:
        typer.secho(f"✗ 校验失败: {e}", fg=typer.colors.RED)
        raise typer.Exit(1)
    typer.secho(f"✓ ProblemSpec 校验通过: {spec.slug} —— {spec.title}", fg=typer.colors.GREEN)
    typer.echo(f"  样例数: {len(spec.samples)}  时限: {spec.limits.time_ms}ms  内存: {spec.limits.memory_mb}MB")
    typer.echo(f"  目标: rating={spec.target.rating} tags={spec.target.tags}")
    n = spec.constraints.bounds.get("n")
    if isinstance(n, list):
        typer.echo(f"  规模 n: {n[0]:g} ~ {n[1]:g}")


def load_spec(path: Path) -> ProblemSpec:
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
    except yaml.YAMLError as e:
        raise AcmforgeError(f"YAML 解析失败: {e}")
    if not isinstance(data, dict):
        raise AcmforgeError("problem.yaml 顶层必须是映射")
    try:
        return ProblemSpec(**data)
    except Exception as e:
        raise AcmforgeError(f"ProblemSpec 校验失败: {e}")


# ---------------------------------------------------------------------------
# run-cpp
# ---------------------------------------------------------------------------


@app.command("run-cpp")
def run_cpp(
    source: Path = typer.Argument(..., exists=True, help="C++ 源文件"),
    input_file: Path = typer.Argument(..., exists=True, help="stdin 输入文件"),
    tl_ms: int = typer.Option(2000, "--tl-ms", help="时限（毫秒）"),
    expected: Optional[Path] = typer.Option(None, "--expected", help="期望输出文件（可选，用于判定 AC/WA）"),
) -> None:
    """编译并运行单个 C++ 程序，输出 verdict / 用时 / 退出码。"""
    cfg = load_config()
    from acmforge.runner.compiler import Compiler
    from acmforge.runner.local import LocalRunner

    compiler = Compiler(cfg.runner)
    try:
        cr = compiler.compile(source, source.parent / ".acmforge_build", source.stem)
    except AcmforgeError as e:
        typer.secho(f"✗ {e}", fg=typer.colors.RED)
        raise typer.Exit(1)
    if not cr.ok:
        typer.secho("CE（编译失败）", fg=typer.colors.RED)
        typer.echo(cr.compiler_stderr)
        raise typer.Exit(1)

    runner = LocalRunner()
    er = runner.run(cr.exe_path, stdin_bytes=input_file.read_bytes(), timeout_ms=tl_ms)
    verdict = er.verdict
    if verdict == Verdict.AC and expected is not None:
        ok, why = compare_outputs(expected.read_text(encoding="utf-8"), er.stdout)
        if not ok:
            verdict = Verdict.WA
            typer.echo(f"输出不一致: {why}")

    color = typer.colors.GREEN if verdict == Verdict.AC else typer.colors.RED
    typer.secho(f"{verdict.value}", fg=color, bold=True)
    typer.echo(f"  time: {format_ms(er.runtime_ms)}  memory: {er.memory_kb} KB  exit: {er.exit_code}")
    if er.stderr.strip():
        typer.echo(f"  stderr: {er.stderr.strip()[:500]}")
    raise typer.Exit(0 if verdict == Verdict.AC else 1)


# ---------------------------------------------------------------------------
# run（完整流水线）
# ---------------------------------------------------------------------------


@app.command("run")
def run(
    problem: Path = typer.Argument(..., exists=True, help="problem.yaml 路径"),
    config: Optional[Path] = typer.Option(None, "--config", help="覆盖配置文件"),
    offline: bool = typer.Option(False, "--offline", help="禁用 LLM，仅用 spec 自带 assets"),
    until: Optional[str] = typer.Option(None, "--until", help="执行到指定节点为止"),
    from_node: Optional[str] = typer.Option(None, "--from", help="从指定节点开始（重跑）"),
    smoke: bool = typer.Option(False, "--smoke", help="冒烟模式：极小数据量快速跑通"),
) -> None:
    """运行完整出题流水线。"""
    from acmforge.llm.provider import OpenAICompatProvider
    from acmforge.workflow import NodeContext, build_engine

    cfg = load_config(config, offline=offline)
    if smoke:
        cfg.fuzz.smoke_cases = 40
        cfg.fuzz.small_n = 12
        cfg.tests.candidate_batch = 8
        cfg.tests.per_mutant_eval_budget = 18
        cfg.benchmark.repeats = 1
        cfg.benchmark.warmup = 0

    try:
        spec = load_spec(problem)
    except AcmforgeError as e:
        typer.secho(f"✗ {e}", fg=typer.colors.RED)
        raise typer.Exit(1)

    from acmforge.workspace import Workspace

    ws_root = Path(cfg.workspace_dir)
    ws = Workspace.create(ws_root, spec.slug)
    from acmforge.console import attach_file_logger

    attach_file_logger(logger, ws.logs_dir / "run.log")
    logger.info("run %s starts for %s", ws.run_id, spec.slug)

    # 记录 spec 原始位置：resume 时 assets 相对路径要基于原目录解析
    (ws.run_dir / "spec_origin.json").write_text(
        json.dumps(
            {
                "spec_path": str(problem.resolve()),
                "base_dir": str(problem.resolve().parent),
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    provider = None
    if not cfg.offline and cfg.llm.is_enabled():
        provider = OpenAICompatProvider(cfg.llm, cfg.llm.resolve_api_key())
        typer.echo(f"LLM: {cfg.llm.model} @ {cfg.llm.base_url}")
    elif not cfg.offline:
        typer.echo("未配置 LLM API Key，自动进入 offline 模式（使用 spec.assets）")

    ctx = NodeContext(cfg, spec, problem.resolve(), ws, provider)
    engine = build_engine(ctx)

    typer.secho(f"▶ run {ws.run_id} @ {ws.run_dir}", fg=typer.colors.CYAN, bold=True)
    try:
        status = engine.run(until=until, from_node=from_node)
    except AcmforgeError as e:
        typer.secho(f"✗ {e}", fg=typer.colors.RED)
        raise typer.Exit(1)

    state = ws.read_state() or {}
    if status == RunStatus.COMPLETED:
        pkg = ctx.manifest("package") or {}
        typer.secho(f"✓ 完成：{state.get('failed_node') or 'all nodes ok'}", fg=typer.colors.GREEN, bold=True)
        if pkg.get("dir"):
            typer.echo(f"  题包: {ws.resolve(pkg['dir'])}")
            typer.echo(f"  zip : {ws.resolve(pkg['zip']) if pkg.get('zip') else '-'}")
            quality = pkg.get("quality", {})
            typer.echo(
                f"  对拍 {quality.get('differential_cases')} 例 0 mismatch | "
                f"kill {quality.get('mutant_killed')}/{quality.get('mutant_total')} | "
                f"std {format_ms(quality.get('std_max_ms', 0))}/{quality.get('time_limit_ms')}ms | "
                f"决策 {quality.get('decision')}"
            )
    else:
        failed = state.get("failed_node", "?")
        node_info = (state.get("nodes") or {}).get(failed, {})
        typer.secho(f"✗ 流水线在节点 {failed} 失败", fg=typer.colors.RED, bold=True)
        if node_info.get("error"):
            typer.echo(f"  原因: {node_info['error']}")
        raise typer.Exit(1)


# ---------------------------------------------------------------------------
# resume / inspect / runs
# ---------------------------------------------------------------------------


def _find_run(run_id: str) -> Path:
    """按 run_id 或路径定位 run 目录。"""
    p = Path(run_id)
    if p.is_dir() and (p / "state.json").is_file():
        return p
    root = Path(load_config().workspace_dir)
    for cand in root.glob(f"*/runs/{run_id}"):
        if (cand / "state.json").is_file():
            return cand
    raise typer.BadParameter(f"找不到 run: {run_id}（workspace={root}）")


@app.command("resume")
def resume(
    run_id: str = typer.Argument(..., help="run id 或 run 目录路径"),
    from_node: Optional[str] = typer.Option(None, "--from", help="从指定节点开始重跑"),
    until: Optional[str] = typer.Option(None, "--until", help="执行到指定节点为止"),
) -> None:
    """断点续跑。"""
    from acmforge.llm.provider import OpenAICompatProvider
    from acmforge.workflow import NodeContext, build_engine
    from acmforge.workspace import Workspace

    run_dir = _find_run(run_id)
    state = json.loads((run_dir / "state.json").read_text(encoding="utf-8"))
    spec_path = run_dir / "spec.yaml"
    cfg = load_config()
    spec = load_spec(spec_path)

    # 恢复 spec 原始位置（assets 相对路径基于它解析）
    base_dir = run_dir
    origin_file = run_dir / "spec_origin.json"
    if origin_file.is_file():
        origin = json.loads(origin_file.read_text(encoding="utf-8"))
        original = Path(origin["spec_path"])
        if original.is_file():
            spec_path = original
            spec = load_spec(original)
        base_dir = Path(origin["base_dir"])

    ws = Workspace(Path(cfg.workspace_dir), spec.slug, state["run_id"])
    provider = None
    if not cfg.offline and cfg.llm.is_enabled():
        provider = OpenAICompatProvider(cfg.llm, cfg.llm.resolve_api_key())

    ctx = NodeContext(cfg, spec, spec_path, ws, provider, base_dir=base_dir)
    engine = build_engine(ctx)
    typer.secho(f"▶ resume {ws.run_id} from {from_node or '（继续未完成节点）'}", fg=typer.colors.CYAN)
    status = engine.run(until=until, from_node=from_node)
    if status == RunStatus.COMPLETED:
        typer.secho("✓ 完成", fg=typer.colors.GREEN)
    else:
        failed = (ws.read_state() or {}).get("failed_node", "?")
        typer.secho(f"✗ 失败于 {failed}", fg=typer.colors.RED)
        raise typer.Exit(1)


@app.command("inspect")
def inspect(run_id: str = typer.Argument(..., help="run id 或 run 目录路径")) -> None:
    """查看一次 run 的状态与关键指标。"""
    run_dir = _find_run(run_id)
    state = json.loads((run_dir / "state.json").read_text(encoding="utf-8"))
    typer.secho(f"Run {state['run_id']} ({state['slug']}): {state['status']}", bold=True)
    for name in state.get("node_order", []):
        node = state.get("nodes", {}).get(name)
        if not node:
            typer.echo(f"  ○ {name}: pending")
            continue
        mark = {"ok": "✓", "fail": "✗", "skip": "○"}.get(node.get("status"), "?")
        line = f"  {mark} {name}: {node.get('status')}"
        if node.get("metrics"):
            line += f"  {json.dumps(node['metrics'], ensure_ascii=False)[:200]}"
        if node.get("error"):
            line += f"\n      error: {node['error'][:300]}"
        typer.echo(line)
    # 关键 manifest 摘要
    for mf, label in (("benchmark", "benchmark"), ("selection", "selection")):
        p = run_dir / f"{mf}.json"
        if p.is_file():
            data = json.loads(p.read_text(encoding="utf-8"))
            if mf == "benchmark":
                typer.echo(
                    f"  std_max={data.get('std_max_ms', 0):.0f}ms  margin={data.get('margin_ratio')}"
                )
            else:
                typer.echo(
                    f"  selected={len(data.get('selected_ids', []))}  kill_rate={data.get('kill_rate')}"
                )


@app.command("runs")
def runs() -> None:
    """列出所有 run。"""
    root = Path(load_config().workspace_dir)
    found = False
    for state_file in sorted(root.glob("*/runs/*/state.json")):
        found = True
        state = json.loads(state_file.read_text(encoding="utf-8"))
        typer.echo(f"{state['run_id']}  {state['slug']:<20} {state['status']}")
    if not found:
        typer.echo("（还没有任何 run）")


if __name__ == "__main__":
    app()
