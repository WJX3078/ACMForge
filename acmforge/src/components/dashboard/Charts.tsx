import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { THROUGHPUT } from '@/data/problems'
import { useTheme } from '@/hooks/useTheme'
import { formatNumber } from '@/lib/utils'

export const chartPalette = (theme: 'dark' | 'light') =>
  theme === 'dark'
    ? { brand: '#818cf8', neutral: '#52525b', grid: 'rgba(255,255,255,0.06)', axis: '#71717a' }
    : { brand: '#4f46e5', neutral: '#a1a1aa', grid: 'rgba(0,0,0,0.06)', axis: '#71717a' }

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { name?: string; value?: number; color?: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md border border-line-strong bg-surface-raised px-2 py-1.5 shadow-lift">
      <div className="text-2xs text-fg-subtle">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-xs">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.color }} />
          <span className="text-fg-muted">{p.name}</span>
          <span className="tabular ml-auto font-medium text-fg">{formatNumber(p.value ?? 0)}</span>
        </div>
      ))}
    </div>
  )
}

export function ThroughputChart() {
  const { theme } = useTheme()
  const c = chartPalette(theme)

  return (
    <Panel>
      <PanelHeader
        title="Factory throughput"
        description="Problems packaged vs. rejected, last 24 h"
      />
      <div className="px-2 pt-3 pb-2">
        <ResponsiveContainer width="100%" height={168}>
          <AreaChart data={THROUGHPUT} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="gradGenerated" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c.brand} stopOpacity={0.28} />
                <stop offset="100%" stopColor={c.brand} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradRejected" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c.neutral} stopOpacity={0.2} />
                <stop offset="100%" stopColor={c.neutral} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={c.grid} vertical={false} />
            <XAxis
              dataKey="t"
              tick={{ fontSize: 10, fill: c.axis }}
              axisLine={false}
              tickLine={false}
              interval={1}
            />
            <YAxis tick={{ fontSize: 10, fill: c.axis }} axisLine={false} tickLine={false} width={38} />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: c.grid, strokeWidth: 1 }} />
            <Area
              type="monotone"
              dataKey="rejected"
              name="Rejected"
              stroke={c.neutral}
              strokeWidth={1.4}
              fill="url(#gradRejected)"
            />
            <Area
              type="monotone"
              dataKey="generated"
              name="Packaged"
              stroke={c.brand}
              strokeWidth={1.6}
              fill="url(#gradGenerated)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  )
}
