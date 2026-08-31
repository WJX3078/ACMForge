import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

const RADIUS = 52
const CIRC = 2 * Math.PI * RADIUS

export function NoveltyGauge({
  score,
  verdict,
  scanning,
}: {
  score: number
  verdict: string
  scanning: boolean
}) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (scanning) {
      setValue(0)
      return
    }
    const t0 = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 900)
      setValue(score * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [score, scanning])

  const tone =
    score >= 90 ? 'stroke-ok text-ok' : score >= 70 ? 'stroke-warn text-warn' : 'stroke-danger text-danger'

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-[132px] w-[132px]">
        <svg viewBox="0 0 132 132" className="h-full w-full -rotate-90">
          <circle
            cx="66"
            cy="66"
            r={RADIUS}
            fill="none"
            strokeWidth="7"
            className="stroke-[hsl(var(--fg)/0.07)]"
          />
          <circle
            cx="66"
            cy="66"
            r={RADIUS}
            fill="none"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC - (CIRC * value) / 100}
            className={cn('transition-[stroke] duration-500', tone.split(' ')[0])}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="tabular text-3xl font-semibold tracking-[-0.03em] text-fg">
            {Math.round(value)}
          </span>
          <span className="text-2xs text-fg-subtle">/ 100</span>
        </div>
      </div>
      <div className="mt-2.5 text-center">
        <div className={cn('text-md font-semibold', tone.split(' ')[1])}>{verdict}</div>
        <div className="mt-0.5 text-xs text-fg-muted">
          {scanning ? 'Scanning…' : 'Max similarity 0.31 · threshold 0.62'}
        </div>
      </div>
    </div>
  )
}
