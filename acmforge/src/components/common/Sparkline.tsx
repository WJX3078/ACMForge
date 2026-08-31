import { useMemo } from 'react'
import { cn } from '@/lib/utils'

/** Deterministic 20-point series derived from a seed — no randomness across renders. */
export function seededSeries(seed: number, points = 20, amplitude = 1) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  const out: number[] = []
  let v = 0.5
  for (let i = 0; i < points; i++) {
    s = (s * 16807) % 2147483647
    const r = s / 2147483647
    v = Math.min(1, Math.max(0.08, v * 0.72 + r * 0.42))
    out.push(v * amplitude)
  }
  return out
}

export function Sparkline({
  data,
  className,
  stroke = 'hsl(var(--brand))',
  fill = 'hsl(var(--brand) / 0.12)',
  height = 28,
  width = 96,
}: {
  data: number[]
  className?: string
  stroke?: string
  fill?: string
  height?: number
  width?: number
}) {
  const { line, area } = useMemo(() => {
    const max = Math.max(...data, 0.0001)
    const min = Math.min(...data)
    const span = Math.max(0.0001, max - min)
    const pts = data.map((v, i) => {
      const x = (i / (data.length - 1)) * width
      const y = height - 2 - ((v - min) / span) * (height - 6)
      return [x, y] as const
    })
    const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
    return {
      line: d,
      area: `${d} L${width},${height} L0,${height} Z`,
    }
  }, [data, height, width])

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={cn('overflow-visible', className)}
      aria-hidden
    >
      <path d={area} fill={fill} />
      <path d={line} fill="none" stroke={stroke} strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
