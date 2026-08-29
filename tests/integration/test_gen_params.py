"""P0-11 回归：TestStrategy.params 必须完整传到 generator。"""

from pathlib import Path

import pytest

from acmforge.fuzz.gen_runner import GenRunner

pytestmark = pytest.mark.usefixtures("gxx")

GEN_HONORS_PARAMS = '''#!/usr/bin/env python3
import argparse, json, random, sys

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", default=None)
    ap.add_argument("--n", type=int, default=None)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--params", default=None)
    ap.add_argument("--modes", action="store_true")
    args = ap.parse_args()
    if args.modes:
        print(json.dumps(["min", "special"]))
        return
    params = json.loads(args.params) if args.params else {}
    n = args.n if args.n is not None else params.get("n", 3)
    # 把 special_value 编码进输出首行，验证参数真的传到了 generator
    marker = params.get("special_value", 0)
    vals = [marker % 1000 for _ in range(int(n))]
    sys.stdout.write(f"{n} {marker}\\n{' '.join(map(str, vals))}\\n")

if __name__ == "__main__":
    main()
'''


def _write_gen(tmp_path: Path) -> GenRunner:
    p = tmp_path / "gen.py"
    p.write_text(GEN_HONORS_PARAMS, encoding="utf-8")
    return GenRunner(p)


def test_params_json_reaches_generator(tmp_path):
    gen = _write_gen(tmp_path)
    out = gen.run("special", seed=1, params={"special_value": 12345, "n": 2})
    assert out.ok, out.error
    # 第二个 token 是 special_value
    assert out.text.split()[1] == "12345"
    # n 也在 params 里生效
    assert out.text.split()[0] == "2"


def test_n_kwarg_still_works(tmp_path):
    """向后兼容：n 关键字参数自动并入 params。"""
    gen = _write_gen(tmp_path)
    out = gen.run("special", seed=1, n=4)
    assert out.ok, out.error
    assert out.text.split()[0] == "4"


def test_legacy_gen_falls_back_to_n(tmp_path):
    """旧协议 gen.py（只有 --n）：--params 触发 argparse 错误后自动回退。"""
    legacy = '''#!/usr/bin/env python3
import argparse, sys
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", default=None)
    ap.add_argument("--n", type=int, default=5)
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args()
    sys.stdout.write(f"{args.n}\\n")
if __name__ == "__main__":
    main()
'''
    p = tmp_path / "gen_legacy.py"
    p.write_text(legacy, encoding="utf-8")
    gen = GenRunner(p)
    out = gen.run("x", seed=1, params={"n": 9, "special_value": 1})
    assert out.ok, out.error
    assert out.text.strip() == "9"


def test_strategy_params_reach_corpus_generation(tmp_path):
    """节点层：strategy.params（非 n 键）也会传给 gen.py。"""
    gen = _write_gen(tmp_path)
    # 通过 GenRunner 模拟 generate_corpus_batch 的调用方式
    out = gen.run("special", seed=7, params={"special_value": 777, "n": 3})
    assert out.text.split()[1] == "777"
    # n 缺省时 gen 用自己的默认值
    out2 = gen.run("special", seed=7, params={"special_value": 1})
    assert out2.text.split()[0] == "3"
