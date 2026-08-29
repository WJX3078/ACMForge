#!/usr/bin/env python3
"""最大子段和 —— 确定性数据生成器。

用法: python gen.py --mode MODE [--n N] --seed SEED
同一 (mode, n, seed) 输出字节级相同；stdout 只输出题目输入文件内容。
"""

import argparse
import json
import random
import sys

N_MIN, N_MAX = 1, 200000
V_MIN, V_MAX = -(10**9), 10**9

MODES = [
    "min",
    "small",
    "random",
    "max",
    "all_neg",
    "all_pos",
    "all_same",
    "alternating",
    "increasing",
    "decreasing",
    "many_duplicates",
    "big_values",
    "valley",
]


def gen(mode: str, n, rng: random.Random):
    if mode == "min":
        return 1, [rng.randint(V_MIN, V_MAX)]
    if mode == "small":
        n = min(max(n or 10, 1), 20)
        return n, [rng.randint(-20, 20) for _ in range(n)]
    if mode == "random":
        n = min(max(n or 1000, 1), N_MAX)
        return n, [rng.randint(V_MIN, V_MAX) for _ in range(n)]
    if mode == "max":
        return N_MAX, [rng.randint(V_MIN, V_MAX) for _ in range(N_MAX)]

    n = min(max(n or 100, 1), N_MAX)
    if mode == "all_neg":
        return n, [-rng.randint(1, 10**9) for _ in range(n)]
    if mode == "all_pos":
        return n, [rng.randint(1, 10**9) for _ in range(n)]
    if mode == "all_same":
        v = rng.choice([-5, 1, 7, V_MIN, V_MAX])
        return n, [v] * n
    if mode == "alternating":
        return n, [rng.randint(1, 10**9) * (1 if i % 2 == 0 else -1) for i in range(n)]
    if mode == "increasing":
        step = 10**9 // max(n, 1)
        return n, [rng.randint(-100, 100) + i * step for i in range(n)]
    if mode == "decreasing":
        step = 10**9 // max(n, 1)
        return n, [rng.randint(-100, 100) - i * step for i in range(n)]
    if mode == "many_duplicates":
        return n, [rng.randint(-3, 3) for _ in range(n)]
    if mode == "big_values":
        # 全部接近 10^9：正数长段相加必然超出 int 范围，卡 int 溢出
        return n, [rng.randint(5 * 10**8, 10**9) for _ in range(n)]
    if mode == "valley":
        # 先负后正：考察"跨过整段负数"的拼接
        half = n // 2
        return n, [-rng.randint(1, 10**9) for _ in range(half)] + [
            rng.randint(1, 10**9) for _ in range(n - half)
        ]
    raise ValueError(f"unknown mode: {mode}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", default=None, help="生成模式")
    ap.add_argument("--n", type=int, default=None, help="规模")
    ap.add_argument("--seed", type=int, default=0, help="随机种子")
    ap.add_argument("--modes", action="store_true", help="列出支持的模式（JSON 数组）")
    args = ap.parse_args()

    if args.modes:
        print(json.dumps(MODES))
        return
    if args.mode is None:
        ap.error("--mode is required")

    n, vals = gen(args.mode, args.n, random.Random(args.seed))
    sys.stdout.write(f"{n}\n{' '.join(map(str, vals))}\n")


if __name__ == "__main__":
    main()
