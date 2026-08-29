#!/usr/bin/env python3
"""二分下界查询 —— 确定性数据生成器。"""

import argparse
import json
import random
import sys

N_MAX, Q_MAX = 200000, 200000
V_MAX = 3 * 10**9

MODES = ["min", "small", "random", "max", "all_same", "all_absent", "boundary"]


def sorted_vals(n, rng, lo=None, hi=None):
    lo = V_MAX * -1 if lo is None else lo
    hi = V_MAX if hi is None else hi
    return sorted(rng.randint(lo, hi) for _ in range(n))


def gen(mode, n, rng):
    if mode == "min":
        return 1, 1, sorted_vals(1, rng), [rng.randint(-V_MAX, V_MAX)]
    if mode == "small":
        n = min(max(n or 10, 1), 20)
        q = n
        a = sorted_vals(n, rng, -50, 50)
        qs = [rng.randint(-60, 60) for _ in range(q)]
        return n, q, a, qs
    if mode == "random":
        n = min(max(n or 1000, 1), N_MAX)
        q = min(n, Q_MAX)
        a = sorted_vals(n, rng)
        qs = [rng.randint(-V_MAX, V_MAX) for _ in range(q)]
        return n, q, a, qs
    if mode == "max":
        return N_MAX, Q_MAX, sorted_vals(N_MAX, rng), [rng.randint(-V_MAX, V_MAX) for _ in range(Q_MAX)]
    if mode == "all_same":
        n = min(max(n or 1000, 1), N_MAX)
        v = rng.randint(-V_MAX, V_MAX)
        a = [v] * n
        qs = [v, v + 1, v - 1] * (min(n, Q_MAX) // 3 + 1)
        return n, min(n, Q_MAX), a, qs[: min(n, Q_MAX)]
    if mode == "all_absent":
        # 只查询偶数位置，数组全为奇数 => 大量 -1
        n = min(max(n or 1000, 1), N_MAX)
        a = sorted(2 * rng.randint(0, V_MAX // 2) + 1 for _ in range(n))
        q = min(n, Q_MAX)
        qs = [2 * rng.randint(0, V_MAX // 2) for _ in range(q)]
        return n, q, a, qs
    if mode == "boundary":
        n = min(max(n or 1000, 1), N_MAX)
        a = sorted_vals(n, rng)
        qs = [a[0], a[-1], a[0] - 1, a[-1] + 1] * (min(n, Q_MAX) // 4 + 1)
        return n, min(n, Q_MAX), a, qs[: min(n, Q_MAX)]
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
    n, q, a, qs = gen(args.mode, n_param, random.Random(args.seed))
    out = [f"{n} {q}", " ".join(map(str, a))]
    out += [str(x) for x in qs]
    sys.stdout.write("\n".join(out) + "\n")


if __name__ == "__main__":
    main()
