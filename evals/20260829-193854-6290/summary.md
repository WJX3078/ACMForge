# ACMForge Eval Report — 20260829-193854-6290

- Dataset: `benchmarks\v1`  Provider: `mock`  Preset: `standard`
- 时间: 2026-08-29T11:38:54+00:00 → 2026-08-29T11:45:22+00:00

Problems:                 10
Pipeline success:         8/10 = 80%
STD compile:              10/10 = 100%
STD first-pass correct:   8/10 = 80%
STD final correct:        8/10 = 80%

Mutant compile:           88% (14/16)
Duplicate mutants:        6%
Meaningful mutants:       93%
Mutant kill:              93%

Average repair attempts:  0.0
Average selected tests:   7.8
Average runtime:          38.7s
LLM calls/problem:        3.7

## Failure distribution

| FailureType | Count | Owner |
|---|---|---|
| MUTANT_COMPILE_ERROR | 1 | mutant-agent |
| TESTS_TOO_WEAK | 1 | test-designer |
| STATEMENT_MISMATCH | 1 | content-agents |
| STD_LOGIC_ERROR | 1 | solver-agent |

## Top 5 failure causes
1. **MUTANT_COMPILE_ERROR** ×1（owner: mutant-agent）— 例：stair-min-cost: 没有任何可用的变异体（全部编译失败或为空）
2. **STD_LOGIC_ERROR** ×1（owner: solver-agent）— 例：tree-diameter: 样例校验失败: 样例 3 与 spec 给定的期望输出不一致: 第 1 个 token 数值不同: 8 vs 7

## 最值得优化的 Agent

**mutant-agent**

## Per-problem

| problem | difficulty | success | failure_type | std_repair | kill | tle_kill | tests | llm_calls | runtime |
|---|---|---|---|---|---|---|---|---|---|
| array-sum | easy | ✓ | - | 0 | 1.00 | 0/0 | 9 | 3 | 37.8s |
| binary-search-lowerbound | easy | ✓ | - | 0 | 1.00 | 0/0 | 8 | 3 | 35.4s |
| interval-scheduling | medium | ✓ | - | 0 | 1.00 | 0/0 | 8 | 3 | 38.5s |
| max-subarray-sum | medium | ✓ | - | 0 | 1.00 | 0/0 | 15 | 6 | 47.7s |
| stair-min-cost | medium | ✗ | MUTANT_COMPILE_ERROR | 0 | 0.00 | 0/0 | 0 | 3 | 33.2s |
| mod-pow | medium | ✓ | - | 0 | 1.00 | 0/0 | 10 | 3 | 34.4s |
| two-sum-sorted-count | medium | ✓ | - | 0 | 0.50 | 0/0 | 9 | 3 | 51.9s |
| bfs-shortest-path | medium | ✓ | - | 0 | 1.00 | 0/0 | 9 | 5 | 39.9s |
| sliding-window-min | hard | ✓ | - | 0 | 1.00 | 0/0 | 10 | 5 | 38.8s |
| tree-diameter | hard | ✗ | STD_LOGIC_ERROR | 0 | 0.00 | 0/0 | 0 | 3 | 29.7s |

> 注：`equivalent_mutant_rate` 是幸存/已编译的代理指标（幸存 = 等价或测试不足，survivor 分析结果见各 run 的 kill_matrix.jsonl rounds_log）。`editorial_review` 目前与总体审题同口径（无独立题解审校）。