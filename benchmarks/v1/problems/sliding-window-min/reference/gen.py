#!/usr/bin/env python3
"""滑动窗口最小值 —— 确定性数据生成器。"""

import argparse
import json
import random
import sys

N_MAX = 200000
V_MAX = 10**9

MODES = ["min", "small", "random", "max", "all_same", "increasing", "decreasing", "alternating"]


def gen(mode, n, rng):
    if mode == "min":
        return 1, 1, [rng.randint(-V_MAX, V_MAX)]
    if mode == "small":
        n = min(max(n or 10, 1), 20)
        k = rng.randint(1, n)
        return n, k, [rng.randint(-50, 50) for _ in range(n)]
    if mode == "random":
        n = min(max(n or 1000, 1), N_MAX)
        k = rng.randint(1, n)
        return n, k, [rng.randint(-V_MAX, V_MAX) for _ in range(n)]
    if mode == "max":
        return N_MAX, N_MAX // 2, [rng.randint(-V_MAX, V_MAX) for _ in range(N_MAX)]
    n = min(max(n or 1000, 1), N_MAX)
    if mode == "all_same":
        v = rng.randint(-V_MAX, V_MAX)
        return n, rng.randint(1, n), [v] * n
    if mode == "increasing":
        return n, rng.randint(1, n), list(range(1, n + 1))
    if mode == "decreasing":
        return n, rng.randint(1, n), list(range(n, 0, -1))
    if mode == "alternating":
        return n, rng.randint(2, max(n, 2)), [
            (V_MAX if i % 2 == 0 else -V_MAX) for i in range(n)
        ]
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
    n, k, a = gen(args.mode, n_param, random.Random(args.seed))
    out = [f"{n} {k}", " ".join(map(str, a))]
    sys.stdout.write("\n".join(out) + "\n")


if __name__ == "__main__":
    main()
