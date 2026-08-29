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
