#!/usr/bin/env python3
"""有序数对计数 —— 确定性数据生成器。"""

import argparse
import json
import random
import sys

N_MAX = 200000
V_MAX = 10**9

MODES = ["min", "small", "random", "max", "all_same", "two_values", "no_pairs"]


def sorted_vals(n, rng, lo, hi):
    return sorted(rng.randint(lo, hi) for _ in range(n))


def gen(mode, n, rng):
    if mode == "min":
        n = 1
        a = [rng.randint(-V_MAX, V_MAX)]
        s = rng.randint(-2 * V_MAX, 2 * V_MAX)
        return n, s, a
    if mode == "small":
        n = min(max(n or 10, 1), 20)
        a = sorted_vals(n, rng, -30, 30)
        s = rng.randint(-60, 60)
        return n, s, a
    if mode == "random":
        n = min(max(n or 1000, 1), N_MAX)
        a = sorted_vals(n, rng, -V_MAX, V_MAX)
        s = rng.randint(-2 * V_MAX, 2 * V_MAX)
        return n, s, a
    if mode == "max":
        a = sorted_vals(N_MAX, rng, -V_MAX, V_MAX)
        # s 取数组中真实存在的两数之和，保证有命中
        s = a[0] + a[-1]
        return N_MAX, s, a
    n = min(max(n or 1000, 1), N_MAX)
    if mode == "all_same":
        # 陷阱只在最大规模生效：C(2e5,2) ≈ 2e10 超出 int32
        v = rng.randint(-V_MAX, V_MAX)
        s = 2 * v
        return N_MAX, s, [v] * N_MAX
    if mode == "two_values":
        x, y = -5, 7
        a = sorted([rng.choice([x, y]) for _ in range(n)])
        s = x + y
        return n, s, a
    if mode == "no_pairs":
        # 全为奇数，s 为奇数 => 无解
        a = sorted(2 * rng.randint(0, V_MAX // 2) + 1 for _ in range(n))
        s = 2 * rng.randint(0, V_MAX) + 1
        return n, s, a
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
    n, s, a = gen(args.mode, n_param, random.Random(args.seed))
    out = [f"{n} {s}", " ".join(map(str, a))]
    sys.stdout.write("\n".join(out) + "\n")


if __name__ == "__main__":
    main()
