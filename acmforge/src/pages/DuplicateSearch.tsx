import { AnimatePresence, motion } from 'framer-motion'
import { Fingerprint, Loader2, RefreshCw, ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Badge, DifficultyBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Panel, PanelHeader, SpecRow } from '@/components/ui/panel'
import { Skeleton } from '@/components/ui/primitives'
import { HitRow } from '@/components/duplicates/HitRow'
import { NoveltyGauge } from '@/components/duplicates/NoveltyGauge'
import { PageHeader } from '@/components/layout/AppShell'
import { HITS, NOVELTY, PLATFORM_META, SOURCES } from '@/data/duplicates'
import { PROBLEM_MAP } from '@/data/problems'
import { useUi } from '@/hooks/useUi'
import { cn, formatNumber } from '@/lib/utils'

const SCAN_LOGS = [
  'Embedding statement → 1536-d vector',
  'Querying Codeforces...',
  'Searching Luogu...',
  'Checking Yuantiji...',
  'Rank fusion over 213 candidates',
  'Structural diff · depth 4',
]

const BREAKDOWN = [
  { label: 'Narrative overlap', value: 8 },
  { label: 'Algorithm signature', value: 4 },
  { label: 'Constraint shape', value: 12 },
  { label: 'Sample structure', value: 2 },
]

