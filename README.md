# ACMForge —— ACM 自动出题机

> 一条确定性的出题流水线：**题目 spec → STD/Brute → 对拍验证 → 错误解生成 → 卡测(Kill Matrix) → 测试精选 → 性能基准 → 题面/题解 → 标准题包**。
>
> LLM 只负责"想"（写代码、写文案），**正确性与性能结论全部由真实执行产生**。

本项目合并了两份初始规划（`ACMForge 总体规划` 与 `acm-setter PLAN.md`）的公共主干实现而成，取舍决策见[下文](#设计决策两份规划的取舍)。

---

## 核心理念

1. **Agent = Think，Orchestrator = Decide，Runner = Execute，Verifier = Verify**
   LLM 生成的代码被视为不可信代码：一律经过编译、限时限内存运行、与暴力解对拍、被错误解击杀矩阵验证。任何"LLM 说它是对的"都不算数。
2. **ProblemSpec 是唯一事实源**（`problem.yaml`）：题意、格式、约束、预期解法、时限内存全部结构化，Pydantic 强校验。
3. **样例答案永远由程序计算**：流水线用 std 计算样例答案并与 brute 输出交叉校验（不一致即 FAIL），绝不采用 LLM 手写答案（防幻觉硬规则）。
4. **一切可复现**：数据生成器 `gen.py` 按 seed 确定性输出；每次 run 独立目录、状态落盘、断点续跑。
5. **产品指标不是"生成了题面"**，而是：对拍 mismatch=0、变异体 kill rate、TLE 解是否被卡、std 用时占时限比例、审题是否通过 —— 全部进入 `quality.json`。

## 流水线（12 个节点）

```
load_spec → prepare_solutions → compile_solutions → differential_fuzz
    → generate_mutants → design_tests → generate_candidates
    → kill_matrix → select_tests → final_verify → generate_content → package
```

- `differential_fuzz`：std vs brute 在 300 组种子化随机小数据上逐例比对；不一致 → 反例落盘 → 自动最小化(shrink) → LLM 修复循环（最多 K 轮）。
- `generate_mutants`：三类错误解 —— spec 自带 / **确定性源码变异**（long long→int、LLONG_MIN→0、max→min 等典型错误）/ LLM 生成的"看起来有道理的错误解"（O(n²)、错误贪心、漏边界、溢出…）。
- `kill_matrix`：每个错误解 × 候选测试，输出非 AC（WA/TLE/MLE/RE）即击杀；kill rate < 目标时自动追加候选数据（最多 K 轮）。
- `select_tests`：样例 + min/max + 对抗测试强制保留，其余用**贪心 Set Cover** 补齐，保证每个错误解至少被一个测试击杀。
- `final_verify`：最终测试集上重跑全部错误解（真实 kill rate）+ std 多次基准（median/max/内存），要求 std 最大用时 ≤ `std_target_ratio × TL`。
- `package`：产出 Polygon 风格自包含题包 + 中文流水线报告 + zip。

## 快速开始

### 环境要求

- Python 3.11+，以及 g++（支持 C++20）。
- Windows 上推荐便携版 MinGW（工具链自身路径必须纯 ASCII，否则 ld 无法打开库文件）：

```bash
# 下载 winlibs 压缩包后解压到 %USERPROFILE%\.acmforge\mingw64 即可被自动发现
# 也可以在 configs/default.yaml 里指定 runner.compiler_path
```

### 安装

```bash
python -m venv .venv
.venv/Scripts/pip install -e .          # Linux/Mac: pip install -e .
.venv/Scripts/acmforge --help
```

### 1 分钟离线演示（无需 LLM、无需 API Key）

仓库自带示例题 `examples/max-subarray-sum`（最大子段和：std=Kadane、brute=O(n²)、3 个刻意写错的解、13 种模式的确定性生成器）：

```bash
acmforge spec validate examples/max-subarray-sum/problem.yaml
acmforge run examples/max-subarray-sum/problem.yaml --offline          # 完整流水线
acmforge run examples/max-subarray-sum/problem.yaml --offline --smoke  # 快速冒烟
```

跑完后的预期结论（一台普通笔记本约 2 分钟 / 冒烟 40 秒）：

```
对拍 300 例 0 mismatch | kill 7/7 | std 58ms/2000ms | 决策 accept
```

产物在 `workspace/max-subarray-sum/runs/<run_id>/`：

```
final/max-subarray-sum/          # 标准题包
├── problem.yaml                 # 元数据
├── statement.md                 # 题面（样例答案由 brute 实测生成）
├── editorial.md                 # 题解
├── solutions/std.cpp brute.cpp
├── gen/gen.py  gen_manifest.yaml
├── tests/1.in 1.ans ...         # 最终测试集（含 mapping.json 溯源）
├── wrong/*.cpp wrong_report.json  # 全部错误解与被卡记录
├── reports/kill_matrix.md       # 击杀矩阵 + std 性能表
├── report.md                    # 流水线总报告（对拍/卡测/TL余量/审题）
└── quality.json                 # 机器可读质量结论
counterexamples/ce_xxx/          # （如有）反例：input/std/brute/metadata.json
```

### 接入 LLM（生成全新题目）

任何 OpenAI 兼容接口均可（GLM / DeepSeek / OpenAI / vLLM…）：

```bash
set ACMFORGE_API_KEY=sk-xxxx          # 可选 ACMFORGE_BASE_URL / ACMFORGE_MODEL
acmforge run my-problem/problem.yaml
```

- spec 自带 `assets` 时：缺什么补什么（缺 std 就生成 std，缺 mutants 就生成错误解）。
- 完全没有 assets：LLM 生成 std + brute + gen.py + 错误解 + 测试策略 + 题面润色 + 题解 + 验题。
- 对拍失败自动把最小化反例喂回 Solver 修复（`std_v1.cpp → std_v2.cpp …`，旧版本永不覆盖）。
- 每次 LLM 调用记录在 `logs/llm_calls.jsonl`（模型、prompt 版本、输入/输出哈希、耗时）。

### 常用命令

```bash
acmforge spec validate <problem.yaml>   # 解析 + Pydantic 校验
acmforge run <problem.yaml> [--offline] [--smoke] [--until <node>] [--from <node>]
acmforge run-cpp <src.cpp> <input.txt> [--tl-ms 2000] [--expected ans.txt]
acmforge resume <run_id> [--from <node>]   # 断点续跑
acmforge inspect <run_id>                  # 查看节点状态与指标
acmforge runs                              # 列出所有 run
```

## 配置

`configs/default.yaml`（所有数值可覆盖，代码零 magic number）：LLM、fuzz（对拍组数/规模/seed/shrink）、mutants（源码变异开关、LLM 数量）、tests（候选批量、kill rate 目标、轮数、评估预算）、benchmark（repeats、std 目标占比）、repair（最大修复轮数）、sandbox 预留。

## 评测框架（Agent Reliability Eval）

> 目标：可量化地回答"ACMForge 到底有多可靠，失败发生在哪里"。

```bash
# mock 模式（无需 API Key，数据集自带参考实现的"标准 Agent 回应"）
acmforge eval benchmarks/v1 --provider mock --preset standard

# 真实 LLM 模式（测 Agent 的实际可靠性）
set ACMFORGE_API_KEY=sk-xxxx
acmforge eval benchmarks/v1 --provider llm
```

- 数据集 `benchmarks/v1/`：10 道原创合成题，覆盖 implementation / greedy / binary-search / two-pointers / DP / graph / tree / data-structure / math 九类、三档难度。每题含 problem.yaml（不含 assets）+ 参考实现（mock 模式充当"标准 Agent"）。
- 指标：pipeline 成功率、STD 首过正确率/修复次数、differential 用例数、mutant 编译率/重复率/等价率/击杀率、TLE 击杀率、选测数、LLM 调用数与 token 用量、耗时。
- 失败分类（FailureType）：每个失败归入 SPEC_INVALID / LLM_ERROR / STD_LOGIC_ERROR / TESTS_TOO_WEAK / TLE_SURVIVED 等 23 类，summary 输出分布、Top 5 失败原因与"最值得优化的 Agent"。
- 产物：`evals/<eval_id>/`（summary.json / summary.md / problems/*.json / failures/*.md）。
- CI 使用 MockProvider，不依赖网络与真实 Key；mutant 生成走 `ProblemSpec → WrongIdeaSpec → Wrong Solution` 两段式，幸存者进入 SurvivorAnalyzer 定向闭环（所有轮次记录在 kill_matrix manifest 的 rounds_log，可回溯"为什么生成这个测试"）。

## 设计决策（两份规划的取舍）

| 议题 | 规划 A（ACMForge） | 规划 B（acm-setter） | **本实现采用** | 理由 |
|---|---|---|---|---|
| 存储层 | SQLite + SQLAlchemy | 文件夹即数据库 + JSONL | **B（文件夹 + JSON manifest/artifacts.jsonl）**，SQLite 预留 | MVP 透明可 git、零迁移成本；repository 边界清晰，后续可整体替换 |
| MVP 范围 | 全对拍/变异/击杀流水线 | 6 Stage 含 idea 收集与查重 | **A 的验证主干全量实现**；B 的 S0(idea)/S2(查重) 只留接口 | 查重需要外部语料/浏览器自动化，验证主干才是"能出题"的地基 |
| 沙箱 | LocalRunner 先行 + Docker 接口 | WSL2 + rlimit | **A：LocalRunner + 明确安全边界声明**，Docker/WSL2 留接口 | 当前 Windows 宿主无 Docker/WSL；超时/输出上限/内存采样/POSIX rlimit 已就位，换 Runner 不动上层 |
| 错误解 | LLM mutants + 源码变异 + Kill Matrix + 贪心选测 | 每题 3~5 个"只差复杂度"的慢解 | **取 A 的超集**（B 的慢解是其中 TLE 类） | 源码变异零成本确定性，kill matrix 顺带覆盖 B 的卡人验收 |
| 样例答案 | 未强调 | 必须由 brute 计算 | **采纳 B 为硬规则** | 防 LLM 幻觉样例 |
| 题包格式 | report + artifacts | Polygon 兼容目录 | **B 的目录布局 + A 的 quality/报告体系** | 两者互补 |
| 计时可信度 | Docker | WSL2（Windows 计时不可信） | **MVP 接受本地计时并在报告注明**；margin 目标 50% 留足冗余 | 环境受限；后续切 Docker Runner 后自动获得可信计时 |
| Checker | 简单 diff | testlib checker/validator | **MVP：token 级默认 checker（数值容差）**，testlib/SPJ 预留 | Windows 编译 testlib 摩擦大，接口已留 |
| 工作流引擎 | 确定性 Node 引擎 + 状态机 | Stage gate + 断点续跑 | **合并**：12 Node 顺序引擎，state.json 落盘，`--until/--from` 续跑 | 完全一致的思想 |

## 测试

```bash
.venv/Scripts/python -m pytest tests/ -q
```

- 单元：领域模型、配置、workspace 隔离与防覆盖、checker、shrinker（纯函数）、贪心选测、变异算子、失败分类器（不碰编译器）。
- 集成（有 g++ 才跑）：编译/超时/RE/输出上限防护、植入 bug 的 std 被对拍抓住且反例可复现、正确 std 全绿、**完整流水线离线跑通（kill 7/7、决策 accept）**、坏 std 流水线正确失败并落盘反例、断点续跑、**数据集参考实现对拍一致性、eval mock 全链路、survivor 定向闭环**。

## 已知边界（诚实声明）

- LocalRunner 不做系统调用级隔离 —— 不能运行故意恶意的代码；生产化需接 Docker Runner（接口已留）。
- Windows 下计时含进程启动开销（~30ms），报告中的 margin 目标（50% TL）已为此留冗余。
- 查重（S2）、idea 收集（S0）、SPJ/testlib、Docker 沙箱为预留接口，见各模块 TODO 标注。
- gen.py / LLM 生成的生成器按"题目资产"对待，运行时同样限时限输出。

## License

MIT
