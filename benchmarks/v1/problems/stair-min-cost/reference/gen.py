#!/usr/bin/env python3
"""爬楼梯最小花费 —— 确定性数据生成器。"""

import argparse
import json
import random
import sys

N_MAX = 30
C_MAX = 10**9

MODES = ["min", "small", "random", "max", "all_same", "equal_pairs", "valley"]


def gen(mode, n, rng):
    if mode == "min":
        return 1, [rng.randint(1, C_MAX)]
    if mode == "small":
        n = min(max(n or 10, 1), 12)
        return n, [rng.randint(1, 20) for _ in range(n)]
    if mode == "random":
        n = min(max(n or 10, 1), N_MAX)
        return n, [rng.randint(1, C_MAX) for _ in range(n)]
    if mode == "max":
        return N_MAX, [rng.randint(1, C_MAX) for _ in range(N_MAX)]
    n = min(max(n or 10, 1), N_MAX)
    if mode == "all_same":
        v = rng.randint(1, C_MAX)
        return n, [v] * n
    if mode == "equal_pairs":
        # 偶数级贵、奇数级便宜：考验"跳两级"决策
        n = min(max(n or 10, 1), N_MAX)
        return n, [1 if i % 2 == 0 else C_MAX for i in range(n)]
    if mode == "valley":
        # 两端贵中间便宜
        n = min(max(n or 10, 1), N_MAX)
        costs = [rng.randint(C_MAX // 2, C_MAX) if i in (0, n - 1) else rng.randint(1, 100) for i in range(n)]
        return n, costs
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
    n, costs = gen(args.mode, args.n, random.Random(args.seed))
    sys.stdout.write(f"{n}\n{' '.join(map(str, costs))}\n")


if __name__ == "__main__":
    main()