export default function DuplicateSearch() {
  const { toast } = useUi()
  const [scanning, setScanning] = useState(false)
  const [revealed, setRevealed] = useState(HITS.length)
  const [logCount, setLogCount] = useState(SCAN_LOGS.length)
  const timers = useRef<number[]>([])

  const problem = PROBLEM_MAP['temporal-bridge']

  const rescan = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
    setScanning(true)
    setRevealed(0)
    setLogCount(0)

    SCAN_LOGS.forEach((_, i) => {
      timers.current.push(window.setTimeout(() => setLogCount(i + 1), 260 * (i + 1)))
    })
    HITS.forEach((_, i) => {
      timers.current.push(
        window.setTimeout(() => setRevealed(i + 1), 1600 + i * 190),
      )
    })
    timers.current.push(
      window.setTimeout(() => {
        setScanning(false)
        toast({
          title: 'Duplicate scan complete',
          description: 'Novelty 96 / 100 · no duplicate above 0.62',
          kind: 'success',
        })
      }, 1600 + HITS.length * 190 + 260),
    )
  }, [toast])

  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t))
    },
    [],
  )

  return (
    <div>
      <PageHeader
        title="Duplicate Search"
        description="Three-stage retrieval across five archives before a single token is spent on solution generation."
        actions={
          <Button variant="secondary" size="sm" onClick={rescan} disabled={scanning}>
            {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin-slow" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {scanning ? 'Scanning…' : 'Rescan'}
          </Button>
        }
      />

      <div className="grid gap-3 xl:grid-cols-12">
        {/* ── subject under review ────────────────────────────────────── */}
        <div className="min-w-0 space-y-3 xl:col-span-4">
          <Panel>
            <PanelHeader
              title="Under review"
              description="Candidate brief from Problem Designer"
              actions={<Badge variant="brand">v3</Badge>}
            />
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold tracking-[-0.015em] text-fg">
                    {problem.title}
                  </h2>
                  <div className="mt-1.5 flex items-center gap-2">
                    <DifficultyBadge value={problem.difficulty} />
                    <span className="text-xs text-fg-subtle">{problem.style}</span>
                  </div>
                </div>
              </div>

              <p className="mt-3 text-base leading-[22px] text-fg-muted">
                {problem.statement.legend[0]}
              </p>

              <div className="mt-4">
                <div className="eyebrow mb-1.5">Problem Summary</div>
                <p className="text-sm leading-[20px] text-fg-muted">
                  {problem.statement.legend[1]}
                </p>
              </div>

              <div className="mt-4">
                <div className="eyebrow mb-1.5">Core Algorithm</div>
                <div className="flex flex-wrap gap-1.5">
                  {problem.algorithms.map((a) => (
                    <span
                      key={a}
                      className="rounded-sm bg-[hsl(var(--fg)/0.05)] px-1.5 py-[1px] text-xs text-fg"
                    >
                      {a}
                    </span>
                  ))}
                  <span className="rounded-sm border border-line px-1.5 py-[1px] text-xs text-fg-subtle">
                    Rollback DSU
                  </span>
                </div>
              </div>

              <div className="mt-4">
                <div className="eyebrow mb-1.5">Key Observation</div>
                <ul className="space-y-1.5">
                  {problem.keyIdeas.map((k) => (
                    <li key={k} className="flex gap-2 text-sm leading-[19px] text-fg-muted">
                      <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-brand" />
                      <span>{k}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-4 border-t border-line pt-2">
                <SpecRow label="Constraints" value="n, q ≤ 2·10⁵" />
                <SpecRow label="Time limit" value={`${problem.timeLimitMs} ms`} />
                <SpecRow label="Memory limit" value={`${problem.memoryLimitMb} MB`} />
                <SpecRow label="Samples" value={problem.statement.examples.length} />
              </div>
            </div>
          </Panel>
        </div>

        {/* ── search results ──────────────────────────────────────────── */}
        <div className="min-w-0 space-y-3 xl:col-span-8">
          <Panel>
            <PanelHeader
              title="Similarity search"
              description={
                <span className="flex items-center gap-2">
                  <span className="tabular">{formatNumber(NOVELTY.scanned)} problems indexed</span>
                  <span className="text-fg-subtle">·</span>
                  <span>{SOURCES.length} sources</span>
                </span>
              }
              actions={
                <span className="flex items-center gap-1.5 text-2xs text-fg-subtle">
                  <span className="h-px w-4 bg-danger/60" />
                  threshold 0.62
                </span>
              }
            />

            {/* source strip */}
            <div className="grid grid-cols-2 gap-px border-b border-line bg-line sm:grid-cols-5">
              {SOURCES.map((s) => (
                <div key={s.id} className="bg-surface px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn('truncate text-sm font-medium', PLATFORM_META[s.id].accent)}>
                      {s.name}
                    </span>
                    {s.status === 'ok' ? (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ok" />
                    ) : s.status === 'partial' ? (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-warn" />
                    ) : (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-danger" />
                    )}
                  </div>
                  <div className="tabular mt-1 text-md font-semibold text-fg">
                    {formatNumber(s.indexed)}
                  </div>
                  <div className="tabular mt-0.5 text-2xs text-fg-subtle">
                    {scanning ? (
                      <Skeleton className="h-[10px] w-12" />
                    ) : s.status === 'timeout' ? (
                      <span className="text-danger">timeout</span>
                    ) : (
                      `${s.latencyMs} ms`
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* scan console */}
            <AnimatePresence initial={false}>
              {scanning && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden border-b border-line bg-surface-sunken"
                >
                  <div className="px-4 py-2.5 font-mono text-xs leading-[18px]">
                    {SCAN_LOGS.slice(0, logCount).map((l) => (
                      <div key={l} className="flex animate-log-in gap-2">
                        <Loader2 className="mt-[2px] h-2.5 w-2.5 shrink-0 animate-spin-slow text-brand" />
                        <span className="text-fg-muted">{l}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="divide-y divide-line">
              {HITS.map((hit, i) => (
                <HitRow key={hit.id} hit={hit} revealed={revealed > i} index={i} />
              ))}
            </div>
          </Panel>

          {/* novelty verdict */}
          <Panel>
            <PanelHeader
              title="Novelty verdict"
              description="Aggregated from concept overlap, statement structure and algorithm signature"
              actions={
                <Badge variant={NOVELTY.verdict === 'likely-original' ? 'ok' : 'warn'}>
                  <ShieldCheck className="h-3 w-3" />
                  {NOVELTY.verdict === 'likely-original' ? 'Likely Original' : 'Needs review'}
                </Badge>
              }
            />
            <div className="grid gap-4 p-4 sm:grid-cols-[auto,1fr] sm:gap-8">
              <div className="flex justify-center">
                <NoveltyGauge
                  score={NOVELTY.score}
                  verdict="Likely Original"
                  scanning={scanning}
                />
              </div>
              <div className="min-w-0">
                <div className="eyebrow mb-3 flex items-center gap-1.5">
                  <Fingerprint className="h-3 w-3" />
                  Overlap breakdown
                </div>
                <div className="space-y-3">
                  {BREAKDOWN.map((b) => (
                    <div key={b.label}>
                      <div className="mb-1 flex items-baseline justify-between gap-3">
                        <span className="text-sm text-fg-muted">{b.label}</span>
                        <span className="tabular text-sm font-medium text-fg">{b.value}%</span>
                      </div>
                      <div className="h-1 w-full overflow-hidden rounded-full bg-[hsl(var(--fg)/0.07)]">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: scanning ? 0 : `${b.value * 4}%` }}
                          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                          className={cn(
                            'h-full rounded-full',
                            b.value >= 12 ? 'bg-warn' : b.value >= 8 ? 'bg-brand' : 'bg-ok',
                          )}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-4 border-t border-line pt-3 text-sm leading-[20px] text-fg-muted">
                  The closest match shares the union-find machinery but not the temporal interval
                  model. Concept overlap stays at 4 / 27, which sits well inside the originality
                  budget for a 2400-rated problem.
                </p>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
