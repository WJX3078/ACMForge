# Dead Config / Dead Fields Audit（P0-17）

> 审计日期：2026-08-29 ｜ 方法：全量 grep 定义点与引用点，逐字段确认
> 原则：要么实现，要么删除。不留"看起来支持"但业务逻辑不用的配置。

## 配置字段（configs/default.yaml / AppConfig）

| 字段 | 定义位置 | 实际使用 | 状态 | 动作 |
|---|---|---|---|---|
| `fuzz.smoke_cases` | FuzzConfig | differential_fuzz（基础对拍 + build_fuzz_plan 填充） | ✅ 在用 | — |
| `fuzz.small_n` | FuzzConfig | make_small_cases / build_fuzz_plan / 探针 | ✅ 在用 | — |
| `fuzz.seed` | FuzzConfig | 全部 case 种子 / fresh / holdout / 候选语料 | ✅ 在用 | — |
| `fuzz.shrink` / `shrink_max_evals` | FuzzConfig | node_differential_fuzz | ✅ 在用 | — |
| `fuzz.min_success_ratio` | FuzzConfig | 有效性门禁（P0-7 新实现） | ✅ 在用 | — |
| `fuzz.max_oracle_errors` | FuzzConfig | 有效性门禁（P0-7 新实现） | ✅ 在用 | — |
| `fuzz.per_mode_cases` | FuzzConfig | build_fuzz_plan（P0-8 新实现） | ✅ 在用 | — |
| `fuzz.fresh/holdout_*` | FuzzConfig | repair 后验证（P0-9 新实现） | ✅ 在用 | — |
| `mutants.source_mutations` | MutantsConfig | node_generate_mutants | ✅ 在用 | — |
| `mutants.llm_count` | MutantsConfig | WrongIdeaSpec 数量（两段式） | ✅ 在用 | — |
| `mutants.max_total` | MutantsConfig | node_generate_mutants 上限裁剪 | ✅ 在用 | — |
| `tests.candidate_batch` | TestsConfig | kill_matrix 追加轮语料批量 | ✅ 在用 | — |
| `tests.min_kill_rate` | TestsConfig | kill_matrix / final_verify / 审题 / 决策 | ✅ 在用 | — |
| `tests.max_rounds` | TestsConfig | kill_matrix 轮数 | ✅ 在用 | — |
| `tests.per_mutant_eval_budget` | TestsConfig | 每变异体评估预算 | ✅ 在用 | — |
| `tests.enforce_kill_rate` | TestsConfig | 门禁（warning vs FAIL） | ✅ 在用 | — |
| `benchmark.repeats/warmup/std_target_ratio/enforce_std_margin` | BenchmarkConfig | final_verify | ✅ 在用 | — |
| `repair.max_attempts` | RepairConfig | fuzz 修复循环 / std 编译修复 | ✅ 在用 | — |
| `runner.*` | RunnerConfig | compiler.py | ✅ 在用 | — |
| `llm.*` | LLMConfig | provider / agents | ✅ 在用 | — |
| `workspace_dir` | AppConfig | CLI / eval | ✅ 在用 | — |
| `offline` | AppConfig | 各节点 LLM 门控 | ✅ 在用 | — |
| `llm.api_key`（文件内嵌 key） | LLMConfig | resolve_api_key 支持 | ⚠️ 保留 | 可用但 .env 优先；README 已声明勿提交 |

## DifferentialFuzzer / 模型字段

| 字段 | 状态 | 动作 |
|---|---|---|
| `DifferentialFuzzer.max_saved_ce` | ❌ 曾存而不用（反例无限落盘） | **已实现**：超出上限的反例计入 mismatches 但不再落盘 |
| `MutantSpec` 模型 | ❌ 零引用（SolutionCandidate 已完全覆盖） | **已删除** |
| `NodeStatus.SKIP` | ❌ 引擎从未产生（resume 跳过沿用历史 OK 状态） | **已删除** |
| `ArtifactType.VALIDATOR` | ❌ 零引用（validator 为进程内组件，无落盘产物） | **已删除** |
| `KillRecord.expected_verdict / expected_failure_hit` | 新增字段 | ✅ P0-5 实现 |
| `QualityReport.tle_semantically_valid / mle_*` | 新增字段 | ✅ P0-5 实现 |

## ProblemSpec 预留字段（非 config，明确标注保留理由）

| 字段 | 状态 | 说明 |
|---|---|---|
| `checker: "custom"` | 保留 | testlib/SPJ 扩展点；当前按 exact 语义处理并在代码注释声明 |
| `spj: bool` | 保留 | SPJ 题扩展点；v0.1.1 无 SPJ 流程 |
| `source_idea` | 保留 | S0 idea 库对接点 |
| `CheckerConfig.type="custom"` | 保留 | 同上 |

## 结论

- 删除 3 个死字段（MutantSpec / NodeStatus.SKIP / ArtifactType.VALIDATOR）。
- 实现 1 个存而不用的行为（max_saved_ce）。
- 其余全部配置字段均有真实业务引用（逐项 grep 确认）。
