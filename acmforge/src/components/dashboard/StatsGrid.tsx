import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { CountUp, ProgressBar } from '@/components/ui/primitives'
import { Sparkline, seededSeries } from '@/components/common/Sparkline'
import { DASHBOARD_STATS } from '@/data/problems'
import { cn } from '@/lib/utils'

export function StatsGrid() {
  return (
    <div className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      {DASHBOARD_STATS.map((s, i) => {
        const positive = !s.delta.startsWith('-')
        const series = seededSeries(s.value + i * 37, 22)
        const peak = Math.max(...series)
        return (
          <div
            key={s.key}
            className="group panel relative overflow-hidden px-3.5 py-3 transition-colors duration-200 hover:border-line-strong"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="eyebrow">{s.label}</span>
              <Sparkline
                data={series}
                width={54}
                height={20}
                className="opacity-70 transition-opacity duration-200 group-hover:opacity-100"
              />
            </div>
            <div className="tabular mt-2 text-2xl font-semibold tracking-[-0.02em] text-fg">
              <CountUp value={s.value} delay={i * 90} />
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 rounded-sm px-1 py-[1px] text-2xs font-medium',
                  positive ? 'bg-ok-soft text-ok' : 'bg-danger-soft text-danger',
                )}
              >
                {positive ? (
                  <ArrowUpRight className="h-2.5 w-2.5" />
                ) : (
                  <ArrowDownRight className="h-2.5 w-2.5" />
                )}
                {s.delta.replace('+', '').replace(' today', '')}
              </span>
              <span className="text-2xs text-fg-subtle">today</span>
            </div>
            <ProgressBar value={peak} className="mt-2.5" tone={positive ? 'brand' : 'danger'} />
          </div>
        )
      })}
    </div>
  )
}
