# ACMForge Eval Report — 20260829-200611-340b

- Dataset: `benchmarks\v1`  Provider: `mock`  Preset: `standard`
- 时间: 2026-08-29T12:06:11+00:00 → 2026-08-29T12:12:51+00:00

Problems:                 10
Pipeline success:         10/10 = 100%
STD compile:              10/10 = 100%
STD first-pass correct:   10/10 = 100%
STD final correct:        10/10 = 100%

Mutant compile:           85% (17/20)
Duplicate mutants:        5%
Meaningful mutants:       100%
Mutant kill:              100%

Average repair attempts:  0.0
Average selected tests:   9.6
Average runtime:          40.0s
LLM calls/problem:        3.7

## Failure distribution

| FailureType | Count | Owner |
|---|---|---|

## Top 5 failure causes
（无 pipeline 级失败）

## 最值得优化的 Agent

**（本次无失败归因 —— 可靠性瓶颈需更大样本）**

## Per-problem

| problem | difficulty | success | failure_type | std_repair | kill | tle_kill | tests | llm_calls | runtime |
|---|---|---|---|---|---|---|---|---|---|
| array-sum | easy | ✓ | - | 0 | 1.00 | 0/0 | 9 | 3 | 38.0s |
| binary-search-lowerbound | easy | ✓ | - | 0 | 1.00 | 0/0 | 8 | 3 | 39.4s |
| interval-scheduling | medium | ✓ | - | 0 | 1.00 | 0/0 | 8 | 3 | 37.0s |
| max-subarray-sum | medium | ✓ | - | 0 | 1.00 | 0/0 | 15 | 6 | 48.6s |
| stair-min-cost | medium | ✓ | - | 0 | 1.00 | 0/0 | 9 | 3 | 39.2s |
| mod-pow | medium | ✓ | - | 0 | 1.00 | 0/0 | 10 | 3 | 36.0s |
| two-sum-sorted-count | medium | ✓ | - | 0 | 1.00 | 0/0 | 9 | 3 | 41.8s |
| bfs-shortest-path | medium | ✓ | - | 0 | 1.00 | 0/0 | 9 | 5 | 38.7s |
| sliding-window-min | hard | ✓ | - | 0 | 1.00 | 0/0 | 10 | 5 | 37.3s |
| tree-diameter | hard | ✓ | - | 0 | 1.00 | 0/0 | 9 | 3 | 43.6s |

> 注：`equivalent_mutant_rate` 是幸存/已编译的代理指标（幸存 = 等价或测试不足，survivor 分析结果见各 run 的 kill_matrix.jsonl rounds_log）。`editorial_review` 目前与总体审题同口径（无独立题解审校）。