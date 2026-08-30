# ACMForge Repository Audit（Phase A）

> 日期：2026-08-29 ｜ 审计方式：真实运行 + 源码逐项排查，不依据 README 假设。
> 结论先行：**核心链路真实可靠（无伪造指标、无 stub、复现性已实证），发现 2 个低危行为缺陷与 4 处文档/可观测性偏差；LLM 路径（修复循环、mutant 生成质量）未被任何测试覆盖，是下一阶段最大盲区。**
>
> **附录（Phase B-H 执行后补充）**：eval 框架建成后首次跑 mock 全链路，随即抓到多个审计预测的"LLM/数据集路径潜伏 bug"并全部修复——印证了"LLM 路径是最大盲区"的判断。完整 11 项清单见 `reports/eval_v1_report.md` 第三节，代表性问题：
> 1. `SolverAgent.solve()` 未传 `previous_code`，Jinja StrictUndefined 导致**纯生成模式必然崩溃**（此前所有测试只走 offline/repair 路径，从未触达）。
> 2. binary-search / tree-diameter 数据集样例答案手写错误，被流水线样例校验正确拦截——防幻觉机制首次实战生效。
> 3. 变异算子三类缺陷：容器声明行等价变异、注释行变异、裸 `max(`/`min(` 不被匹配——全部修复。
> 4. `mutant_kinds` 只进节点 metrics 未进 manifest，eval 指标读不到——已修复。

---

## 1. 真实运行结果

| 项目 | 结果 | 备注 |
|---|---|---|
| pytest 全量 | **49/49 通过** | 38 unit + 11 integration（有 g++ 才跑的 integration 全部实际执行） |
| 离线完整流水线 | **通过** | 300 组对拍 0 mismatch，kill 7/7，std 54ms/2000ms，决策 ready_for_human_review |
| smoke 流水线 | **通过** | 40 组对拍 0 mismatch，kill 7/7，决策 ready_for_human_review |
| CLI 基础命令 | **通过** | spec validate / run / run-cpp / resume / inspect / runs 全部实际执行过 |
| 环境检查 | 无 LLM Key | ACMFORGE_API_KEY / OPENAI_API_KEY 均未设置 → LLM 路径本次无法实测 |

## 2. 逐项审计结论

### 2.1 TODO / pass / stub —— ✅ 干净
- `grep TODO|FIXME|XXX|HACK` → 0 处。
- 9 处 `pass` 全部是合法用途：自定义异常类体（`class PromptError(AcmforgeError): pass`）与 try/except 中的降级守卫（如 stdout reconfigure 失败、进程清理），无空实现占位。
- 无 `NotImplementedError` 空壳类；未引入任何"看起来完整但没实现"的模块。

### 2.2 伪造指标 —— ✅ 未发现
- `quality.json` 的全部字段（differential_cases / mismatches / kill_rate / std_max_ms / margin / review_passed）均取自 `fuzz.json` / `final_verify.json` / `benchmark.json` / `review.json`，这些 manifest 由真实进程执行结果写入。
- kill 判定走 `judge_against_answer`：TLE/RE 直接击杀，正常退出必须过 checker 与答案比对 —— 不存在"退出码 0 即 AC"的假阳性（这是本仓库曾真实出现过的 bug，已在此前修复并有回归测试）。
- benchmark 为 warmup + 多次实测取 median/max，无 LLM 自报数据。

### 2.3 Agent 输出 Pydantic 校验 —— ✅ 全覆盖
- 8 个 Agent（solver/brute/generator/mutant/test_designer/statement/editorial/reviewer）全部经 `ask_structured` → JSON 提取 → Pydantic 校验，校验失败带错误信息重试。
- 风险点（非缺陷）：`TestStrategy.params` 为 `dict[str, Any]`，LLM 可写入 gen.py 不认识的参数 → 目前靠 gen 运行失败时 warning 降级。Phase E/F 的定向策略会继续沿用此模式，需保留"未知参数失败即警告"语义。

