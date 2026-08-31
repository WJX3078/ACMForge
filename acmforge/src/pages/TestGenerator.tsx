import { FlaskConical, Loader2, Play, RotateCcw } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Slider, Switch } from '@/components/ui/controls'
import { Panel, PanelHeader, SpecRow } from '@/components/ui/panel'
import { ProgressBar, Skeleton } from '@/components/ui/primitives'
import { PageHeader } from '@/components/layout/AppShell'
import { useUi } from '@/hooks/useUi'
import { cn, formatBytes, formatNumber } from '@/lib/utils'
import type { TestFile } from '@/types'

const GENERATORS = [
  { id: 'gen_random', label: 'gen_random.cpp', hint: 'Uniform over the full constraint box', default: true },
  { id: 'gen_chain', label: 'gen_chain.cpp', hint: 'Degenerate path topology', default: true },
  { id: 'gen_star', label: 'gen_adversarial_star.cpp', hint: 'High-degree hub, hash stress', default: true },
  { id: 'gen_extreme', label: 'gen_extreme.cpp', hint: 'Maximal n and q simultaneously', default: false },
  { id: 'gen_hand', label: 'gen_hand.cpp', hint: 'Hand-crafted edge cases', default: true },
]

const GROUPS: TestFile['group'][] = ['sample', 'small', 'boundary', 'max', 'adversarial']
const NOTES = [
  'uniform random',
  'degenerate path',
  'all queries at t = 1',
  'tight time-limit probe',
  'hash collision attempt',
  'single element',
  'maximum constraints',
  'alternating pattern',
]

function buildFiles(count: number, seedBase: number, nMax: number): TestFile[] {
  return Array.from({ length: count }, (_, i) => {
    const group: TestFile['group'] = i < 2 ? 'sample' : GROUPS[(i * 3 + 1) % GROUPS.length]
    return {
      id: `gen-t${i + 1}`,
      index: i + 1,
      group,
      bytes:
        group === 'max'
          ? Math.round(nMax * 18.4) + ((seedBase + i * 977) % 900_000)
          : group === 'sample'
            ? 96 + i * 31
            : 6_400 + ((seedBase * (i + 3)) % 380_000),
      generator: GENERATORS[(i + count) % GENERATORS.length].label,
      seed: seedBase + i * 1013,
      verdict: i === 13 ? 'warn' : 'ok',
      note: NOTES[(i * 5 + 2) % NOTES.length],
    }
  })
}

function previewFor(t: TestFile, nMax: number) {
  const n = t.group === 'max' ? nMax : t.group === 'sample' ? 6 : 1 + ((t.seed * 7) % Math.max(2, nMax))
  const m = Math.max(1, n - 1 + (t.seed % 3))
  const head = [`${formatNumber(n)} ${formatNumber(m)}`]
  for (let i = 0; i < Math.min(3, m); i++) {
    const a = 1 + ((t.seed + i * 31) % Math.max(1, n))
    const b = 1 + ((t.seed + i * 57) % Math.max(1, n))
    head.push(`${a} ${b} ${1 + ((t.seed + i) % 5)} ${3 + ((t.seed + i * 3) % 6)}`)
  }
  head.push('/* … */')
  return head.join('\n')
}

