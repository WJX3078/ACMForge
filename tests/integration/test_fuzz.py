"""Differential Fuzz 集成测试：植入 bug 的 std 必须被抓住，seed 必须可复现。"""

import json
from pathlib import Path

import pytest

from acmforge.fuzz.differential import DifferentialFuzzer, make_small_cases
from acmforge.fuzz.gen_runner import GenRunner
from acmforge.runner.local import LocalRunner

from acmforge.config import FuzzConfig

pytestmark = pytest.mark.usefixtures("gxx")

BUGGY_STD = """#include <bits/stdc++.h>
using namespace std;
int main(){ ios::sync_with_stdio(false); cin.tie(nullptr);
    int n; cin >> n;
    long long best = LLONG_MIN, cur = 0;
    for (int i = 0; i < n; ++i) { long long x; cin >> x; cur = cur + x; best = std::max(best, cur); }
    cout << best << endl; }
"""


def _compile(compiler, tmp_path: Path, code: str, name: str) -> str:
    src = tmp_path / f"{name}.cpp"
    src.write_text(code, encoding="utf-8")
    cr = compiler.compile(src, tmp_path, name)
    assert cr.ok, cr.compiler_stderr
    return cr.exe_path


def test_planted_bug_is_found(compiler, tmp_path: Path, example_dir: Path):
    std_exe = _compile(compiler, tmp_path, BUGGY_STD, "std")
    brute_code = (example_dir / "assets" / "brute.cpp").read_text(encoding="utf-8")
    brute_exe = _compile(compiler, tmp_path, brute_code, "brute")

    gen = GenRunner(example_dir / "assets" / "gen.py")
    runner = LocalRunner()
    tl = 2000

    def gen_case(mode, n, seed):
        out = gen.run(mode, seed=seed, n=n)
        return out.text if out.ok and out.text.strip() else None

    fuzzer = DifferentialFuzzer(
        lambda data: runner.run(std_exe, stdin_bytes=data, timeout_ms=tl),
        lambda data: runner.run(brute_exe, stdin_bytes=data, timeout_ms=30000),
        gen_case,
        tmp_path / "ce",
    )
    cfg = FuzzConfig(smoke_cases=30, small_n=12, seed=42)
    cases = make_small_cases(cfg, ["small", "min", "random"], 42)
    summary = fuzzer.run(cases)

    assert summary.cases_run > 0
    assert summary.mismatches >= 1
    assert summary.counterexamples
    ce = summary.counterexamples[0]
    ce_dir = Path(ce.dir_path)
    assert (ce_dir / "input.txt").is_file()
    assert (ce_dir / "metadata.json").is_file()
    meta = json.loads((ce_dir / "metadata.json").read_text(encoding="utf-8"))
    # 反例的 (mode, n, seed) 必须记录在案且可复现
    assert meta["seed"] in [c[2] for c in cases]
    assert meta["mode"] in [c[0] for c in cases]


def test_seed_reproducibility(example_dir: Path):
    """同一 seed 两次生成的 case 序列必须完全一致。"""
    cfg = FuzzConfig(smoke_cases=20, small_n=12, seed=42)
    c1 = make_small_cases(cfg, ["small", "min", "random"], 42)
    c2 = make_small_cases(cfg, ["small", "min", "random"], 42)
    assert c1 == c2

    gen = GenRunner(example_dir / "assets" / "gen.py")
    texts1 = [gen.run(m, seed=s, n=n).text for (m, n, s) in c1[:5]]
    texts2 = [gen.run(m, seed=s, n=n).text for (m, n, s) in c2[:5]]
    assert texts1 == texts2


def test_correct_std_passes(compiler, tmp_path: Path, example_dir: Path):
    std_code = (example_dir / "assets" / "std.cpp").read_text(encoding="utf-8")
    std_exe = _compile(compiler, tmp_path, std_code, "std")
    brute_code = (example_dir / "assets" / "brute.cpp").read_text(encoding="utf-8")
    brute_exe = _compile(compiler, tmp_path, brute_code, "brute")

    gen = GenRunner(example_dir / "assets" / "gen.py")
    runner = LocalRunner()

    def gen_case(mode, n, seed):
        out = gen.run(mode, seed=seed, n=n)
        return out.text if out.ok and out.text.strip() else None

    fuzzer = DifferentialFuzzer(
        lambda data: runner.run(std_exe, stdin_bytes=data, timeout_ms=2000),
        lambda data: runner.run(brute_exe, stdin_bytes=data, timeout_ms=30000),
        gen_case,
        tmp_path / "ce",
    )
    cfg = FuzzConfig(smoke_cases=25, small_n=12, seed=7)
    summary = fuzzer.run(make_small_cases(cfg, ["small", "min", "random"], 7))
    assert summary.mismatches == 0
    assert summary.errors == []
