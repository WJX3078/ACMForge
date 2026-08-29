#!/usr/bin/env python3
"""会议室安排 —— 确定性数据生成器。"""

import argparse
import json
import random
import sys

N_MAX = 200000

MODES = ["min", "small", "random", "max", "nested", "disjoint", "touching"]

R_MAX = 3 * 10**9  # 坐标超出 32 位整数范围，卡 int 缩窄


def rand_seg(rng, rmax=R_MAX):
    l = rng.randint(0, rmax)
    return l, l + rng.randint(0, rmax - l)


def gen(mode, n, rng):
    if mode == "min":
        return 1, [rand_seg(rng)]
    if mode == "small":
        n = min(max(n or 10, 1), 20)
        segs = []
        for _ in range(n):
            l = rng.randint(0, 30)
            segs.append((l, l + rng.randint(0, 30 - l)))
        return n, segs
    if mode == "random":
        n = min(max(n or 1000, 1), N_MAX)
        return n, [rand_seg(rng) for _ in range(n)]
    if mode == "max":
        return N_MAX, [rand_seg(rng) for _ in range(N_MAX)]
    n = min(max(n or 1000, 1), N_MAX)
    if mode == "nested":
        # 全部嵌套：答案为 1，卡"排序键选错"
        base = rng.randint(1, R_MAX // 2)
        return n, [(max(0, base - i), min(R_MAX, base + i)) for i in range(n)]
    if mode == "disjoint":
        # 全部互不重叠 => 答案为 n，卡 off-by-one
        segs, t = [], 0
        step = R_MAX // max(n, 1) + 1
        for _ in range(n):
            length = rng.randint(0, max(step - 2, 0))
            segs.append((t, t + length))
            t += step
            if t > R_MAX:
                break
        return len(segs), segs
    if mode == "touching":
        # 端点全部相接：r_i == l_{i+1}，考察 r <= l 边界
        segs, t = [], 0
        for _ in range(min(n, 1000)):
            length = rng.randint(1, 100)
            segs.append((t, t + length))
            t += length
        while len(segs) < n:
            segs.append((0, rng.randint(0, R_MAX)))
        rng.shuffle(segs)
        return n, segs
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
    n, segs = gen(args.mode, n_param, random.Random(args.seed))
    out = [str(n)]
    out += [f"{l} {r}" for l, r in segs]
    sys.stdout.write("\n".join(out) + "\n")


if __name__ == "__main__":
    main()
