# Agent 使用指南：如何驱动 ACMForge

本文供自动化 Agent（如 ZCode / Claude / 其他 LLM Agent）以 CLI 方式驱动本出题机。
核心纪律：**Agent 只做决策与文案，一切"是否正确/是否够快"的结论以命令输出与落盘报告为准，禁止 Agent 自行宣称验证通过。**

## 标准出题流程（Agent 视角）

### 第 0 步：把 idea 变成 ProblemSpec

写一个 `problem.yaml`（参考 `examples/max-subarray-sum/problem.yaml`），必须包含：

- `slug / title / task / input_format / output_format`（形式化，无歧义）
- `constraints`：既有人读的 `items`，也有机器读的 `bounds`（`n: [1, 200000]` 等）
- `samples`：至少 1 个（`expected_output` 可留空——流水线会用 brute 实测填充并交叉校验）
- `intended_solution`：观察 / 算法步骤 / 证明要点 / 复杂度（Solver 与 Editorial 依赖它）
- `limits`：时限/内存

然后校验：

```bash
acmforge spec validate my-problem/problem.yaml
```

### 第 1 步：跑流水线

```bash
# 无 LLM 环境（需要自备 assets/std.cpp、assets/brute.cpp、assets/gen.py）
acmforge run my-problem/problem.yaml --offline

# 有 LLM：缺什么补什么，甚至只给一个 problem.yaml
acmforge run my-problem/problem.yaml
```

Agent 应当监控的失败模式：

| 失败节点 | 含义 | Agent 下一步 |
|---|---|---|
| `compile_solutions` | LLM 代码编译不过（已自动重试 K 轮） | 读 state 里的 stderr，改 spec 或人工介入 |
| `differential_fuzz` | std 与 brute 不一致且修复耗尽 | 读 `counterexamples/ce_*/`，判断是 spec 歧义还是代码 bug |
| `kill_matrix` | 错误解杀不干净 | 看未击杀列表：是否需要新的对抗模式？把它加进 gen.py 或 assets |
| `final_verify` | std 太慢 / TLE 解没被卡 | 检查 limits 与 bounds 是否自洽（n_max × 复杂度 ⇒ 时间） |

### 第 2 步：读报告做验收判断

```bash
acmforge inspect <run_id>     # 各节点指标
cat workspace/<slug>/runs/<run_id>/final/<slug>/quality.json
```

验收标准（quality.json）：

- `decision == "accept"`：可发布
- `differential_mismatches == 0` 且 `counterexamples == 0`（或已修复）
- `kill_rate >= 0.95`（`tests.enforce_kill_rate: true` 时流水线强制）
- `tle_mutant_killed == tle_mutant_total`（错误复杂度解必须全被卡）
- `std_margin_ratio <= 0.5`（std 最大用时占时限比例）
- `statement_review_passed == true`

不达标时的标准动作：

1. 错误解杀不掉 → 在 gen.py 增加对抗模式（全相同/全负/极值/最坏结构…），或把 bounds 拉满，重跑 `--from design_tests`。
2. std 余量不足 → 换更优 `intended_solution`，或放宽 limits（并同步题面），重跑全流程。
3. 反例反复出现 → 多半是 spec 有歧义：修 spec 而不是修代码。

### 断点续跑与抽查

```bash
acmforge run my-problem/problem.yaml --until compile_solutions   # 先看编译
acmforge resume <run_id>                                          # 续跑
acmforge resume <run_id> --from kill_matrix                       # 只重做后半段
acmforge run-cpp tmp/sol.cpp tmp/in.txt --expected tmp/ans.txt    # 单点验证
```

## 编写错误解资产的套路（assets.mutants）

每个 mutant 一条记录，`category` 从 `WRONG_GREEDY / WRONG_TRANSITION / BOUNDARY / OVERFLOW / MISSING_CASE / TLE / MLE / IMPLEMENTATION_BUG` 中选：

```yaml
mutants:
  - path: assets/mutants/wrong_tle_quadratic.cpp
    category: TLE
    description: 算法对但 O(n^2)
    expected_verdict: TLE
```

写完后不需要手工验证 —— 流水线会编译并在 kill matrix 里如实报告每个 mutant 的生死。

## 环境备忘

- 工具链：`%USERPROFILE%\.acmforge\mingw64\bin`（便携版 MinGW，路径必须纯 ASCII）。
- 配置优先级：CLI > `ACMFORGE_CONFIG` > `configs/default.yaml` > 内置默认。
- LLM 密钥走环境变量 `ACMFORGE_API_KEY`（`.env.example` 有完整说明），调用追踪在 run 目录 `logs/llm_calls.jsonl`。
