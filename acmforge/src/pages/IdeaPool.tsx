import { ArrowUpRight, Search, Sparkles, Star } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, DifficultyBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChipGroup, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/controls'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { PageHeader } from '@/components/layout/AppShell'
import { IDEA_SOURCE_FILTERS, IDEAS } from '@/data/ideas'
import { useUi } from '@/hooks/useUi'
import { cn, formatRelative } from '@/lib/utils'
import type { Idea } from '@/types'

const TAG_FILTERS = ['DP', 'Graph', 'Greedy', 'Math', 'Data Structure', 'String', 'Geometry', 'Flow']

function IdeaCard({
  idea,
  starred,
  onStar,
  onSend,
}: {
  idea: Idea
  starred: boolean
  onStar: () => void
  onSend: () => void
}) {
  return (
    <div className="group flex flex-col rounded-lg border border-line bg-surface p-3.5 transition-all duration-200 hover:border-line-strong hover:bg-surface-raised">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-md font-semibold tracking-[-0.01em] text-fg">{idea.title}</h3>
          <div className="mt-0.5 text-2xs text-fg-subtle">
            {idea.source} · {formatRelative(idea.discoveredAt)}
          </div>
        </div>
        <button
          type="button"
          onClick={onStar}
          aria-label="Star idea"
          className={cn(
            'shrink-0 rounded-sm p-1 transition-colors',
            starred ? 'text-warn' : 'text-fg-subtle hover:text-fg',
          )}
        >
          <Star className={cn('h-3.5 w-3.5', starred && 'fill-current')} />
        </button>
      </div>

      <p className="mt-2 line-clamp-3 text-sm leading-[20px] text-fg-muted">{idea.summary}</p>

      <div className="mt-2.5 flex flex-wrap gap-1">
        {idea.tags.map((t) => (
          <span key={t} className="rounded-sm bg-[hsl(var(--fg)/0.05)] px-1.5 py-[1px] text-2xs text-fg-muted">
            {t}
          </span>
        ))}
        <span className="ml-auto">
          <DifficultyBadge value={idea.estDifficulty} showDot={false} />
        </span>
      </div>

      <div className="mt-3 space-y-1.5 border-t border-line pt-2.5">
        {[
          { label: 'Novelty', value: idea.novelty },
          { label: 'Feasibility', value: idea.feasibility },
        ].map((m) => (
          <div key={m.label} className="flex items-center gap-2">
            <span className="w-[68px] shrink-0 text-2xs text-fg-subtle">{m.label}</span>
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-[hsl(var(--fg)/0.07)]">
              <div
                className={cn(
                  'h-full rounded-full',
                  m.value >= 85 ? 'bg-ok' : m.value >= 60 ? 'bg-brand' : 'bg-warn',
                )}
                style={{ width: `${m.value}%` }}
              />
            </div>
            <span className="tabular w-7 shrink-0 text-right text-2xs text-fg-muted">{m.value}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-1.5">
        {idea.status === 'converted' && <Badge variant="brand" size="sm">converted</Badge>}
        {idea.status === 'rejected' && <Badge variant="danger" size="sm">rejected</Badge>}
        <Button variant="secondary" size="sm" className="ml-auto" onClick={onSend}>
          <Sparkles className="h-3.5 w-3.5" />
          Send to Factory
          <ArrowUpRight className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}

export default function IdeaPool() {
  const navigate = useNavigate()
  const { toast } = useUi()
  const [query, setQuery] = useState('')
  const [source, setSource] = useState('All sources')
  const [tags, setTags] = useState<string[]>([])
  const [starred, setStarred] = useState<Record<string, boolean>>({})

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return IDEAS.filter((i) => {
      if (q && !`${i.title} ${i.summary} ${i.tags.join(' ')}`.toLowerCase().includes(q)) return false
      if (source !== 'All sources' && !i.source.includes(source)) return false
      if (tags.length && !i.tags.some((t) => tags.includes(t))) return false
      return true
    }).sort((a, b) => b.novelty - a.novelty)
  }, [query, source, tags])

  const avgNovelty = Math.round(IDEAS.reduce((s, i) => s + i.novelty, 0) / IDEAS.length)
  const converted = IDEAS.filter((i) => i.status === 'converted').length

  return (
    <div>
      <PageHeader
        title="Idea Pool"
        description="Every candidate region the Scout has surfaced, ranked by novelty and feasibility."
      />

      <Panel className="mb-3">
        <div className="grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x">
          {[
            { label: 'Candidates', value: IDEAS.length },
            { label: 'Avg novelty', value: `${avgNovelty}` },
            { label: 'Converted', value: converted },
            { label: 'Starred', value: IDEAS.filter((i) => i.status === 'starred').length + Object.values(starred).filter(Boolean).length },
          ].map((s) => (
            <div key={s.label} className="px-3.5 py-2.5">
              <div className="eyebrow">{s.label}</div>
              <div className="tabular mt-1 text-lg font-semibold text-fg">{s.value}</div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="mb-3">
        <div className="flex flex-wrap items-center gap-2 p-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-subtle" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search ideas, tags, sources…"
              className="h-8 w-full rounded-md border border-line bg-surface-sunken pl-8 pr-3 text-base text-fg outline-none transition-colors placeholder:text-fg-subtle focus:border-[hsl(var(--brand)/0.6)]"
            />
          </div>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger className="w-[190px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {IDEA_SOURCE_FILTERS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="tabular text-xs text-fg-subtle">{rows.length} results</span>
        </div>
        <div className="border-t border-line px-3 py-2.5">
          <ChipGroup options={TAG_FILTERS} selected={tags} onToggle={(t) => setTags((c) => (c.includes(t) ? c.filter((x) => x !== t) : [...c, t]))} />
        </div>
      </Panel>

      <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((idea) => (
          <IdeaCard
            key={idea.id}
            idea={idea}
            starred={starred[idea.id] ?? idea.status === 'starred'}
            onStar={() =>
              setStarred((s) => ({
                ...s,
                [idea.id]: !(s[idea.id] ?? idea.status === 'starred'),
              }))
            }
            onSend={() => {
              navigate('/factory')
              toast({
                title: 'Idea sent to the factory',
                description: idea.title,
                kind: 'success',
              })
            }}
          />
        ))}
      </div>

      {rows.length === 0 && (
        <Panel>
          <PanelHeader title="No ideas match" />
          <div className="px-4 py-10 text-center text-base text-fg-subtle">
            Try a broader query or clear the tag filters.
          </div>
        </Panel>
      )}
    </div>
  )
}
