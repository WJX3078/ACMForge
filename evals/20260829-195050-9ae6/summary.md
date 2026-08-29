# ACMForge Eval Report — 20260829-195050-9ae6

- Dataset: `benchmarks\v1`  Provider: `mock`  Preset: `standard`
- 时间: 2026-08-29T11:50:50+00:00 → 2026-08-29T11:57:45+00:00

Problems:                 10
Pipeline success:         10/10 = 100%
STD compile:              10/10 = 100%
STD first-pass correct:   10/10 = 100%
STD final correct:        10/10 = 100%

Mutant compile:           86% (18/21)
Duplicate mutants:        5%
Meaningful mutants:       89%
Mutant kill:              89%

Average repair attempts:  0.0
Average selected tests:   9.6
Average runtime:          41.5s
LLM calls/problem:        3.7

## Failure distribution

| FailureType | Count | Owner |
|---|---|---|
| TESTS_TOO_WEAK | 2 | test-designer |
| STATEMENT_MISMATCH | 2 | content-agents |

## Top 5 failure causes
（无 pipeline 级失败）

## 最值得优化的 Agent

**（本次无失败归因 —— 可靠性瓶颈需更大样本）**

## Per-problem

| problem | difficulty | success | failure_type | std_repair | kill | tle_kill | tests | llm_calls | runtime |
|---|---|---|---|---|---|---|---|---|---|
| array-sum | easy | ✓ | - | 0 | 1.00 | 0/0 | 9 | 3 | 41.8s |
| binary-search-lowerbound | easy | ✓ | - | 0 | 1.00 | 0/0 | 8 | 3 | 38.3s |
| interval-scheduling | medium | ✓ | - | 0 | 1.00 | 0/0 | 8 | 3 | 38.8s |
| max-subarray-sum | medium | ✓ | - | 0 | 1.00 | 0/0 | 15 | 6 | 50.7s |
| stair-min-cost | medium | ✓ | - | 0 | 0.67 | 0/0 | 9 | 3 | 46.2s |
| mod-pow | medium | ✓ | - | 0 | 1.00 | 0/0 | 10 | 3 | 35.4s |
| two-sum-sorted-count | medium | ✓ | - | 0 | 0.50 | 0/0 | 9 | 3 | 51.5s |
| bfs-shortest-path | medium | ✓ | - | 0 | 1.00 | 0/0 | 9 | 5 | 36.9s |
| sliding-window-min | hard | ✓ | - | 0 | 1.00 | 0/0 | 10 | 5 | 34.6s |
| tree-diameter | hard | ✓ | - | 0 | 1.00 | 0/0 | 9 | 3 | 40.7s |

> 注：`equivalent_mutant_rate` 是幸存/已编译的代理指标（幸存 = 等价或测试不足，survivor 分析结果见各 run 的 kill_matrix.jsonl rounds_log）。`editorial_review` 目前与总体审题同口径（无独立题解审校）。