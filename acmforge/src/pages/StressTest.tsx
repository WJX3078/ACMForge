import { AnimatePresence, motion } from 'framer-motion'
import { Minimize2, Play, RotateCcw, Scissors, Square, Zap } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CodeBlock } from '@/components/ui/code-block'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { LiveNumber } from '@/components/ui/primitives'
import { PageHeader } from '@/components/layout/AppShell'
import { STRESS_CANDIDATE_CPP, STRESS_REFERENCE_CPP } from '@/data/factory'
import { useStressBench } from '@/hooks/useStressBench'
import { useUi } from '@/hooks/useUi'
import { cn, formatDuration, formatNumber } from '@/lib/utils'
import type { StressLine } from '@/types'

const KIND_TONE: Record<StressLine['kind'], string> = {
  info: 'text-fg-muted',
  test: 'text-fg-subtle',
  mismatch: 'text-danger',
  ok: 'text-ok',
  warn: 'text-warn',
  minimize: 'text-think',
}

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="px-3 py-2">
      <div className="eyebrow">{label}</div>
      <div className={cn('tabular mt-0.5 text-md font-semibold text-fg', tone)}>{value}</div>
    </div>
  )
}

export default function StressTest() {
  const bench = useStressBench()
  const { toast } = useUi()
  const consoleRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = consoleRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [bench.lines.length])

  return (
    <div>
      <PageHeader
        title="Stress Test"
        description="Differential testing between the reference solution and candidate implementations, with automatic counterexample minimisation."
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={bench.reset}
              disabled={bench.phase === 'idle'}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={bench.stop}
              disabled={!bench.running}
            >
              <Square className="h-3 w-3" />
              Pause
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={bench.start}
              disabled={bench.running || bench.phase === 'mismatch' || bench.phase === 'minimized'}
            >
              <Play className="h-3.5 w-3.5" />
              {bench.cases > 0 ? 'Resume run' : 'Start run'}
            </Button>
          </>
        }
      />

      {/* status strip */}
      <Panel className="mb-3">
        <div className="grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x">
          <Stat label="Cases executed" value={<LiveNumber value={bench.cases} />} />
          <Stat
            label="Mismatches"
            value={bench.failures}
            tone={bench.failures > 0 ? 'text-danger' : undefined}
          />
          <Stat label="Uptime" value={formatDuration(bench.elapsed)} />
          <Stat
            label="Status"
            value={
              <span
                className={cn(
                  'text-base font-medium',
                  bench.phase === 'running' && 'text-brand',
                  bench.phase === 'mismatch' && 'text-danger',
                  bench.phase === 'minimizing' && 'text-think',
                  bench.phase === 'minimized' && 'text-ok',
                  bench.phase === 'idle' && 'text-fg-subtle',
                )}
              >
                {bench.phase}
              </span>
            }
          />
        </div>
      </Panel>

      {/* split view */}
      <div className="mb-3 grid gap-3 lg:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-base font-medium text-fg">Reference Solution</span>
            <Badge variant="ok">reference.cpp</Badge>
          </div>
          <CodeBlock code={STRESS_REFERENCE_CPP} filename="reference.cpp" maxHeight={440} />
        </div>
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-base font-medium text-fg">Candidate Solution</span>
            <Badge variant="danger">candidate#2.cpp</Badge>
            <span className="ml-auto text-xs text-fg-subtle">independently generated</span>
          </div>
          <CodeBlock code={STRESS_CANDIDATE_CPP} filename="candidate#2.cpp" maxHeight={440} />
        </div>
      </div>

      {/* console */}
      <Panel className="mb-3">
        <PanelHeader
          title="Stress Test Console"
          description={
            <span className="flex items-center gap-2">
              <span>Seed 0x5EED</span>
              <span className="text-fg-subtle">·</span>
              <span className="tabular">{formatNumber(bench.cases)} cases</span>
            </span>
          }
          actions={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                bench.minimize()
                toast({
                  title: 'Minimising counterexample',
                  description: 'Delta debugging from n = 200000',
                  kind: 'default',
                })
              }}
              disabled={bench.phase !== 'mismatch'}
            >
              {bench.phase === 'minimizing' ? (
                <Minimize2 className="h-3.5 w-3.5 animate-pulse" />
              ) : (
                <Scissors className="h-3.5 w-3.5" />
              )}
              Minimize Counterexample
            </Button>
          }
        />
        <div
          ref={consoleRef}
          className="max-h-[280px] min-h-[180px] overflow-y-auto bg-surface-sunken px-4 py-2.5 font-mono text-xs leading-[19px]"
        >
          {bench.lines.length === 0 && (
            <div className="flex h-[150px] flex-col items-center justify-center gap-2 text-center">
              <Zap className="h-4 w-4 text-fg-subtle" />
              <span className="text-sm text-fg-subtle">
                Console idle — start a run to stream differential cases.
              </span>
            </div>
          )}
          {bench.lines.map((l) =>
            l.kind === 'mismatch' ? (
              <div key={l.id} className="my-1.5 animate-log-in">
                <div className="inline-flex items-center gap-2 rounded-sm border border-danger/40 bg-danger-soft px-2 py-1 font-semibold text-danger">
                  <span className="h-1.5 w-1.5 rounded-full bg-danger" />
                  MISMATCH FOUND
                </div>
              </div>
            ) : (
              <div key={l.id} className={cn('flex animate-log-in gap-2', KIND_TONE[l.kind])}>
                <span className="shrink-0 select-none text-fg-subtle/50">
                  {l.kind === 'test' ? '›' : l.kind === 'minimize' ? '⋯' : '·'}
                </span>
                <span className="whitespace-pre-wrap">{l.text}</span>
              </div>
            ),
          )}
        </div>
      </Panel>

      {/* minimised counterexample */}
      <AnimatePresence>
        {bench.minimized && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          >
            <Panel className="border-danger/30">
              <PanelHeader
                title="Minimal counterexample"
                description="Delta debugging reduced the failing case from 200 000 to 7 elements"
                actions={<Badge variant="danger">WA on test #18293</Badge>}
              />
              <div className="grid gap-3 p-4 lg:grid-cols-2">
                <div>
                  <div className="eyebrow mb-2">Before · n = 200000</div>
                  <pre className="max-h-[160px] overflow-auto rounded-md border border-line bg-surface-sunken px-3 py-2 font-mono text-xs leading-[18px] text-fg-muted">
                    {bench.minimized.full.input}
                  </pre>
                  <div className="mt-2 flex gap-4">
                    <span className="text-sm text-fg-subtle">
                      ref <span className="tabular ml-1 text-fg">{bench.minimized.full.reference}</span>
                    </span>
                    <span className="text-sm text-fg-subtle">
                      cand <span className="tabular ml-1 text-danger">{bench.minimized.full.candidate}</span>
                    </span>
                  </div>
                </div>
                <div>
                  <div className="eyebrow mb-2 flex items-center gap-1.5">
                    After · n = {bench.minimized.min.n}
                    <Badge variant="ok" size="sm">
                      minimal
                    </Badge>
                  </div>
                  <pre className="max-h-[160px] overflow-auto rounded-md border border-line bg-surface-sunken px-3 py-2 font-mono text-xs leading-[18px] text-fg">
                    {bench.minimized.min.input}
                  </pre>
                  <div className="mt-2 flex gap-4">
                    <span className="text-sm text-fg-subtle">
                      ref <span className="tabular ml-1 text-ok">{bench.minimized.min.reference}</span>
                    </span>
                    <span className="text-sm text-fg-subtle">
                      cand <span className="tabular ml-1 text-danger">{bench.minimized.min.candidate}</span>
                    </span>
                  </div>
                  <p className="mt-3 border-t border-line pt-2 text-sm leading-[20px] text-fg-muted">
                    Removing any operation makes the mismatch disappear. The candidate restores the
                    size onto the child instead of the parent during rollback, so the second rollback
                    rebuilds a wrong component size.
                  </p>
                </div>
              </div>
            </Panel>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
