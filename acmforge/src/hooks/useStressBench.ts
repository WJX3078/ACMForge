import { useCallback, useEffect, useRef, useState } from 'react'
import { COUNTEREXAMPLE_FULL, COUNTEREXAMPLE_MIN, MINIMIZATION_LOG } from '@/data/factory'
import type { StressLine } from '@/types'

const TICK_MS = 620
const START_CASE = 18_240
const FAIL_AT = 18_293

let seq = 0
const nid = () => `st_${(seq++).toString(36)}`

export type StressPhase = 'idle' | 'running' | 'mismatch' | 'minimizing' | 'minimized'

/**
 * Drives the differential bench console.
 *
 * Counters live in refs and are advanced outside React's state updaters. The
 * previous version emitted logs from inside a `setCases` callback, which React
 * StrictMode invokes twice in development — every mismatch was counted twice.
 */
export function useStressBench() {
  const [lines, setLines] = useState<StressLine[]>([])
  const [phase, setPhase] = useState<StressPhase>('idle')
  const [cases, setCases] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [failures, setFailures] = useState(0)
  const [minimized, setMinimized] = useState<{
    full: typeof COUNTEREXAMPLE_FULL
    min: typeof COUNTEREXAMPLE_MIN
  } | null>(null)

  const casesRef = useRef(START_CASE)
  const elapsedRef = useRef(0)
  const timers = useRef<number[]>([])

  const push = useCallback((line: Omit<StressLine, 'id'>) => {
    // the id is minted outside the updater so StrictMode's double-invoke
    // cannot burn sequence numbers
    const entry: StressLine = { ...line, id: nid() }
    setLines((l) => {
      const next = [...l, entry]
      return next.length > 220 ? next.slice(next.length - 220) : next
    })
  }, [])

  // ── differential run ───────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'running') return

    const id = window.setInterval(() => {
      elapsedRef.current += TICK_MS
      const at = elapsedRef.current
      setElapsed(at)

      const batch = 3 + Math.floor(Math.random() * 6)
      for (let i = 0; i < batch; i++) {
        casesRef.current += 1
        const next = casesRef.current

        if (next < FAIL_AT) {
          const n = 199_900 + Math.floor(Math.random() * 100)
          push({ kind: 'test', text: `Test #${next}  n = ${n}  ok`, at })
          continue
        }

        if (next === FAIL_AT) {
          setFailures((f) => f + 1)
          push({ kind: 'test', text: `Test #${next}  n = 200000`, at })
          push({ kind: 'info', text: 'Reference:  127391', at })
          push({ kind: 'info', text: 'Candidate:  127390', at })
          push({ kind: 'mismatch', text: 'MISMATCH FOUND', at })
          setCases(next)
          setPhase('mismatch')
          break
        }

        // past the injected failure — nothing left to do
        break
      }

      setCases(casesRef.current)
    }, TICK_MS)

    return () => window.clearInterval(id)
  }, [phase, push])

  const start = useCallback(() => {
    if (phase === 'running' || phase === 'minimizing') return
    casesRef.current = START_CASE
    elapsedRef.current = 0
    setCases(START_CASE)
    setElapsed(0)
    setFailures(0)
    setMinimized(null)
    setLines([])
    push({ kind: 'info', text: 'Compiling reference… g++ -O2 -std=c++17 ✓', at: 0 })
    push({ kind: 'info', text: 'Compiling candidate #2… g++ -O2 -std=c++17 ✓', at: 0 })
    push({ kind: 'info', text: `Resuming differential run at seed 0x5EED · case #${START_CASE}`, at: 0 })
    setPhase('running')
  }, [phase, push])

  const stop = useCallback(() => setPhase('idle'), [])

  const reset = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
    casesRef.current = START_CASE
    elapsedRef.current = 0
    setLines([])
    setCases(0)
    setElapsed(0)
    setFailures(0)
    setMinimized(null)
    setPhase('idle')
  }, [])

  const minimize = useCallback(() => {
    if (phase !== 'mismatch') return
    setPhase('minimizing')
    const at = elapsedRef.current
    push({ kind: 'minimize', text: 'Minimising counterexample · delta debugging', at })

    MINIMIZATION_LOG.forEach((line, i) => {
      const t = window.setTimeout(() => push({ kind: 'minimize', text: line, at }), 340 * (i + 1))
      timers.current.push(t)
    })

    const done = window.setTimeout(
      () => {
        setMinimized({ full: COUNTEREXAMPLE_FULL, min: COUNTEREXAMPLE_MIN })
        push({ kind: 'minimize', text: `Minimal case found · n = ${COUNTEREXAMPLE_MIN.n}`, at })
        setPhase('minimized')
      },
      340 * (MINIMIZATION_LOG.length + 1) + 180,
    )
    timers.current.push(done)
  }, [phase, push])

  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t))
    },
    [],
  )

  return {
    lines,
    phase,
    cases,
    failures,
    elapsed,
    minimized,
    running: phase === 'running',
    start,
    stop,
    reset,
    minimize,
  }
}
