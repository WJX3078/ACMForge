#!/usr/bin/env python3
"""repair 测试用求和生成器。"""

import argparse
import json
import random
import sys

MODES = ["min", "small"]


def gen(mode, n, rng):
    if mode == "min":
        return 1, [rng.randint(-1000, 1000)]
    if mode == "small":
        n = min(max(n or 10, 1), 100)
        return n, [rng.randint(-1000, 1000) for _ in range(n)]
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
    if args.seed > 1 and args.seed % 2 == 0:
        raise SystemExit(1)  # 故意对一半的 fuzz 种子失败（冒烟种子 1 除外）
    n, vals = gen(args.mode, args.n, random.Random(args.seed))
    sys.stdout.write(f"{n}\n{' '.join(map(str, vals))}\n")


if __name__ == "__main__":
    main()
