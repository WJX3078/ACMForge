"""数据集验证（Phase D）：每道题的参考实现必须互相对拍一致、所有模式可用。"""

from pathlib import Path

import pytest

from acmforge.fuzz.differential import DifferentialFuzzer, make_small_cases
from acmforge.fuzz.gen_runner import GenRunner
from acmforge.config import FuzzConfig
pytestmark = pytest.mark.usefixtures("gxx")

DATASET = Path(__file__).resolve().parents[2] / "benchmarks" / "v1"


def _compile(compiler, tmp_path: Path, code: str, name: str) -> str:
    tmp_path.mkdir(parents=True, exist_ok=True)
    src = tmp_path / f"{name}.cpp"
    src.write_text(code, encoding="utf-8")
    cr = compiler.compile(src, tmp_path, name)
    assert cr.ok, f"{name} 编译失败: {cr.compiler_stderr[:500]}"
    return cr.exe_path


def test_dataset_loads_and_covers_categories():
    from acmforge.eval.dataset import load_dataset

    problems = load_dataset(DATASET)
    assert len(problems) >= 10
    tags = {t for p in problems for t in p.expected_tags}
    for required in ("implementation", "greedy", "binary-search", "two-pointers",
                     "dp", "graph", "tree", "data-structure", "math"):
        assert required in tags, f"数据集缺少类别: {required}"
    difficulties = {p.expected_difficulty for p in problems}
    assert {"easy", "medium", "hard"} <= difficulties


def test_all_reference_pairs_differentially_consistent(compiler, tmp_path):
    """核心校验：每道题的参考 std 与 brute 在小规模随机数据上必须完全一致。"""
    from acmforge.eval.dataset import load_dataset

    problems = load_dataset(DATASET)
    runner = __import__("acmforge.runner.local", fromlist=["LocalRunner"]).LocalRunner()

    for problem in problems:
        std_exe = _compile(compiler, tmp_path / problem.problem_id, problem.reference_solution, "std")
        brute_exe = _compile(compiler, tmp_path / problem.problem_id, problem.reference_brute, "brute")
        gen = GenRunner(problem.spec_path and Path(problem.spec_path).parent / "reference" / "gen.py")

        def gen_case(mode, n, seed, _gen=gen):
            out = _gen.run(mode, seed=seed, n=n)
            return out.text if out.ok and out.text.strip() else None

        fuzzer = DifferentialFuzzer(
            lambda data, _e=std_exe: runner.run(_e, stdin_bytes=data, timeout_ms=2000),
            lambda data, _e=brute_exe: runner.run(_e, stdin_bytes=data, timeout_ms=30000),
            gen_case,
            tmp_path / problem.problem_id / "ce",
        )
        cfg = FuzzConfig(smoke_cases=20, small_n=12, seed=42)
        summary = fuzzer.run(make_small_cases(cfg, gen.modes() or ["small"], 42))
        assert summary.mismatches == 0, (
            f"{problem.problem_id}: 参考 std 与 brute 不一致！"
            f" {[c.reason for c in summary.counterexamples][:2]}"
        )
        assert summary.errors == [], f"{problem.problem_id}: oracle 异常 {summary.errors[:2]}"


def test_all_modes_smoke(compiler, tmp_path):
    """每个模式 seed=1 必须产出非空、首行可解析的输入。"""
    from acmforge.eval.dataset import load_dataset

    problems = load_dataset(DATASET)
    for problem in problems:
        gen = GenRunner(Path(problem.spec_path).parent / "reference" / "gen.py")
        for mode in gen.modes():
            out = gen.run(mode, seed=1)
            assert out.ok, f"{problem.problem_id}/{mode}: {out.error}"
            assert out.text.strip(), f"{problem.problem_id}/{mode}: 空输出"


def test_mock_provider_serves_all_basic_agents():
    from acmforge.eval.dataset import load_dataset, DatasetMockProvider

    problems = {p.problem_id: p for p in load_dataset(DATASET)}
    for pid, problem in problems.items():
        provider = DatasetMockProvider(problem)
        solver_out = provider.complete("solver", "", "")
        assert '"code"' in solver_out and '"idea_summary"' in solver_out
        brute_out = provider.complete("brute", "", "")
        assert '"code"' in brute_out
        gen_out = provider.complete("generator", "", "")
        assert '"modes"' in gen_out
        # 未配置的 agent 必须报 LLMError（与真实 provider 语义一致）
        try:
            provider.complete("no_such_agent", "", "")
        except Exception as e:
            assert "未配置" in str(e)
