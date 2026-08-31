import { AGENT_DEFS, AGENT_MAP } from '@/data/agents'
import { GLOBAL_AGENT_TASKS } from '@/data/activity'
import type { AgentId, AgentRuntime, EngineState, LogLine, ToolCall } from '@/types'

const GLOBAL_TASKS: Record<string, string> = Object.fromEntries(
  GLOBAL_AGENT_TASKS.map((t) => [t.id, t.task]),
)

/**
 * Playback driver for the agent pipeline.
 *
 * Everything here is pure: `advance(state, dt) -> state`. Today the script is
 * replayed from `data/agents.ts`; swapping in a real backend means replacing
 * `advance` with an SSE/websocket reducer that emits the same shape. No
 * component knows the difference.
 */

/** gap between two consecutive agents joining the pipeline */
export const STAGGER_MS = 2200
/** pause before the next cycle begins */
export const CYCLE_PAUSE_MS = 3200
/** hard cap so a long-lived tab never grows unbounded */
const MAX_LOGS = 260
const MAX_TOOLS = 60

export const AGENT_ORDER = AGENT_DEFS.map((a) => a.id)

/** absolute cycle-time at which an agent joins the current run */
export function startOffset(id: AgentId): number {
  const idx = AGENT_ORDER.indexOf(id)
  return idx * STAGGER_MS
}

export function createRuntime(id: AgentId): AgentRuntime {
  return {
    id,
    status: 'waiting',
    stepIndex: 0,
    stepElapsed: 0,
    elapsed: 0,
    cycle: 1,
    blocked: false,
    stepLogsEmitted: 0,
    stepToolsEmitted: 0,
    logs: [],
    toolCalls: [],
    tokens: { in: 0, out: 0 },
    io: { in: 0, out: 0 },
  }
}

export function initialState(): EngineState {
  const agents = {} as Record<AgentId, AgentRuntime>
  for (const id of AGENT_ORDER) agents[id] = createRuntime(id)
  return { cycle: 1, cycleElapsed: 0, idleElapsed: 0, agents }
}

export function totalDuration(id: AgentId): number {
  return AGENT_MAP[id].steps.reduce((s, x) => s + x.durationMs, 0)
}

/** longest possible cycle length, used for the global progress rail */
export const CYCLE_LENGTH_MS = Math.max(
  ...AGENT_ORDER.map((id) => startOffset(id) + totalDuration(id)),
)

let logSeq = 0
const nextId = (p: string) => `${p}_${(logSeq++).toString(36)}`

function pushLog(rt: AgentRuntime, level: LogLine['level'], text: string, at: number) {
  rt.logs.push({ id: nextId('l'), at, level, text })
  if (rt.logs.length > MAX_LOGS) rt.logs.splice(0, rt.logs.length - MAX_LOGS)
}

function pushTool(rt: AgentRuntime, tool: ToolCall) {
  rt.toolCalls.push(tool)
  if (rt.toolCalls.length > MAX_TOOLS) rt.toolCalls.splice(0, rt.toolCalls.length - MAX_TOOLS)
}

function isActive(rt: AgentRuntime) {
  return rt.status === 'running' || rt.status === 'thinking'
}

function isTerminal(rt: AgentRuntime) {
  return rt.status === 'completed' || rt.status === 'failed' || rt.blocked
}

function advanceAgent(rt: AgentRuntime, cycleElapsed: number, cycle: number, dt: number) {
  const def = AGENT_MAP[rt.id]

  // ── waiting: decide whether the agent can join the run ────────────────
  if (rt.status === 'waiting') {
    // an upstream failure blocks the rest of the pipeline for this cycle
    if (rt.blocked) return
    if (cycleElapsed < startOffset(rt.id)) return
    rt.status = 'thinking'
    rt.elapsed = 0
    rt.stepElapsed = 0
    rt.stepIndex = 0
    rt.stepLogsEmitted = 0
    rt.stepToolsEmitted = 0
    rt.cycle = cycle
    const step = def.steps[0]
    if (step) {
      rt.io.in += step.ioIn ?? 0
      pushLog(rt, 'info', `${def.name} joined run #${cycle}`, cycleElapsed)
    }
    return
  }

  if (!isActive(rt)) return

  const step = def.steps[rt.stepIndex]
  if (!step) {
    rt.status = 'completed'
    return
  }

  rt.elapsed += dt
  rt.stepElapsed += dt

  // token burn is spread evenly across the step
  const frac = Math.min(1, dt / Math.max(1, step.durationMs))
  rt.tokens.in += Math.round((step.tokensIn ?? 0) * frac)
  rt.tokens.out += Math.round((step.tokensOut ?? 0) * frac)

  // the first slice of every step reads as deliberation
  rt.status = rt.stepElapsed / step.durationMs < 0.18 ? 'thinking' : 'running'

  // ── emit scheduled log lines ─────────────────────────────────────────
  while (
    rt.stepLogsEmitted < step.logs.length &&
    rt.stepElapsed / step.durationMs >= step.logs[rt.stepLogsEmitted].at
  ) {
    const line = step.logs[rt.stepLogsEmitted]
    pushLog(rt, line.level, line.text, rt.elapsed)
    rt.stepLogsEmitted++
  }

  // ── emit scheduled tool calls ────────────────────────────────────────
  const tools = step.toolCalls ?? []
  while (rt.stepToolsEmitted < tools.length && rt.stepElapsed / step.durationMs >= tools[rt.stepToolsEmitted].at) {
    const t = tools[rt.stepToolsEmitted]
    pushTool(rt, {
      id: nextId('t'),
      name: t.name,
      detail: t.detail,
      status: 'running',
      durationMs: t.durationMs,
      at: rt.elapsed,
    })
    rt.stepToolsEmitted++
  }
  // resolve tool calls that have run long enough
  for (const call of rt.toolCalls) {
    if (call.status === 'running' && rt.elapsed - call.at >= call.durationMs) call.status = 'ok'
  }

  // ── step boundary ────────────────────────────────────────────────────
  if (rt.stepElapsed < step.durationMs) return

  // deterministic failure: only on the configured step of configured cycles
  if (def.failOnStep === rt.stepIndex && cycle % (def.failEvery ?? 0) === 0) {
    rt.status = 'failed'
    rt.error = def.failMessage
    pushLog(rt, 'error', 'MISMATCH FOUND', rt.elapsed)
    pushLog(rt, 'error', def.failMessage ?? 'agent stopped', rt.elapsed)
    for (const call of rt.toolCalls) if (call.status === 'running') call.status = 'failed'
    return
  }

  rt.io.out += step.ioOut ?? 0

  if (rt.stepIndex + 1 >= def.steps.length) {
    rt.status = 'completed'
    rt.stepElapsed = step.durationMs
    return
  }

  rt.stepIndex++
  rt.stepElapsed = 0
  rt.stepLogsEmitted = 0
  rt.stepToolsEmitted = 0
  const nextStep = def.steps[rt.stepIndex]
  rt.io.in += nextStep.ioIn ?? 0
  rt.status = 'thinking'
}

