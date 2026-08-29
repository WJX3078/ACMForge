#!/usr/bin/env python3
"""快速幂取模 —— 确定性数据生成器。

输入格式：一行 b e m。fuzz 的 --n 约束 small 模式下 e 的上限。
"""

import argparse
import json
import random
import sys

E_MAX = 10**18
M_MAX = 10**9

MODES = ["min", "small", "random", "max", "m_one", "e_zero", "b_zero", "big_base"]


def gen(mode, n, rng):
    if mode == "min":
        m = rng.randint(2, M_MAX)
        return rng.randint(0, m - 1), rng.randint(0, 5), m
    if mode == "small":
        cap = min(max(n or 20, 1), 1000)
        m = rng.randint(2, M_MAX)
        return rng.randint(0, m - 1), rng.randint(0, cap), m
    if mode == "random":
        m = rng.randint(2, M_MAX)
        return rng.randint(0, m - 1), rng.randint(0, E_MAX), m
    if mode == "max":
        return M_MAX - 1, E_MAX, M_MAX
    if mode == "m_one":
        return 0, rng.randint(0, E_MAX), 1
    if mode == "e_zero":
        m = rng.randint(1, M_MAX)
        b = rng.randint(0, m - 1)
        return b, 0, m
    if mode == "b_zero":
        m = rng.randint(2, M_MAX)
        e = rng.choice([0, 1, rng.randint(2, E_MAX)])
        return 0, e, m
    if mode == "big_base":
        # b 贴近 m：乘法最接近溢出边界
        m = M_MAX
        return m - rng.randint(1, 5), rng.randint(0, E_MAX), m
    raise ValueError(f"unknown mode: {mode}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", default=None)
    ap.add_argument("--n", type=int, default=None)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--modes", action="store_true")
    args = ap.parse_args()
    if args.modes:
        print(json.dumps(MODES))
        return
    if args.mode is None:
        ap.error("--mode is required")
    b, e, m = gen(args.mode, args.n, random.Random(args.seed))
    sys.stdout.write(f"{b} {e} {m}\n")


if __name__ == "__main__":
    main()
