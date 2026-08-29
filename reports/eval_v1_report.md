# ACMForge Agent Reliability Eval — v1 阶段报告（Phase H）

> 日期：2026-08-29 ｜ 数据集：`benchmarks/v1`（10 题原创合成题）｜ Provider：**mock**（CI 模式，无网络依赖）
> 原始产物：`evals/20260829-200611-340b/`（summary.md / summary.json / problems/*.json）

## 一、本次测到的是什么（诚实声明）

- **mock 模式测的是"流水线验证机制"**：mock Agent 每题返回一份参考实现（模拟一次写对的 Solver），流水线负责对拍、变异、卡测、审题、打包。它回答"验证机器是否可信、是否会漏放/误杀"。
- **它不测 Agent 的真实生成能力**（std 首过率、修复成功率等需要真实 LLM 才有意义）。配置 `ACMFORGE_API_KEY` 后运行 `acmforge eval benchmarks/v1 --provider llm` 即可得到真实数字——这是本框架的下一个动作。
- mock 模式下"STD first-pass 100%"是构造使然，不是能力结论。

## 二、机制层面的结论（mock 模式，10/10 成功）

| 指标 | 结果 | 解读 |
|---|---|---|
| Pipeline success | **10/10 = 100%** | 12 节点在 10 个不同算法类别的题上全部走通 |
| 样例答案防幻觉校验 | 2 次实战拦截 | 此前开发中抓到 binary-search / tree 两处手写样例错误（见下文 bug 清单） |
| Mutant compile | 85% (17/20) | 3 个编译失败是**真实 CE**（如 `int prev2` 使 `min(long long&, int&)` 模板推导失败），被诚实丢弃并计数 |
| Duplicate mutants | 5% | 按 sha 去重如实统计 |
| Meaningful mutants | **100%** | 所有编译通过的变异体都被击杀（本轮无等价幸存者） |
| Mutant kill | **100%** | 每题 kill_rate = 1.0 |
| 选测数 | 平均 9.6 | 样例 + min/max + 对抗测试 + Set Cover 补齐 |
| 单题耗时 | ~40s（standard preset） | 全数据集一轮 ≈ 7 分钟 |

## 三、本阶段修掉的真实 Bug（全部由 eval/审计实证发现，非假设）

| # | 层 | Bug | 影响 | 修复 |
|---|---|---|---|---|
| 1 | Agent | `SolverAgent.solve()` 未传 `previous_code`，StrictUndefined 使纯生成路径必然崩溃 | **LLM 出题主路径从未可用**（此前测试全走 offline/repair） | 补全模板变量；eval 纳入回归 |
| 2 | 数据集 | binary-search 样例答案手写错误（x=4 应为下标 4） | spec 错误 | 修正；样例校验机制被证明有效 |
| 3 | 数据集 | tree-diameter 样例答案手写错误（直径 7 写成 8） | spec 错误 | 修正 |
| 4 | 变异 | `long long` 打在容器声明行 → int 缩窄等价变异（值域 1e9 在 int32 内） | kill rate 虚低 | 算子跳过容器声明行；两题值域改为 3e9 |
| 5 | 变异 | 变异打在纯注释行 = 等价变异 | kill rate 虚低 | 跳过注释行 |
| 6 | 变异 | `std::max` 模式匹配不到裸 `max(`（`using namespace std` 写法） | 大多数真实代码零变异面 | 模式改为 `\b(max|min)\s*\(` |
| 7 | 变异 | `min(long long&, int&)` 模板推导失败 → 变异体 CE | 变异体被丢弃（行为正确但暴露了变异面设计问题） | 重写 stair std 避免类型混用 |
| 8 | 数据集 | two-sum all_same 陷阱默认 n=1000，答案不溢出 int | 卡测失效 | 对抗模式默认规模拉满 |
| 9 | 指标 | `mutant_kinds` 未写入 manifest，eval 读不到 | 指标缺失 | 已修复 |
| 10 | 审计项 | gen.py（LLM 生成）无安全检查直接执行 | 代码执行风险 | 静态禁止危险 import/eval/open |
| 11 | 审计项 | 重新打包无声删除旧 final 包 | 违反不覆盖原则 | 显式 log + warning |

## 四、失败分类体系（Phase C）运行情况

23 类 FailureType 全部接入；本次 mock 轮零 pipeline 失败，分类器由 9 个单元测试直接覆盖（LLM_ERROR/STD_COMPILE_ERROR/STD_REPAIR_FAILED/TESTS_TOO_WEAK/TLE_SURVIVED/UNKNOWN 等映射）。

## 五、当前可靠性瓶颈（按证据排序）

1. **Agent 真实生成能力完全未测**（最大盲区）：mock 只证明"验证机器可信"。STD 首过率、修复成功率、LLM mutant 质量——这些核心数字需要 `--provider llm` 的真实运行。框架与数据集已就绪，只差 API Key。
2. **LLM mutant 质量未知**：mock 的 idea→代码链路已验证，但真实 LLM 给出的 WrongIdeaSpec 是否"看似有理"、变异体是否可编译/可击杀，没有任何数据。
3. **等价变异体的系统性识别**：本轮靠人工归因（注释行/容器行/类型安全缩窄），survivor 分析（Phase F）已就位但在 mock 轮没有真实案例；等价率指标的自动化归因是下一步。
4. **数据集规模**：10 题覆盖 9 类，但每类 1-2 题，方差大；扩到 20-30 题后失败分布才有统计意义。
5. **计时可信度**：Windows 本地计时含 ~30ms 进程开销，std margin 结论需在 Docker/WSL2 Runner 下复核。

## 六、下一步建议

1. 配置 `ACMFORGE_API_KEY`，跑 `acmforge eval benchmarks/v1 --provider llm --preset standard`，得到第一份真实 Agent 可靠性报告（预计暴露 Solver 首过率与 Generator 质量的真实水位）。
2. 数据集扩到 20 题（每类 ≥2 题），把本次发现的"变异面设计清单"写成出题规范。
3. 把 survivor 分析的等价判定接入 kill rate 口径（分析确认等价的变异体从分母剔除， rationale 落盘）。
4. Docker Runner 落地后复测 benchmark margin 的可信度。
