import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { FACTORY_STEPS } from '@/data/factory'
import { PROBLEMS } from '@/data/problems'
import type { FactoryStepStatus, LogLine } from '@/types'

const TICK_MS = 120
const MAX_LOGS = 200

export interface FactoryConfig {
  prompt: string
  difficulty: [number, number]
  tags: string[]
  style: string
  innovation: string
}

export interface FactoryResult {
  title: string
  difficulty: number
  algorithms: string[]
  uniqueness: number
  tests: number
  problemId: string
  durationMs: number
}

interface State {
  config: FactoryConfig | null
  stepIndex: number
  statuses: FactoryStepStatus[]
  elapsed: number[]
  emitted: number[]
  logs: LogLine[]
  running: boolean
  finished: boolean
  result: FactoryResult | null
}

type Action = { type: 'start'; config: FactoryConfig } | { type: 'tick'; dt: number } | { type: 'reset' }

const emptyStatuses = () => FACTORY_STEPS.map(() => 'pending' as FactoryStepStatus)

const initial: State = {
  config: null,
  stepIndex: 0,
  statuses: emptyStatuses(),
  elapsed: FACTORY_STEPS.map(() => 0),
  emitted: FACTORY_STEPS.map(() => 0),
  logs: [],
  running: false,
  finished: false,
  result: null,
}

const TITLE_POOL = [
  'Temporal Bridge',
  'Crystal Conveyor',
  'Infinite Orchard',
  'Phantom Palindrome',
  'Mirrored Canopy',
  'Ledger of Shadows',
  'Modular Menagerie',
  'Conveyor Junction',
  'Echoing Lattice',
  'Sable Meridian',
]

let seq = 0
const nid = () => `fl_${(seq++).toString(36)}`

function buildResult(config: FactoryConfig, durationMs: number): FactoryResult {
  const seed = config.prompt.length + config.difficulty[0] + config.tags.length * 17
  const title = TITLE_POOL[seed % TITLE_POOL.length]
  const target = Math.round((config.difficulty[0] + config.difficulty[1]) / 2 / 100) * 100
  const match = PROBLEMS.find((p) => p.algorithms.some((a) => config.tags.includes(a)))
  return {
    title,
    difficulty: Math.max(800, Math.min(3500, target + ((seed % 3) - 1) * 100)),
    algorithms: config.tags.length ? config.tags : ['Data Structure'],
    uniqueness: 84 + (seed % 15),
    tests: 24 + (seed % 40),
    problemId: match?.id ?? PROBLEMS[0].id,
    durationMs,
  }
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'reset':
      return initial
    case 'start':
      return {
        ...initial,
        config: action.config,
        statuses: FACTORY_STEPS.map((_, i) => (i === 0 ? 'running' : 'pending')),
        logs: [{ id: nid(), at: 0, level: 'info', text: `Run started · target ${action.config.difficulty[0]}–${action.config.difficulty[1]}` }],
        running: true,
      }
    case 'tick': {
      if (!state.running) return state
      const i = state.stepIndex
      const step = FACTORY_STEPS[i]
      if (!step) return { ...state, running: false, finished: true }

      const elapsed = state.elapsed.slice()
      const emitted = state.emitted.slice()
      const statuses = state.statuses.slice()
      const logs = state.logs.slice()
      elapsed[i] += action.dt

      const progress = elapsed[i] / step.durationMs
      const base = state.elapsed.slice(0, i).reduce((s, x) => s + x, 0)
      while (emitted[i] < step.logs.length && progress >= step.logs[emitted[i]].at) {
        const line = step.logs[emitted[i]]
        logs.push({ id: nid(), at: base + elapsed[i], level: line.level, text: line.text })
        emitted[i]++
      }
      if (logs.length > MAX_LOGS) logs.splice(0, logs.length - MAX_LOGS)

      if (elapsed[i] < step.durationMs) {
        return { ...state, elapsed, emitted, logs }
      }

      statuses[i] = 'done'
      const nextIndex = i + 1
      if (nextIndex >= FACTORY_STEPS.length) {
        const durationMs = FACTORY_STEPS.reduce((s, x) => s + x.durationMs, 0)
        return {
          ...state,
          elapsed,
          emitted,
          logs,
          statuses,
          stepIndex: nextIndex,
          running: false,
          finished: true,
          result: buildResult(state.config!, durationMs),
        }
      }
      statuses[nextIndex] = 'running'
      return { ...state, elapsed, emitted, logs, statuses, stepIndex: nextIndex }
    }
  }
}

export function useFactoryRun() {
  const [state, dispatch] = useReducer(reducer, initial)
  const rafFree = useRef(true)

  useEffect(() => {
    if (!state.running) return
    const id = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return
      if (!rafFree.current) return
      rafFree.current = false
      dispatch({ type: 'tick', dt: TICK_MS })
      rafFree.current = true
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [state.running])

  const start = useCallback((config: FactoryConfig) => dispatch({ type: 'start', config }), [])
  const reset = useCallback(() => dispatch({ type: 'reset' }), [])

  const totalElapsed = useMemo(() => state.elapsed.reduce((s, x) => s + x, 0), [state.elapsed])
  const totalDuration = useMemo(
    () => FACTORY_STEPS.reduce((s, x) => s + x.durationMs, 0),
    [],
  )

  return { ...state, start, reset, totalElapsed, totalDuration, steps: FACTORY_STEPS }
}
