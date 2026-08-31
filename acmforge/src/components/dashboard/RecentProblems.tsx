import { ArrowUpRight, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { DifficultyBadge, StatusBadge } from '@/components/ui/badge'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { PROBLEMS } from '@/data/problems'
import { cn, formatRelative } from '@/lib/utils'

export function UniquenessCell({ value }: { value: number }) {
  const tone = value >= 95 ? 'bg-ok' : value >= 85 ? 'bg-brand' : 'bg-warn'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 w-14 overflow-hidden rounded-full bg-[hsl(var(--fg)/0.08)]">
        <div className={cn('h-full rounded-full', tone)} style={{ width: `${value}%` }} />
      </div>
      <span className="tabular w-8 text-right text-sm text-fg-muted">{value}%</span>
    </div>
  )
}

export function RecentProblems({ limit = 6 }: { limit?: number }) {
  const navigate = useNavigate()
  const rows = PROBLEMS.slice(0, limit)

  return (
    <Panel>
      <PanelHeader
        title="Recent Problems"
        description={`${PROBLEMS.length} in the workspace`}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => navigate('/problems')}>
              View all
            </Button>
            <Button variant="primary" size="icon-sm" onClick={() => navigate('/factory')} aria-label="New problem">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </>
        }
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse">
          <thead>
            <tr className="border-b border-line text-left">
              {['Problem', 'Difficulty', 'Algorithm', 'Status', 'Uniqueness', 'Tests', 'Created'].map((h) => (
                <th
                  key={h}
                  className={cn(
                    'px-4 py-2 text-2xs font-semibold uppercase tracking-[0.07em] text-fg-subtle',
                    (h === 'Tests' || h === 'Created') && 'text-right',
                  )}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr
                key={p.id}
                onClick={() => navigate(`/problems/${p.id}`)}
                className="group cursor-pointer border-b border-line transition-colors last:border-0 hover:bg-[hsl(var(--fg)/0.03)]"
              >
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base font-medium text-fg">{p.title}</span>
                    <ArrowUpRight className="h-3 w-3 text-fg-subtle opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <div className="mt-0.5 font-mono text-2xs text-fg-subtle">{p.id}</div>
                </td>
                <td className="px-4 py-2.5">
                  <DifficultyBadge value={p.difficulty} />
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {p.algorithms.map((a) => (
                      <span
                        key={a}
                        className="rounded-sm bg-[hsl(var(--fg)/0.05)] px-1.5 py-[1px] text-xs text-fg-muted"
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <StatusBadge status={p.status} />
                </td>
                <td className="px-4 py-2.5">
                  <UniquenessCell value={p.uniqueness} />
                </td>
                <td className="tabular px-4 py-2.5 text-right text-base text-fg-muted">{p.tests}</td>
                <td className="px-4 py-2.5 text-right text-sm whitespace-nowrap text-fg-subtle">
                  {formatRelative(p.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}
