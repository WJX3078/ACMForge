#!/usr/bin/env python3
"""树的直径 —— 确定性数据生成器。"""

import argparse
import json
import random
import sys

N_MAX = 100000
W_MAX = 10**9

MODES = ["min", "small", "random", "max", "chain", "star", "caterpillar"]


def shuffle_tree(n, edges, rng):
    # 随机重标号 + 打乱输出顺序（保持树形）
    labels = list(range(1, n + 1))
    rng.shuffle(labels)
    edges = [(labels[u - 1], labels[v - 1], w) for (u, v, w) in edges]
    rng.shuffle(edges)
    return edges


def gen(mode, n, rng):
    if mode == "min":
        return 1, []
    if mode == "small":
        n = min(max(n or 10, 1), 20)
        # 随机父节点构造树，边权小
        edges = [(i, rng.randint(1, i - 1), rng.randint(1, 100)) for i in range(2, n + 1)]
        return n, shuffle_tree(n, edges, rng) if n > 1 else []
    if mode == "random":
        n = min(max(n or 1000, 1), N_MAX)
        edges = [(i, rng.randint(1, i - 1), rng.randint(1, W_MAX)) for i in range(2, n + 1)]
        return n, shuffle_tree(n, edges, rng) if n > 1 else []
    if mode == "max":
        n = N_MAX
        edges = [(i, rng.randint(1, i - 1), rng.randint(1, W_MAX)) for i in range(2, n + 1)]
        return n, shuffle_tree(n, edges, rng)
    n = min(max(n or 1000, 1), N_MAX)
    if mode == "chain":
        # 链：直径 = (n-1) * W_MAX，卡溢出与深度递归
        edges = [(i, i + 1, W_MAX) for i in range(1, n)]
        return n, edges
    if mode == "star":
        # 星图：直径 = 2 * W_MAX
        edges = [(1, i, W_MAX) for i in range(2, n + 1)]
        return n, edges
    if mode == "caterpillar":
        # 毛毛虫：链上挂大量叶子，直径仍约 (n/2)*W
        half = n // 2
        edges = [(i, i + 1, W_MAX) for i in range(1, half)]
        for j in range(n - half):
            edges.append((j % half + 1, half + 1 + j, W_MAX))
        return n, shuffle_tree(n, edges, rng)
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
    n, edges = gen(args.mode, args.n, random.Random(args.seed))
    out = [str(n)] + [f"{u} {v} {w}" for u, v, w in edges]
    sys.stdout.write("\n".join(out) + "\n")


if __name__ == "__main__":
    main()