export default function TestGenerator() {
  const { toast } = useUi()
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(GENERATORS.map((g) => [g.id, g.default])),
  )
  const [count, setCount] = useState(42)
  const [nMax, setNMax] = useState(200000)
  const [seed, setSeed] = useState(0x5eed)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [files, setFiles] = useState<TestFile[]>(() => buildFiles(42, 0x5eed, 200000))
  const [selected, setSelected] = useState<number>(1)
  const progressRef = useRef(0)

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => {
      // advance outside the state updater: React StrictMode invokes updaters
      // twice in development, which would fire the completion side effects twice
      const prev = progressRef.current
      const next = Math.min(1, prev + 0.035 + Math.random() * 0.02)
      progressRef.current = next
      setProgress(next)

      if (next >= 1) {
        setRunning(false)
        setFiles(buildFiles(count, seed, nMax))
        setSelected(1)
        toast({
          title: `Generated ${count} cases`,
          description: 'Validator accepted every case',
          kind: 'success',
        })
      }
    }, 90)
    return () => window.clearInterval(id)
  }, [running, count, seed, nMax, toast])

  const totalBytes = files.reduce((s, f) => s + f.bytes, 0)
  const byGroup = useMemo(() => {
    const map = new Map<string, number>()
    for (const f of files) map.set(f.group, (map.get(f.group) ?? 0) + 1)
    return [...map.entries()]
  }, [files])

  const activeFile = files.find((f) => f.index === selected) ?? files[0]

  return (
    <div>
      <PageHeader
        title="Test Generator"
        description="Compose a generator suite, sample the input space under a coverage budget, and validate every produced case."
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setFiles([])
                setProgress(0)
                progressRef.current = 0
              }}
              disabled={running}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Clear
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setProgress(0)
                progressRef.current = 0
                setRunning(true)
              }}
              disabled={running}
            >
              {running ? <Loader2 className="h-3.5 w-3.5 animate-spin-slow" /> : <Play className="h-3.5 w-3.5" />}
              Generate {count} cases
            </Button>
          </>
        }
      />

      <div className="grid gap-3 xl:grid-cols-12">
        {/* config */}
        <div className="min-w-0 space-y-3 xl:col-span-4">
          <Panel>
            <PanelHeader title="Generators" description="Each one owns a coverage bucket" />
            <div className="divide-y divide-line">
              {GENERATORS.map((g) => (
                <label
                  key={g.id}
                  className="flex cursor-pointer items-start gap-3 px-4 py-2.5 transition-colors hover:bg-[hsl(var(--fg)/0.03)]"
                >
                  <span className="mt-0.5">
                    <Switch
                      checked={enabled[g.id]}
                      onCheckedChange={(v) => setEnabled((e) => ({ ...e, [g.id]: v }))}
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-xs text-fg">{g.label}</span>
                    <span className="mt-0.5 block text-xs text-fg-subtle">{g.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Sampling" />
            <div className="space-y-4 p-4">
              <div>
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="eyebrow">Case count</span>
                  <span className="tabular text-base font-medium text-fg">{count}</span>
                </div>
                <Slider value={[count]} min={8} max={96} step={2} onValueChange={(v) => setCount(v[0])} />
              </div>
              <div>
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="eyebrow">Max n</span>
                  <span className="tabular text-base font-medium text-fg">
                    {formatNumber(nMax)}
                  </span>
                </div>
                <Slider
                  value={[nMax]}
                  min={1000}
                  max={400000}
                  step={1000}
                  onValueChange={(v) => setNMax(v[0])}
                />
              </div>
              <div>
                <div className="eyebrow mb-1.5">Seed</div>
                <input
                  value={`0x${seed.toString(16).toUpperCase()}`}
                  onChange={(e) => {
                    const parsed = Number.parseInt(e.target.value.replace(/0x/i, ''), 16)
                    if (!Number.isNaN(parsed)) setSeed(parsed)
                  }}
                  className="h-8 w-full rounded-md border border-line bg-surface-sunken px-2.5 font-mono text-base text-fg outline-none focus:border-[hsl(var(--brand)/0.6)]"
                />
              </div>
            </div>
            <div className="border-t border-line px-4 py-2">
              <SpecRow label="Active generators" value={Object.values(enabled).filter(Boolean).length} />
              <SpecRow label="Validator" value="strict" />
              <SpecRow label="Output" value="tests/*.in" />
            </div>
          </Panel>
        </div>

        {/* results */}
        <div className="min-w-0 space-y-3 xl:col-span-8">
          <Panel>
            <PanelHeader
              title="Coverage"
              description={
                running ? 'Sampling the input space…' : `${files.length} cases · ${formatBytes(totalBytes)}`
              }
              actions={
                running ? (
                  <Badge variant="brand">
                    <Loader2 className="h-3 w-3 animate-spin-slow" />
                    generating
                  </Badge>
                ) : (
                  <Badge variant="ok">validator passed</Badge>
                )
              }
            />
            <div className="grid grid-cols-5 gap-px bg-line">
              {GROUPS.map((g) => {
                const n = byGroup.find(([k]) => k === g)?.[1] ?? 0
                return (
                  <div key={g} className="bg-surface px-3 py-2.5">
                    <div className="text-2xs capitalize text-fg-subtle">{g}</div>
                    {running ? (
                      <Skeleton className="mt-1 h-4 w-8" />
                    ) : (
                      <div className="tabular mt-0.5 text-md font-semibold text-fg">{n}</div>
                    )}
                  </div>
                )
              })}
            </div>
            {running && (
              <div className="border-t border-line px-4 py-3">
                <ProgressBar value={progress} />
                <div className="mt-1.5 font-mono text-xs text-fg-subtle">
                  writing case {Math.max(1, Math.round(progress * count))} / {count} ·{' '}
                  {GENERATORS.filter((g) => enabled[g.id]).map((g) => g.label).join(', ') || 'no generator selected'}
                </div>
              </div>
            )}
          </Panel>

          <Panel>
            <PanelHeader title="Generated cases" description="Click a row to preview its input" />
            <div className="max-h-[420px] overflow-y-auto">
              <table className="w-full min-w-[640px] border-collapse">
                <thead className="sticky top-0 bg-surface">
                  <tr className="border-b border-line text-left">
                    {['#', 'Group', 'Size', 'Generator', 'Seed', 'Note'].map((h) => (
                      <th
                        key={h}
                        className={cn(
                          'px-4 py-2 text-2xs font-semibold uppercase tracking-[0.07em] text-fg-subtle',
                          h === 'Size' && 'text-right',
                        )}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {files.map((f) => (
                    <tr
                      key={f.id}
                      onClick={() => setSelected(f.index)}
                      className={cn(
                        'cursor-pointer border-b border-line transition-colors last:border-0 hover:bg-[hsl(var(--fg)/0.03)]',
                        f.index === selected && 'bg-[hsl(var(--brand)/0.07)]',
                      )}
                    >
                      <td className="tabular px-4 py-1.5 text-base text-fg-muted">{f.index}</td>
                      <td className="px-4 py-1.5">
                        <Badge
                          size="sm"
                          variant={
                            f.group === 'sample'
                              ? 'brand'
                              : f.group === 'max'
                                ? 'warn'
                                : f.group === 'adversarial'
                                  ? 'danger'
                                  : 'default'
                          }
                        >
                          {f.group}
                        </Badge>
                      </td>
                      <td className="tabular px-4 py-1.5 text-right text-base text-fg-muted">
                        {formatBytes(f.bytes)}
                      </td>
                      <td className="px-4 py-1.5 font-mono text-xs text-fg-muted">{f.generator}</td>
                      <td className="tabular px-4 py-1.5 font-mono text-xs text-fg-subtle">
                        0x{f.seed.toString(16).toUpperCase().slice(0, 6)}
                      </td>
                      <td className="px-4 py-1.5 text-sm text-fg-subtle">{f.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          {activeFile && (
            <Panel>
              <PanelHeader
                title={`Preview · test #${activeFile.index}`}
                description={activeFile.generator}
                actions={
                  <span className="flex items-center gap-2">
                    <Badge size="sm" variant={activeFile.verdict === 'ok' ? 'ok' : 'warn'}>
                      {activeFile.verdict}
                    </Badge>
                    <FlaskConical className="h-3.5 w-3.5 text-fg-subtle" />
                  </span>
                }
              />
              <pre className="max-h-[200px] overflow-auto bg-surface-sunken px-4 py-3 font-mono text-xs leading-[18px] text-fg-muted">
                {previewFor(activeFile, nMax)}
              </pre>
            </Panel>
          )}
        </div>
      </div>
    </div>
  )
}
