# ACMForge — AI Competitive Programming Problem Factory

一个 AI 驱动的 ACM / ICPC 出题流水线控制台。纯前端原型，无后端，全部数据为 mock，但代码结构按可接真实 API 的方式分层。

## 运行

```bash
cd acmforge
npm install
npm run dev        # 开发服务器，默认 http://localhost:5173
```

其他脚本：

```bash
npm run build      # tsc --noEmit && vite build（类型检查 + 生产构建）
npm run typecheck  # 仅类型检查
npm run preview    # 预览 dist 产物
```

## 技术栈

React 18 · TypeScript · Vite 5 · Tailwind CSS 3 · Radix UI · Lucide Icons · Recharts · Framer Motion · React Router 6

## 目录结构

```
src/
├── types/        领域模型（Agent / Problem / Idea / Test / Stress 等）
├── data/         mock 数据：agent 脚本、题目、题面、题解、idea、去重结果
├── services/     agentEngine.ts —— 纯函数播放引擎，advance(state, dt) -> state
├── hooks/        React 状态层：引擎驱动、count-up、主题、toast、factory 运行、stress bench
├── lib/          工具函数、C++ 语法高亮、导航配置
├── components/
│   ├── ui/       button / badge / panel / controls / input / dialog / code-block / primitives
│   ├── layout/   AppShell / Sidebar / Header / CommandPalette / Toaster
│   ├── agents/   AgentDrawer / AgentActivityDock
│   ├── dashboard/  Hero / StatsGrid / PipelineBoard / RecentProblems / Charts / ActivityPanel
│   ├── duplicates/ NoveltyGauge / HitRow
│   └── common/   Sparkline
└── pages/        Dashboard / ProblemFactory / IdeaPool / DuplicateSearch / Solutions
                  TestGenerator / StressTest / Problems / ProblemDetail / Agents / Settings
```

## 接后端时改哪里

数据流转经三层，替换任意一层不会影响另外两层：

| 层 | 文件 | 换成真实 API 时 |
|---|---|---|
| 播放 / 推导 | `services/agentEngine.ts` | 把 `advance()` 换成 SSE / WebSocket reducer，输出同样的 `EngineState` |
| React 状态 | `hooks/useAgentEngine.tsx` | 无需改动 |
| 展示 | `pages/*`、`components/*` | 无需改动 |

页面里所有列表数据都从 `data/*` 导入；换成 fetch 时保持导出类型不变即可。

## 已实现的交互

- **Agent 流水线**：7 个 agent 按 stagger 时间依次加入，实时推进 step / 日志 / 工具调用 / token；确定性注入失败（Stress Tester 每 N 轮失败一次）并向下游传播阻塞
- **Agent Drawer**：点任意 agent 打开，含 Reasonering Timeline / Tool Calls / Logs 三个标签，日志自动滚动
- **Problem Factory**：配置难度、算法标签、风格、创新性后运行 8 阶段流水线，实时时间线
- **Stress Test**：差分测试控制台，跑到 `Test #18293 / n = 200000` 报 MISMATCH，点 Minimize Counterexample 用 delta debugging 缩到 `n = 7`
- **Duplicate Search**：五平台相似度检索 + Novelty 仪表（96/100 · Likely Original）
- **Command Palette**：`Ctrl/⌘ + K`，支持导航 / 命令 / 题目模糊搜索，键盘上下选择 + 回车执行
- **其他**：明暗主题切换并持久化、Toast 通知、代码复制、响应式断点

## 验证脚本

```bash
bash tools/smoke.sh        # 遍历全部路由，检查渲染字符数与页面错误
bash tools/responsive.sh   # 5 个断点 × 11 条路由，检查横向溢出
```

两个脚本依赖 `agent-browser`（本地装在 `~/.workbuddy/binaries/node/workspace`），需要 `vite preview` 在 5181 端口运行。

## 设计决策

- **暗色为默认**，浅色为完整对等主题；主题通过 CSS 变量切换，无组件内硬编码颜色
- **克制用色**：底色 zinc/neutral，accent 仅在运行状态、主按钮、品牌标识出现
- **信息密度优先**：8px 基线网格，正文 13–14px，面板间距 12–16px，不做大面积留白
- **动画服务状态**：pulse 只给 running/thinking 的 agent；count-up 只给统计数字；不做装饰性动效
- **Codeforces 难度色**做过去饱和处理，数值始终可见，颜色只是辅助信号
