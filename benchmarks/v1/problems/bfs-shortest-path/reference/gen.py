#!/usr/bin/env python3
"""无权图最短路 —— 确定性数据生成器。"""

import argparse
import json
import random
import sys

N_MAX = 100000
M_MAX = 200000

MODES = ["min", "small", "random", "max", "chain", "disconnected", "star"]


def gen(mode, n, rng):
    if mode == "min":
        # 单点或一条边
        if rng.random() < 0.5:
            return 1, 0, []
        return 2, 1, [(1, 2)]
    if mode == "small":
        n = min(max(n or 10, 1), 20)
        m = rng.randint(0, 2 * n)
        edges = [(rng.randint(1, n), rng.randint(1, n)) for _ in range(m)]
        return n, len(edges), edges
    if mode == "random":
        n = min(max(n or 1000, 1), N_MAX)
        m = min(2 * n, M_MAX)
        edges = [(rng.randint(1, n), rng.randint(1, n)) for _ in range(m)]
        return n, m, edges
    if mode == "max":
        # 链 + 随机额外边：保证可达且规模拉满
        n, m_left = N_MAX, M_MAX
        edges = [(i, i + 1) for i in range(1, n)]
        m_left -= len(edges)
        edges += [(rng.randint(1, n), rng.randint(1, n)) for _ in range(m_left)]
        return n, M_MAX, edges
    n = min(max(n or 1000, 1), N_MAX)
    if mode == "chain":
        # 1→n 距离 n-1：卡"BFS 深度 vs 正确层序"
        edges = [(i, i + 1) for i in range(1, n)]
        return n, len(edges), edges
    if mode == "disconnected":
        # n 孤立点 => -1
        return n, 0, []
    if mode == "star":
        # 星图：1 连接所有点 => 距离 2
        m = min(n - 1, M_MAX)
        edges = [(1, i) for i in range(2, n + 1)][:m]
        return n, len(edges), edges
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
    n, m, edges = gen(args.mode, args.n, random.Random(args.seed))
    out = [f"{n} {m}"] + [f"{u} {v}" for u, v in edges]
    sys.stdout.write("\n".join(out) + "\n")


if __name__ == "__main__":
    main()
