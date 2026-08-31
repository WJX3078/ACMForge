import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Circle,
  Loader2,
  RotateCcw,
  Sparkles,
  Square,
  Zap,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, DifficultyBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChipGroup, Segmented, Slider } from '@/components/ui/controls'
import { Panel, PanelHeader, SpecRow } from '@/components/ui/panel'
import { ProgressBar } from '@/components/ui/primitives'
import { PageHeader } from '@/components/layout/AppShell'
import { ALGORITHM_TAGS, INNOVATION_LEVELS, PROBLEM_STYLES } from '@/data/ideas'
import { PRESET_PROMPTS } from '@/data/factory'
import { useFactoryRun, type FactoryConfig } from '@/hooks/useFactoryRun'
import { useUi } from '@/hooks/useUi'
import { cn, formatDuration, formatNumber } from '@/lib/utils'
import type { LogLevel } from '@/types'

const LEVEL_TONE: Record<LogLevel, string> = {
  info: 'text-fg-muted',
  debug: 'text-fg-subtle',
  success: 'text-ok',
  warn: 'text-warn',
  error: 'text-danger',
}

export default function ProblemFactory() {
  const navigate = useNavigate()
  const { toast } = useUi()
  const run = useFactoryRun()

  const [prompt, setPrompt] = useState('')
  const [difficulty, setDifficulty] = useState<[number, number]>([1800, 2600])
  const [tags, setTags] = useState<string[]>(['Graph', 'Data Structure'])
  const [style, setStyle] = useState<string>('Codeforces')
  const [innovation, setInnovation] = useState<string>('Balanced')

  const started = run.config !== null
  const progress = run.totalDuration ? run.totalElapsed / run.totalDuration : 0

  const config: FactoryConfig = useMemo(
    () => ({ prompt, difficulty, tags, style, innovation }),
    [prompt, difficulty, tags, style, innovation],
  )

  const onGenerate = () => {
    run.start(config)
    toast({ title: 'Run started', description: '7 agents are working on your brief', kind: 'success' })
  }

  const toggleTag = (t: string) =>
    setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))

  return (
    <div>
      <PageHeader
        title="Problem Factory"
        description="Describe an idea — or leave it blank and let the Scout discover one. The pipeline runs end to end and hands back a judge-ready package."
        actions={
          started ? (
            <>
              <Button variant="secondary" size="sm" onClick={run.reset}>
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </Button>
              <Button variant="primary" size="sm" onClick={onGenerate} disabled={run.running}>
                <Sparkles className="h-3.5 w-3.5" />
                Run again
              </Button>
            </>
          ) : undefined
        }
      />

      <div className="grid gap-3 xl:grid-cols-3">
        {/* ── left column ─────────────────────────────────────────────── */}
        <div className="min-w-0 space-y-3 xl:col-span-2">
          <Panel>
            <div className="flex items-end gap-2 p-3">
              <div className="min-w-0 flex-1">
                <label htmlFor="brief" className="eyebrow mb-1.5 block">
                  Brief
                </label>
                <textarea
                  id="brief"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={3}
                  placeholder="Describe a problem idea, or let the agent discover one…"
                  className="w-full resize-none rounded-md border border-line bg-surface-sunken px-3 py-2.5 text-md text-fg outline-none transition-colors placeholder:text-fg-subtle focus:border-[hsl(var(--brand)/0.6)]"
                />
              </div>
              <Button
                variant="primary"
                size="lg"
                onClick={onGenerate}
                disabled={run.running}
                className="shrink-0"
              >
                {run.running ? (
                  <Loader2 className="h-4 w-4 animate-spin-slow" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Generate
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 border-t border-line px-3 py-2">
              <span className="text-2xs text-fg-subtle">Presets</span>
              {PRESET_PROMPTS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setPrompt(p.text)}
                  className="rounded-sm border border-line bg-surface-raised px-1.5 py-[2px] text-xs text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </Panel>

          {/* run timeline */}
          <Panel>
            <PanelHeader
              title="Execution Timeline"
              description={
                run.finished
                  ? 'Run complete · all eight stages discharged'
                  : run.running
                    ? `Stage ${Math.min(run.stepIndex + 1, run.steps.length)} of ${run.steps.length}`
                    : 'Waiting for a run'
              }
              actions={
                run.running ? (
                  <Button variant="secondary" size="sm" onClick={run.reset}>
                    <Square className="h-3 w-3" />
                    Stop
                  </Button>
                ) : run.finished ? (
                  <Badge variant="ok">
                    <Check className="h-3 w-3" /> Ready
                  </Badge>
                ) : null
              }
            />

            {started ? (
              <div className="px-3 pt-3">
                <div className="mb-3 flex items-center gap-3">
                  <ProgressBar value={progress} className="flex-1" />
                  <span className="tabular shrink-0 text-xs text-fg-subtle">
                    {formatDuration(run.totalElapsed)} / {formatDuration(run.totalDuration)}
                  </span>
                </div>
              </div>
            ) : null}

            {!started ? (
              <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface-raised text-fg-subtle">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="text-md font-medium text-fg">No run in progress</div>
                <p className="mt-1 max-w-sm text-sm text-fg-muted">
                  Configure the target on the right, then hit Generate. Each stage streams its
                  reasoning as it runs.
                </p>
              </div>
            ) : (
              <ol className="px-4 pb-4">
                {run.steps.map((step, i) => {
                  const status = run.statuses[i]
                  const elapsed = run.elapsed[i]
                  const isActive = status === 'running'
                  const done = status === 'done'
                  const pct = Math.min(1, elapsed / step.durationMs)
                  const logs = run.logs.slice(-40).filter((l) => l.at >= run.elapsed.slice(0, i).reduce((s, x) => s + x, 0))
                  return (
                    <li key={step.id} className="relative flex gap-3 pb-3 last:pb-0">
                      {i < run.steps.length - 1 && (
                        <span
                          className={cn(
                            'absolute left-[9px] top-[19px] bottom-0 w-px',
                            done ? 'bg-ok/40' : 'bg-line',
                          )}
                        />
                      )}
                      <span className="relative z-10 mt-[2px] flex h-[19px] w-[19px] shrink-0 items-center justify-center">
                        {done && (
                          <span className="flex h-[19px] w-[19px] items-center justify-center rounded-full bg-ok-soft">
                            <Check className="h-3 w-3 text-ok" />
                          </span>
                        )}
                        {isActive && (
                          <span className="flex h-[19px] w-[19px] items-center justify-center rounded-full bg-brand-soft">
                            <Loader2 className="h-3 w-3 animate-spin-slow text-brand" />
                          </span>
                        )}
                        {!done && !isActive && (
                          <span className="flex h-[19px] w-[19px] items-center justify-center rounded-full border border-line bg-surface">
                            <Circle className="h-1.5 w-1.5 fill-fg-subtle text-fg-subtle" />
                          </span>
                        )}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <span
                            className={cn(
                              'text-base',
                              done && 'text-fg-muted',
                              isActive && 'font-medium text-fg',
                              !done && !isActive && 'text-fg-subtle',
                            )}
                          >
                            {step.label}
                          </span>
                          <span className="tabular shrink-0 text-2xs text-fg-subtle">
                            {done
                              ? `${(step.durationMs / 1000).toFixed(1)}s`
                              : isActive
                                ? `${formatDuration(elapsed)}`
                                : '—'}
                          </span>
                        </div>
                        <p className="mt-0.5 text-sm text-fg-muted">{step.detail}</p>

                        <AnimatePresence initial={false}>
                          {isActive && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                              className="overflow-hidden"
                            >
                              <div className="mt-1.5">
                                <ProgressBar value={pct} />
                              </div>
                              <div className="mt-2 rounded-md border border-line bg-surface-sunken px-2.5 py-2 font-mono text-xs leading-[17px]">
                                {logs.slice(-3).map((l) => (
                                  <div key={l.id} className="flex animate-log-in gap-2">
                                    <span className="tabular shrink-0 text-fg-subtle/70">
                                      +{(l.at / 1000).toFixed(1)}s
                                    </span>
                                    <span className={cn('min-w-0', LEVEL_TONE[l.level])}>{l.text}</span>
                                  </div>
                                ))}
                                {logs.length === 0 && (
                                  <span className="text-fg-subtle">starting…</span>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}

            {started && (
              <div className="border-t border-line">
                <div className="max-h-[180px] overflow-y-auto px-4 py-2.5 font-mono text-xs leading-[18px]">
                  {run.logs.map((l) => (
                    <div key={l.id} className="flex animate-log-in gap-2">
                      <span className="tabular w-14 shrink-0 text-right text-fg-subtle/70">
                        +{(l.at / 1000).toFixed(1)}s
                      </span>
                      <span className={cn('min-w-0', LEVEL_TONE[l.level])}>{l.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Panel>
        </div>

        {/* ── right column ────────────────────────────────────────────── */}
        <div className="min-w-0 space-y-3">
          <Panel>
            <PanelHeader title="Target" description="Constrains the search space" />
            <div className="space-y-4 p-4">
              <div>
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="eyebrow">Difficulty</span>
                  <span className="tabular text-base font-medium text-fg">
                    {difficulty[0]} — {difficulty[1]}
                  </span>
                </div>
                <Slider
                  value={difficulty}
                  min={800}
                  max={3500}
                  step={100}
                  minStepsBetweenThumbs={100}
                  onValueChange={(v) => setDifficulty([v[0], v[1]] as [number, number])}
                />
                <div className="mt-1.5 flex justify-between text-2xs text-fg-subtle">
                  <span>800</span>
                  <span>3500</span>
                </div>
              </div>

              <div>
                <div className="eyebrow mb-2">Algorithm tags</div>
                <ChipGroup options={ALGORITHM_TAGS} selected={tags} onToggle={toggleTag} />
              </div>

              <div>
                <div className="eyebrow mb-2">Problem style</div>
                <Segmented
                  value={style}
                  onValueChange={setStyle}
                  options={PROBLEM_STYLES.map((s) => ({ value: s, label: s }))}
                  className="w-full"
                />
              </div>

              <div>
                <div className="eyebrow mb-2">Innovation</div>
                <Segmented
                  value={innovation}
                  onValueChange={setInnovation}
                  options={INNOVATION_LEVELS.map((i) => ({ value: i.id, label: i.label, hint: i.hint }))}
                  className="w-full"
                />
                <p className="mt-2 text-xs text-fg-muted">
                  {INNOVATION_LEVELS.find((i) => i.id === innovation)?.hint}
                </p>
              </div>
            </div>
          </Panel>

          <AnimatePresence>
            {run.result && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              >
                <Panel className="border-ok/30">
                  <PanelHeader
                    title="Package ready"
                    description={`Completed in ${formatDuration(run.result.durationMs)}`}
                    actions={<Badge variant="ok">Ready</Badge>}
                  />
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-lg font-semibold tracking-[-0.015em] text-fg">
                          {run.result.title}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <DifficultyBadge value={run.result.difficulty} />
                          {run.result.algorithms.map((a) => (
                            <span
                              key={a}
                              className="rounded-sm bg-[hsl(var(--fg)/0.05)] px-1.5 py-[1px] text-xs text-fg-muted"
                            >
                              {a}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 border-t border-line pt-2">
                      <SpecRow label="Uniqueness" value={`${run.result.uniqueness}%`} />
                      <SpecRow label="Tests" value={formatNumber(run.result.tests)} />
                      <SpecRow label="Style" value={style} />
                      <SpecRow label="Innovation" value={innovation} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => navigate(`/problems/${run.result!.problemId}`)}
                      >
                        Open problem
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => navigate('/stress')}>
                        <Zap className="h-3.5 w-3.5" />
                        Stress test
                      </Button>
                    </div>
                  </div>
                </Panel>
              </motion.div>
            )}
          </AnimatePresence>

          {run.finished && !run.result && (
            <Panel className="border-danger/30">
              <PanelHeader title="Run halted" actions={<Badge variant="danger">Failed</Badge>} />
              <div className="flex items-start gap-2.5 p-4">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                <p className="text-sm text-fg-muted">
                  The pipeline stopped before packaging. Inspect the failing stage in the timeline
                  and retry with a narrower difficulty band.
                </p>
              </div>
            </Panel>
          )}

          <Panel>
            <PanelHeader title="Pipeline contract" />
            <div className="px-4 py-2">
              <SpecRow label="Stages" value="8" />
              <SpecRow label="Agents involved" value="7" />
              <SpecRow label="Duplicate sources" value="5" />
              <SpecRow label="Stress cases" value="≥ 18,000" />
              <SpecRow label="Output" value="Polygon zip" />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