export function advance(state: EngineState, dt: number): EngineState {
  const next: EngineState = {
    cycle: state.cycle,
    cycleElapsed: state.cycleElapsed,
    idleElapsed: state.idleElapsed,
    agents: {} as Record<AgentId, AgentRuntime>,
  }

  // deep-ish clone: runtimes are mutated in place by advanceAgent
  for (const id of AGENT_ORDER) {
    const src = state.agents[id]
    next.agents[id] = {
      ...src,
      logs: src.logs.slice(),
      toolCalls: src.toolCalls.map((t) => ({ ...t })),
      tokens: { ...src.tokens },
      io: { ...src.io },
    }
  }

  const allSettled = AGENT_ORDER.every((id) => isTerminal(next.agents[id]))

  // ── propagate blocking: a failed agent freezes everything downstream ──
  for (let i = 0; i < AGENT_ORDER.length; i++) {
    const id = AGENT_ORDER[i]
    const rt = next.agents[id]
    if (rt.status === 'failed') {
      for (let j = i + 1; j < AGENT_ORDER.length; j++) {
        const down = next.agents[AGENT_ORDER[j]]
        if (down.status === 'waiting') {
          down.blocked = true
          if (!down.logs.length) {
            pushLog(down, 'warn', `blocked: upstream ${rt.id} failed`, next.cycleElapsed)
          }
        }
      }
    }
  }

  if (allSettled) {
    // idle, then roll into the next cycle
    next.idleElapsed = state.idleElapsed + dt
    if (next.idleElapsed >= CYCLE_PAUSE_MS) {
      const fresh = {} as Record<AgentId, AgentRuntime>
      for (const id of AGENT_ORDER) {
        const rt = createRuntime(id)
        rt.cycle = state.cycle + 1
        fresh[id] = rt
      }
      return { cycle: state.cycle + 1, cycleElapsed: 0, idleElapsed: 0, agents: fresh }
    }
    return next
  }

  next.cycleElapsed = state.cycleElapsed + dt
  for (const id of AGENT_ORDER) advanceAgent(next.agents[id], next.cycleElapsed, next.cycle, dt)

  return next
}

/* ── Presentation helpers ────────────────────────────────────────────────── */

export function agentTaskLabel(rt: AgentRuntime): string {
  const def = AGENT_MAP[rt.id]
  if (rt.status === 'failed') return 'Halted — ' + (def.role ?? 'agent')
  if (rt.status === 'completed') return 'Done · awaiting next cycle'
  if (rt.status === 'waiting') return rt.blocked ? 'Blocked by upstream failure' : 'Queued'
  return def.steps[rt.stepIndex]?.label ?? 'Working'
}

export function agentTaskDetail(rt: AgentRuntime): string {
  const def = AGENT_MAP[rt.id]
  if (rt.status === 'failed') return rt.error ?? 'agent stopped'
  if (rt.status === 'completed') return 'All steps discharged'
  if (rt.status === 'waiting') {
    if (rt.blocked) return 'Will not start until the pipeline is repaired'
    return GLOBAL_TASKS[rt.id] ?? 'Standing by'
  }
  return def.steps[rt.stepIndex]?.detail ?? ''
}

export function agentProgress(rt: AgentRuntime): number {
  const def = AGENT_MAP[rt.id]
  if (rt.status === 'completed') return 1
  const total = def.steps.reduce((s, x) => s + x.durationMs, 0)
  const done = def.steps.slice(0, rt.stepIndex).reduce((s, x) => s + x.durationMs, 0)
  return Math.min(1, (done + rt.stepElapsed) / Math.max(1, total))
}

/** Derived view used by the UI. */
export function selectAgentView(state: EngineState) {
  const list = AGENT_ORDER.map((id) => state.agents[id])
  return {
    list,
    activeCount: list.filter((a) => a.status === 'running' || a.status === 'thinking').length,
    completedCount: list.filter((a) => a.status === 'completed').length,
    failedCount: list.filter((a) => a.status === 'failed').length,
    totalTokens: list.reduce((s, a) => s + a.tokens.in + a.tokens.out, 0),
    progress: Math.min(1, state.cycleElapsed / CYCLE_LENGTH_MS),
  }
}
