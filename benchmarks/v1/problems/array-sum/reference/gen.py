#!/usr/bin/env python3
"""数列求和 —— 确定性数据生成器。"""

import argparse
import json
import random
import sys

N_MIN, N_MAX = 1, 200000
V_MIN, V_MAX = -(10**9), 10**9

MODES = ["min", "small", "random", "max", "all_neg", "big_values", "zeros"]


def gen(mode, n, rng):
    if mode == "min":
        return 1, [rng.randint(V_MIN, V_MAX)]
    if mode == "small":
        n = min(max(n or 10, 1), 20)
        return n, [rng.randint(-50, 50) for _ in range(n)]
    if mode == "random":
        n = min(max(n or 1000, 1), N_MAX)
        return n, [rng.randint(V_MIN, V_MAX) for _ in range(n)]
    if mode == "max":
        return N_MAX, [rng.randint(V_MIN, V_MAX) for _ in range(N_MAX)]
    n = min(max(n or 100, 1), N_MAX)
    if mode == "all_neg":
        return n, [-rng.randint(1, 10**9) for _ in range(n)]
    if mode == "big_values":
        return n, [rng.randint(5 * 10**8, 10**9) for _ in range(n)]
    if mode == "zeros":
        return n, [0] * n
    raise ValueError(f"unknown mode: {mode}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", default=None)
    ap.add_argument("--n", type=int, default=None, help="规模（legacy；推荐 --params）")
    ap.add_argument("--params", default=None, help="JSON 参数，如 '{\"n\": 200000}'")
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--modes", action="store_true")
    args = ap.parse_args()
    if args.modes:
        print(json.dumps(MODES))
        return
    if args.mode is None:
        ap.error("--mode is required")
    params = json.loads(args.params) if args.params else {}
    n_param = args.n if args.n is not None else params.get("n")
    n, vals = gen(args.mode, n_param, random.Random(args.seed))
    sys.stdout.write(f"{n}\n{' '.join(map(str, vals))}\n")


if __name__ == "__main__":
    main()
