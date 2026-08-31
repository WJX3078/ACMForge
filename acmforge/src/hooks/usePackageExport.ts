import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  artifactDigest,
  artifactName,
  buildGates,
  buildManifest,
  buildPlan,
  gatesBlocked,
  PACKAGE_FORMATS,
  type PackageFormatId,
} from '@/data/package'
import type { LogLine, Problem } from '@/types'

export type ExportPhase = 'idle' | 'building' | 'done'

/**
 * Drives the Package Export drawer.
 *
 * Same discipline as `useStressBench`: all progression happens in timer
 * callbacks, never inside a state updater, so StrictMode's double-invoke
 * cannot duplicate log lines or fire the completion handler twice.
 */
export function usePackageExport(problem: Problem | undefined) {
  const [format, setFormatState] = useState<PackageFormatId>('polygon')
  const [phase, setPhase] = useState<ExportPhase>('idle')
  const [lines, setLines] = useState<LogLine[]>([])
  const [stepIndex, setStepIndex] = useState(0)
  const timers = useRef<number[]>([])

  const entries = useMemo(
    () => (problem ? buildManifest(problem, format) : []),
    [problem, format],
  )
  const gates = useMemo(() => (problem ? buildGates(problem) : []), [problem])
  const plan = useMemo(
    () => (problem ? buildPlan(problem, format, entries) : []),
    [problem, format, entries],
  )
  const fmt = PACKAGE_FORMATS.find((f) => f.id === format)!
  const blocked = gatesBlocked(gates)

  const fileCount = entries.reduce((s, e) => s + (e.count ?? 1), 0)
  const totalBytes = entries.reduce((s, e) => s + (e.bytes ?? 0), 0)

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
  }, [])

  /** leave the drawer in its pre-build state; used on close too */
  const reset = useCallback(() => {
    clearTimers()
    setLines([])
    setStepIndex(0)
    setPhase('idle')
  }, [clearTimers])

  const setFormat = useCallback(
    (f: PackageFormatId) => {
      clearTimers()
      setFormatState(f)
      setLines([])
      setStepIndex(0)
      setPhase('idle')
    },
    [clearTimers],
  )

  const build = useCallback(() => {
    if (!problem || blocked || phase === 'building') return
    clearTimers()
    setLines([])
    setStepIndex(0)
    setPhase('building')

    let acc = 0
    plan.forEach((step, i) => {
      acc += step.durationMs
      const at = acc
      const entry: LogLine = { id: `pk_${i}`, at, level: step.level, text: step.text }
      const t = window.setTimeout(() => {
        setLines((l) => (l.length > 200 ? [...l.slice(-199), entry] : [...l, entry]))
        setStepIndex(i + 1)
        if (i === plan.length - 1) setPhase('done')
      }, at)
      timers.current.push(t)
    })
  }, [problem, blocked, phase, plan, clearTimers])

  useEffect(() => clearTimers, [clearTimers])
  useEffect(() => {
    reset()
  }, [problem?.id, reset])

  const artifact = problem
    ? {
        name: artifactName(problem, fmt),
        bytes: totalBytes,
        sha256: artifactDigest(problem, format),
        files: fileCount,
      }
    : null

  return {
    format,
    setFormat,
    fmt,
    entries,
    gates,
    blocked,
    plan,
    phase,
    lines,
    stepIndex,
    fileCount,
    totalBytes,
    artifact,
    build,
    reset,
  }
}
