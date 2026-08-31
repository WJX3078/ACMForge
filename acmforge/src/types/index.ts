import type { LucideIcon } from 'lucide-react'

/* ── Agents ─────────────────────────────────────────────────────────────── */

export type AgentStatus = 'running' | 'thinking' | 'waiting' | 'completed' | 'failed'

export type AgentId =
  | 'idea-scout'
  | 'problem-designer'
  | 'duplicate-detector'
  | 'solution-agent'
  | 'test-generator'
  | 'stress-tester'
  | 'editorial-writer'

export type LogLevel = 'info' | 'debug' | 'warn' | 'error' | 'success'

export interface LogLine {
  id: string
  /** milliseconds since the current cycle started */
  at: number
  level: LogLevel
  text: string
}

export type ToolCallStatus = 'ok' | 'running' | 'failed'

export interface ToolCall {
  id: string
  name: string
  detail: string
  status: ToolCallStatus
  durationMs: number
  at: number
}

export interface AgentStepLog {
  /** 0..1 position inside the step when this line is emitted */
  at: number
  level: LogLevel
  text: string
}

export interface AgentStepDef {
  label: string
  detail: string
  durationMs: number
  logs: AgentStepLog[]
  toolCalls?: { name: string; detail: string; durationMs: number; at: number }[]
  tokensIn?: number
  tokensOut?: number
  ioIn?: number
  ioOut?: number
}

export interface AgentDef {
  id: AgentId
  name: string
  codename: string
  role: string
  description: string
  icon: LucideIcon
  /** start delay relative to cycle start, in ms */
  startDelayMs: number
  steps: AgentStepDef[]
  /** deterministic failure: fail on this step when (cycle % failEvery) === 0 */
  failOnStep?: number
  failEvery?: number
  failMessage?: string
}

export interface AgentRuntime {
  id: AgentId
  status: AgentStatus
  stepIndex: number
  /** ms elapsed inside the current step */
  stepElapsed: number
  /** ms elapsed since this agent started in the current cycle */
  elapsed: number
  cycle: number
  /** true when an upstream agent failed and this one can never start */
  blocked: boolean
  /** how many log lines of the current step have already been emitted */
  stepLogsEmitted: number
  /** how many tool calls of the current step have already been emitted */
  stepToolsEmitted: number
  logs: LogLine[]
  toolCalls: ToolCall[]
  tokens: { in: number; out: number }
  io: { in: number; out: number }
  error?: string
}

export interface EngineState {
  cycle: number
  /** ms since the current cycle started */
  cycleElapsed: number
  /** ms spent idling between cycles */
  idleElapsed: number
  agents: Record<AgentId, AgentRuntime>
}

/* ── Problems ───────────────────────────────────────────────────────────── */

export type ProblemStatus = 'ready' | 'testing' | 'stress-testing' | 'generating' | 'failed' | 'draft'
export type ProblemStyle = 'ICPC' | 'Codeforces' | 'OI' | 'Educational'

export interface Example {
  input: string
  output: string
  note?: string
}

export interface ProblemStatement {
  legend: string[]
  input: string[]
  output: string[]
  examples: Example[]
  notes: string[]
}

export interface Problem {
  id: string
  title: string
  difficulty: number
  algorithms: string[]
  status: ProblemStatus
  uniqueness: number
  tests: number
  createdAt: string
  style: ProblemStyle
  timeLimitMs: number
  memoryLimitMb: number
  author: string
  statement: ProblemStatement
  solution: string
  keyIdeas: string[]
}

export interface Submission {
  id: string
  problemId: string
  language: string
  verdict: 'AC' | 'WA' | 'TLE' | 'RE' | 'MLE'
  timeMs: number
  memoryKb: number
  submittedAt: string
  author: string
}

export interface TestFile {
  id: string
  index: number
  group: 'sample' | 'small' | 'boundary' | 'max' | 'adversarial'
  bytes: number
  generator: string
  seed: number
  verdict: 'ok' | 'warn'
  note: string
}

/* ── Ideas ──────────────────────────────────────────────────────────────── */

export type IdeaStatus = 'new' | 'starred' | 'converted' | 'rejected'

export interface Idea {
  id: string
  title: string
  summary: string
  tags: string[]
  novelty: number
  feasibility: number
  estDifficulty: number
  source: string
  discoveredAt: string
  status: IdeaStatus
}

/* ── Duplicates ─────────────────────────────────────────────────────────── */

export type PlatformId = 'codeforces' | 'luogu' | 'atcoder' | 'icpc' | 'yuanfudao'

export interface DuplicateHit {
  id: string
  platform: PlatformId
  code: string
  title: string
  similarity: number
  year: number
  difficulty: number
  matchedConcepts: string[]
}

export interface DupSource {
  id: PlatformId
  name: string
  indexed: number
  latencyMs: number
  status: 'ok' | 'timeout' | 'partial'
}

export interface NoveltyReport {
  score: number
  verdict: 'likely-original' | 'needs-review' | 'likely-duplicate'
  scanned: number
  sources: DupSource[]
  hits: DuplicateHit[]
}

/* ── Stress test ────────────────────────────────────────────────────────── */

export interface StressLine {
  id: string
  kind: 'info' | 'test' | 'mismatch' | 'ok' | 'warn' | 'minimize'
  text: string
  detail?: string[]
  at: number
}

export interface Counterexample {
  n: number
  input: string
  reference: string
  candidate: string
}

/* ── Factory run ────────────────────────────────────────────────────────── */

export type FactoryStepStatus = 'pending' | 'running' | 'done' | 'failed'

export interface FactoryStepDef {
  id: string
  label: string
  detail: string
  durationMs: number
  logs: AgentStepLog[]
}

export interface FactoryRunState {
  stepIndex: number
  statuses: FactoryStepStatus[]
  elapsed: number[]
  logs: LogLine[]
  running: boolean
  finished: boolean
}

/* ── Misc ───────────────────────────────────────────────────────────────── */

export interface ThroughputPoint {
  t: string
  generated: number
  rejected: number
}

export interface ActivityItem {
  id: string
  title: string
  detail: string
  kind: 'success' | 'info' | 'warn' | 'error' | 'progress'
  at: string
  unread?: boolean
}
