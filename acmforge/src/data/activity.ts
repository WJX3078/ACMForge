import type { ActivityItem } from '@/types'

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()

export const NOTIFICATIONS: ActivityItem[] = [
  {
    id: 'n1',
    title: 'Temporal Bridge is judge-ready',
    detail: '42 tests · 96% uniqueness · package exported',
    kind: 'success',
    at: ago(2),
    unread: true,
  },
  {
    id: 'n2',
    title: 'Duplicate Detector flagged a review',
    detail: 'Luogu P7412 at 0.31 — below threshold, kept',
    kind: 'info',
    at: ago(9),
    unread: true,
  },
  {
    id: 'n3',
    title: 'Stress Tester hit a mismatch',
    detail: 'Ledger of Shadows · test #18293 · minimising…',
    kind: 'error',
    at: ago(24),
    unread: true,
  },
  {
    id: 'n4',
    title: 'Idea Scout indexed 428 new problems',
    detail: 'Codeforces 214 · Luogu 118 · AtCoder 96',
    kind: 'info',
    at: ago(51),
  },
  {
    id: 'n5',
    title: 'Yuantiji source timed out',
    detail: 'Retrying with a 4 s budget on the next cycle',
    kind: 'warn',
    at: ago(96),
  },
]

export const ACTIVITY_FEED: ActivityItem[] = [
  {
    id: 'a1',
    title: 'Stress Tester',
    detail: 'Test #18492 · n = 200000 · ok',
    kind: 'progress',
    at: ago(0.1),
  },
  {
    id: 'a2',
    title: 'Duplicate Detector',
    detail: 'Comparing 213 problems…',
    kind: 'progress',
    at: ago(0.4),
  },
  {
    id: 'a3',
    title: 'Idea Scout',
    detail: 'Searching 5 sources…',
    kind: 'progress',
    at: ago(0.9),
  },
  {
    id: 'a4',
    title: 'Test Generator',
    detail: '42 / 42 cases written',
    kind: 'success',
    at: ago(3),
  },
  {
    id: 'a5',
    title: 'Solution Agent',
    detail: 'Compiled reference · 68 lines · 0 warnings',
    kind: 'success',
    at: ago(6),
  },
  {
    id: 'a6',
    title: 'Editorial Writer',
    detail: 'Rendered fig-2: D&C recursion tree',
    kind: 'success',
    at: ago(12),
  },
]

export const GLOBAL_AGENT_TASKS = [
  { id: 'idea-scout', task: 'Searching 5 sources…' },
  { id: 'duplicate-detector', task: 'Comparing 213 problems…' },
  { id: 'stress-tester', task: 'Test #18492…' },
  { id: 'solution-agent', task: 'Compiling candidate #2…' },
  { id: 'test-generator', task: 'Validating case #42…' },
  { id: 'problem-designer', task: 'Tuning difficulty…' },
  { id: 'editorial-writer', task: 'Writing §3 Correctness…' },
]