### 2.4 LLM 代码裸执行 —— ⚠️ 一处已声明的边界
- C++ 解：经 `LocalRunner`（超时 / 64MB 输出上限 / 内存采样 / POSIX rlimit）。Windows 无系统调用级隔离 —— 已在 README 声明，保持。
- **gen.py：LLM 生成的 Python 生成器以 `sys.executable` 直接执行，仅 30s 超时保护，无内存上限、无隔离** —— 这是最弱的一环。评估：gen.py 运行在编排进程同一用户态，恶意 gen.py 理论上可任意行为。缓解措施（本阶段落地）：运行前静态检查（禁止 import os/subprocess/socket 等）；完整隔离留给 Docker Runner。
- 编译产物可执行文件均由本地 g++ 编译（非下载），供应链风险低。

### 2.5 Artifact 覆盖 —— ⚠️ 2 处
- `workspace.write_new` 拒绝覆盖、`next_version_path` 版本化（std_v1→v2）—— 主路径正确。
- **发现 A1（低危）**：`packaging.node_package` 对同一 run 重新打包时 `shutil.rmtree(pkg)` + `zip.unlink()`，会无声删除本 run 上一次的 final 包。属同 run 内重生成，但违反"不无声覆盖"原则 → 修复：删除前在 run log/warnings 中显式记录。
- **发现 A2（低危）**：`node_generate_candidates` 的样例写入路径在 resume 重跑该节点时可能原地覆盖同名样例文件（内容相同，无害但属静默写入）→ 修复：sha 相同则跳过。

### 2.6 Seed 复现性 —— ✅ 已实证
- 两次独立 smoke run：corpus 29 条记录的 input_sha256 序列**完全一致**，kill_rate 均 1.0。
- 对拍 case（mode/n/seed）与反例 metadata（seed 入档）均确定性；`make_small_cases` 与各轮追加种子公式（`seed + 2_000_000*round`）无随机源。
- 反例可复现：metadata.json 含 (mode, n, seed)，gen.py 同种子字节级复现输入；`acmforge run-cpp <exe> counterexamples/ce_xxx/input.txt` 可人工重放。

### 2.7 Workflow resume 状态 —— ✅ 基本正确（一处历史 bug 已修）
- 引擎以 `state.json` 的节点级 status 跳过已完成节点；`--from` 强制重跑后续；失败节点未过即重试。
- 历史 bug（上阶段已修复）：resume 时 assets 相对路径丢失 —— 以 `spec_origin.json` 记录原 spec 位置。
- 残留风险（记录，不修）：`resume` 不继承上次 run 的 CLI 覆盖项（如 --smoke），中途换配置可能造成前后不一致 —— 已在 docs/AGENT.md 提示，评估框架将以"配置随 eval 固化"规避。

### 2.8 README 与代码一致性 —— ⚠️ 3 处措辞修正
- **发现 A3**：README 称"样例答案由 brute 实测生成"，实际实现是 **由 std 计算、并与 brute 输出交叉校验（不一致即 FAIL）** —— 保证等价但表述不准 → 修 README。
- **发现 A4**：任务书提到的 `testcase/` 模块在实现中并入 `workflow/nodes.py`（策略→语料→评估），无独立包 —— 在审计中记录，不为此重构。
- README 宣称"49 个测试"等数字随开发推进会漂移 → 报告类数字统一以后续 eval summary 为准，README 只保留稳定事实。

### 2.9 未被测试覆盖的关键路径 —— ⚠️ 本阶段重点
| 路径 | 现状 | 本阶段动作 |
|---|---|---|
| LLM 修复循环（std 错 → 反例 → v2 修复） | 仅手工验证过机制，无自动化测试（需 LLM） | MockProvider 级 eval 覆盖 |
| LLM mutant 生成质量 | 无任何度量 | Phase E 指标 |
| survivor 反馈闭环 | 不存在 | Phase F 新建 + 测试 |
| packaging zip / resume CLI | 仅手工 | 维持（eval 端到端会反复触达） |

## 3. 修复清单（本阶段已做/将做）
| 编号 | 严重度 | 动作 |
|---|---|---|
| A1 | 低 | 打包重生成前显式记录（log + warning），不再无声删除 |
| A2 | 低 | 语料写入前按 sha 去重跳过 |
| A3 | 文档 | README 措辞修正（std 计算并交叉校验） |
| — | 中 | gen.py 静态安全检查（禁止危险 import），Phase B 随 eval 落地 |
| — | — | LLM 路径可测性（MockProvider 级）由 eval 框架系统性补齐 |
