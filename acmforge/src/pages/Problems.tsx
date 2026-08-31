import { ArrowDownUp, Download, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DifficultyBadge, StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChipGroup, Segmented, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/controls'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { EmptyState } from '@/components/ui/primitives'
import { PackageExportSheet } from '@/components/export/PackageExportSheet'
import { PageHeader } from '@/components/layout/AppShell'
import { UniquenessCell } from '@/components/dashboard/RecentProblems'
import { PROBLEMS } from '@/data/problems'
import { cn, formatRelative } from '@/lib/utils'
import type { Problem, ProblemStatus } from '@/types'

const STATUS_FILTERS = ['All', 'ready', 'testing', 'stress-testing', 'generating', 'failed', 'draft'] as const
const SORTS = ['Newest', 'Difficulty', 'Uniqueness', 'Tests'] as const
const TAGS = ['DP', 'Graph', 'Greedy', 'Math', 'Data Structure', 'String', 'Geometry', 'Flow']

export default function Problems() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<string>('All')
  const [sort, setSort] = useState<string>('Newest')
  const [tags, setTags] = useState<string[]>([])
  const [exportTarget, setExportTarget] = useState<Problem | null>(null)
  const [exportOpen, setExportOpen] = useState(false)

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = PROBLEMS.filter((p) => {
      if (status !== 'All' && p.status !== status) return false
      if (q && !`${p.title} ${p.id} ${p.algorithms.join(' ')}`.toLowerCase().includes(q)) return false
      if (tags.length && !p.algorithms.some((a) => tags.includes(a))) return false
      return true
    })
    const sorted = [...filtered]
    if (sort === 'Difficulty') sorted.sort((a, b) => b.difficulty - a.difficulty)
    if (sort === 'Uniqueness') sorted.sort((a, b) => b.uniqueness - a.uniqueness)
    if (sort === 'Tests') sorted.sort((a, b) => b.tests - a.tests)
    if (sort === 'Newest') sorted.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    return sorted
  }, [query, status, sort, tags])

  const counts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const p of PROBLEMS) map[p.status] = (map[p.status] ?? 0) + 1
    return map
  }, [])

  return (
    <div>
      <PageHeader
        title="Problems"
        description="Every problem the factory has produced, with its current verification state."
      />

      <Panel className="mb-3">
        <div className="grid grid-cols-3 divide-line sm:grid-cols-6 sm:divide-x">
          {(['ready', 'testing', 'stress-testing', 'generating', 'failed', 'draft'] as ProblemStatus[]).map(
            (s) => (
              <div key={s} className="px-3.5 py-2.5">
                <div className="eyebrow truncate">{s.replace('-', ' ')}</div>
                <div className="tabular mt-1 text-lg font-semibold text-fg">{counts[s] ?? 0}</div>
              </div>
            ),
          )}
        </div>
      </Panel>

      <Panel className="mb-3">
        <div className="flex flex-wrap items-center gap-2 p-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-subtle" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title, id or algorithm…"
              className="h-8 w-full rounded-md border border-line bg-surface-sunken pl-8 pr-3 text-base text-fg outline-none transition-colors placeholder:text-fg-subtle focus:border-[hsl(var(--brand)/0.6)]"
            />
          </div>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-[168px]">
              <ArrowDownUp className="h-3.5 w-3.5 text-fg-subtle" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORTS.map((s) => (
                <SelectItem key={s} value={s}>
                  Sort · {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="tabular text-xs text-fg-subtle">{rows.length} of {PROBLEMS.length}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-3 py-2.5">
          <Segmented
            value={status}
            onValueChange={setStatus}
            options={STATUS_FILTERS.map((s) => ({
              value: s,
              label: s === 'All' ? 'All' : s.replace('-', ' '),
            }))}
          />
          <div className="ml-auto">
            <ChipGroup
              options={TAGS}
              selected={tags}
              onToggle={(t) => setTags((c) => (c.includes(t) ? c.filter((x) => x !== t) : [...c, t]))}
            />
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Workspace problems" description="Click a row to open the full package" />
        {rows.length === 0 ? (
          <EmptyState
            icon={<Search className="h-4 w-4" />}
            title="No problems match these filters"
            description="Clear the status filter or widen the search."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse">
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
                  <th className="w-10 px-4 py-2">
                    <span className="sr-only">Export</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => navigate(`/problems/${p.id}`)}
                    className="cursor-pointer border-b border-line transition-colors last:border-0 hover:bg-[hsl(var(--fg)/0.03)]"
                  >
                    <td className="px-4 py-2.5">
                      <div className="text-base font-medium text-fg">{p.title}</div>
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
                    <td className="px-4 py-2.5 text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Export ${p.title}`}
                        title="Export package"
                        onClick={(e) => {
                          e.stopPropagation()
                          setExportTarget(p)
                          setExportOpen(true)
                        }}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <PackageExportSheet
        problem={exportTarget ?? undefined}
        open={exportOpen}
        onOpenChange={setExportOpen}
      />
    </div>
  )
}
