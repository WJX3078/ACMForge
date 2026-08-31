# 项目长期记忆：ACM 自动出题机

工作区同时含两套东西，不要混淆：

1. **Python 出题引擎**（根目录）：`src/`、`benchmarks/`、`configs/`、`prompts/`、`pyproject.toml`
2. **ACMForge Web 控制台**（`acmforge/`）：React 18 + TS + Vite 前端原型，2026-08-29 从零建起

## acmforge/ 约定

- 包管理器脚本：`npm run dev` / `npm run build`（= `tsc --noEmit && vite build`）/ `npm run typecheck` / `npm run preview`
- tsconfig 开了 `noUnusedLocals` + `noUnusedParameters` + `strict`，构建会因未使用变量失败
- 路径别名 `@/*` → `src/*`
- 路由用 HashRouter（`#/factory` 这种），便于静态托管
- 暗色为默认主题（`src/hooks/useTheme.tsx`，localStorage key `acmforge.theme`）
- 数据分层：`data/`（mock）→ `services/`（纯函数推导）→ `hooks/`（React 状态）→ `pages/`。接真实 API 只改 `services/` 和 `data/`

## 禁止的写法（踩过坑）

**不要在 React state updater 里写副作用。** 项目开 StrictMode，updater 会被双调用：
```ts
// 错
setCases((c) => { if (next === FAIL) { push(...); setPhase('mismatch') } return next })
// 对：用 ref 在 updater 外推进
casesRef.current += 1
if (casesRef.current === FAIL) { push(...); setPhase('mismatch') }
setCases(casesRef.current)
```
已因此修过 `useStressBench.ts` 和 `TestGenerator.tsx` 两处。

## 验证脚本

- `bash tools/smoke.sh` —— 遍历全部路由，检查渲染字符数 + page error（依赖 5181 端口的 `vite preview`）
- `bash tools/responsive.sh` —— 5 断点 × 11 路由，检查横向溢出
- 两者都依赖本地安装的 `agent-browser`：`C:\Users\asus\.workbuddy\binaries\node\workspace\node_modules\.bin\agent-browser`
- `smoke.sh [port]` —— 默认 5181（preview），传 5173 可测 dev server
- 交互级验证脚本（2026-08-30 新增）：`stress-interact.sh`（跑压力测试 + 最小化反例）、
  `tabs-verify.sh`（5 个 Tab 内容）、`interactions.sh`（命令面板 / Agent Drawer / Factory）、
  `payload.sh`（逐路由首屏 JS 体积）、`theme-check.sh`（浅色主题 5 断点 × 7 路由）、
  `page-audit.sh`、`misc-interactions.sh`、`final-checks.sh`、`countup-check.sh`
- **agent-browser 测试陷阱已沉淀为 skill：`spa-browser-verification`**（用户级 `~/.workbuddy/skills/`）。
  要点：Radix 组件需 pointerdown 序列而非 `.click()`；`text=X` 是子串匹配；
  必须查 `[role=tabpanel][data-state=active]`；daemon 在脚本之间丢页面；截图路径不能含中文

## 打包约定（2026-08-30 建立）

- 路由级代码分割已启用：Dashboard 在 entry chunk，其余 11 页 `React.lazy`；
  `<Outlet>` 外包 `<Suspense fallback={<PageFallback />}>`，切路由时 shell 不卸载
- `vite.config.ts` 的 `manualChunks` 只拆 **react-vendor / radix / motion / icons** 四组
- **禁止把 recharts 加进 `manualChunks`**。它只被 `Dashboard → Charts.tsx` 动态 import 依赖，
  手动命名 chunk 会让 entry 静态 import 它，383 kB 会被拖进每条路由的关键路径（已踩过，见当日日志）
- `chunkSizeWarningLimit: 600`，超过即视为回归
- 改完打包配置用 `bash tools/payload.sh` 验证（整页冷加载，逐路由测首屏 JS 体积）

## 剪贴板约定

`src/hooks/useCopy.ts` 必须在异步 Clipboard API **reject 时继续回退**到 textarea + `execCommand`。
（旧版直接进 catch 返回 false，导致回退永远不可达。）CodeBlock / AgentDrawer / Solutions 三处共用此 hook。
