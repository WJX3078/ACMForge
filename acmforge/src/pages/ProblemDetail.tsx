import { ArrowLeft, Download, FileText, Zap } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Badge, DifficultyBadge, StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CodeBlock } from '@/components/ui/code-block'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/controls'
import { Panel, PanelHeader, SpecRow } from '@/components/ui/panel'
import { EmptyState } from '@/components/ui/primitives'
import { PackageExportSheet } from '@/components/export/PackageExportSheet'
import { PageHeader } from '@/components/layout/AppShell'
import { PROBLEM_MAP, SUBMISSIONS, buildTests } from '@/data/problems'
import { buildEditorial } from '@/data/editorials'
import { cn, formatBytes, formatNumber, formatRelative } from '@/lib/utils'

function ExampleBlock({ input, output, note, index }: { input: string; output: string; note?: string; index: number }) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-1.5 text-sm font-medium text-fg">Example {index + 1}</div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="overflow-hidden rounded-md border border-line">
          <div className="border-b border-line bg-surface-sunken px-2.5 py-1 text-2xs font-semibold uppercase tracking-[0.07em] text-fg-subtle">
            Input
          </div>
          <pre className="overflow-x-auto px-2.5 py-2 font-mono text-xs leading-[18px] text-fg">
            {input}
          </pre>
        </div>
        <div className="overflow-hidden rounded-md border border-line">
          <div className="border-b border-line bg-surface-sunken px-2.5 py-1 text-2xs font-semibold uppercase tracking-[0.07em] text-fg-subtle">
            Output
          </div>
          <pre className="overflow-x-auto px-2.5 py-2 font-mono text-xs leading-[18px] text-fg">
            {output}
          </pre>
        </div>
      </div>
      {note && <p className="mt-1.5 text-sm text-fg-muted">{note}</p>}
    </div>
  )
}

function Prose({ title, blocks }: { title: string; blocks: string[] }) {
  return (
    <section className="mb-5 last:mb-0">
      <h3 className="mb-1.5 text-md font-semibold text-fg">{title}</h3>
      {blocks.map((b, i) => (
        <p key={i} className="mb-2 text-base leading-[22px] text-fg-muted last:mb-0">
          {b}
        </p>
      ))}
    </section>
  )
}

export default function ProblemDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const problem = id ? PROBLEM_MAP[id] : undefined
  const [exportOpen, setExportOpen] = useState(false)

  if (!problem) {
    return (
      <div>
        <PageHeader title="Problem not found" />
        <Panel>
          <EmptyState
            icon={<FileText className="h-4 w-4" />}
            title="This problem is not in the workspace"
            description="It may have been archived or never packaged."
            action={
              <Button variant="secondary" size="sm" onClick={() => navigate('/problems')}>
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to problems
              </Button>
            }
          />
        </Panel>
      </div>
    )
  }

  const tests = buildTests(problem)
  const submissions = SUBMISSIONS.filter((s) => s.problemId === problem.id)
  const editorial = buildEditorial(problem)
  const totalBytes = tests.reduce((s, t) => s + t.bytes, 0)

  return (
    <div>
      <PageHeader
        breadcrumb={
          <Link to="/problems" className="transition-colors hover:text-fg">
            Problems / {problem.id}
          </Link>
        }
        title={problem.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <DifficultyBadge value={problem.difficulty} />
            <span className="text-fg-subtle">·</span>
            <span>{problem.algorithms.join(' · ')}</span>
          </span>
        }
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setExportOpen(true)}>
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
            <Button variant="primary" size="sm" onClick={() => navigate('/stress')}>
              <Zap className="h-3.5 w-3.5" />
              Stress test
            </Button>
          </>
        }
      />

      <Panel className="mb-3">
        <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: 'Status', value: <StatusBadge status={problem.status} /> },
            { label: 'Uniqueness', value: `${problem.uniqueness}%` },
            { label: 'Tests', value: formatNumber(problem.tests) },
            { label: 'Time limit', value: `${problem.timeLimitMs} ms` },
            { label: 'Memory limit', value: `${problem.memoryLimitMb} MB` },
            { label: 'Created', value: formatRelative(problem.createdAt) },
          ].map((s) => (
            <div key={s.label} className="bg-surface px-3.5 py-2.5">
              <div className="eyebrow">{s.label}</div>
              <div className="tabular mt-1 text-base font-medium text-fg">{s.value}</div>
            </div>
          ))}
        </div>
      </Panel>

      <Tabs defaultValue="statement">
        <TabsList className="mb-3">
          <TabsTrigger value="statement">Statement</TabsTrigger>
          <TabsTrigger value="solution">Solution</TabsTrigger>
          <TabsTrigger value="editorial">Editorial</TabsTrigger>
          <TabsTrigger value="tests">Tests</TabsTrigger>
          <TabsTrigger value="submissions">Submissions</TabsTrigger>
        </TabsList>

        <TabsContent value="statement">
          <div className="grid gap-3 xl:grid-cols-3">
            <Panel className="xl:col-span-2">
              <PanelHeader title="Statement" description={`${problem.style} · ${problem.algorithms.join(' / ')}`} />
              <div className="p-5">
                <Prose title="Problem" blocks={problem.statement.legend} />
                <div className="my-4 border-t border-line" />
                <Prose title="Input" blocks={problem.statement.input} />
                <Prose title="Output" blocks={problem.statement.output} />
                <section className="mb-5">
                  <h3 className="mb-2 text-md font-semibold text-fg">Examples</h3>
                  {problem.statement.examples.map((e, i) => (
                    <ExampleBlock key={i} index={i} input={e.input} output={e.output} note={e.note} />
                  ))}
                </section>
                <Prose title="Notes" blocks={problem.statement.notes} />
              </div>
            </Panel>

            <div className="min-w-0 space-y-3">
              <Panel>
                <PanelHeader title="Key ideas" />
                <ul className="space-y-2 p-4">
                  {problem.keyIdeas.map((k) => (
                    <li key={k} className="flex gap-2 text-sm leading-[20px] text-fg-muted">
                      <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-brand" />
                      <span>{k}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
              <Panel>
                <PanelHeader title="Provenance" />
                <div className="px-4 py-2">
                  <SpecRow label="Author" value={problem.author} />
                  <SpecRow label="Style" value={problem.style} />
                  <SpecRow label="Samples" value={problem.statement.examples.length} />
                  <SpecRow label="Algorithm tags" value={problem.algorithms.join(', ')} />
                </div>
              </Panel>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="solution">
          <div className="grid gap-3 xl:grid-cols-3">
            <div className="min-w-0 xl:col-span-2">
              <CodeBlock
                code={problem.solution}
                filename={`${problem.id}.cpp`}
                language="C++17"
                maxHeight={620}
              />
            </div>
            <div className="min-w-0 space-y-3">
              <Panel>
                <PanelHeader title="Implementation" actions={<Badge variant="ok">AC</Badge>} />
                <div className="px-4 py-2">
                  <SpecRow label="Language" value="C++17" />
                  <SpecRow label="Lines" value={problem.solution.trim().split('\n').length} />
                  <SpecRow label="Time" value={editorial.complexity.time} />
                  <SpecRow label="Memory" value={editorial.complexity.memory} />
                </div>
              </Panel>
              <Panel>
                <PanelHeader title="Verification" />
                <div className="px-4 py-2">
                  <SpecRow label="Stress cases" value="18,492" />
                  <SpecRow label="Divergences" value="0" />
                  <SpecRow label="Branch coverage" value="94.2%" />
                  <SpecRow label="Slowest case" value="0.41 s" />
                </div>
              </Panel>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="editorial">
          <div className="grid gap-3 xl:grid-cols-3">
            <Panel className="xl:col-span-2">
              <PanelHeader title="Editorial" description="Generated by Editorial Writer" />
              <div className="p-5">
                {editorial.sections.map((s) => (
                  <section key={s.title} className="mb-6 last:mb-0">
                    <h3 className="mb-2 text-md font-semibold text-fg">{s.title}</h3>
                    {s.paragraphs.map((p, i) => (
                      <p key={i} className="mb-2 text-base leading-[22px] text-fg-muted last:mb-0">
                        {p}
                      </p>
                    ))}
                    {s.bullets && (
                      <ul className="mt-2 space-y-1.5">
                        {s.bullets.map((b) => (
                          <li key={b} className="flex gap-2 text-base leading-[22px] text-fg-muted">
                            <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-brand" />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                ))}
              </div>
            </Panel>
            <Panel className="h-fit">
              <PanelHeader title="At a glance" />
              <div className="px-4 py-2">
                <SpecRow label="Difficulty" value={problem.difficulty} />
                <SpecRow label="Time" value={editorial.complexity.time} />
                <SpecRow label="Memory" value={editorial.complexity.memory} />
                <SpecRow label="Figures" value="2" />
              </div>
            </Panel>
          </div>
        </TabsContent>

        <TabsContent value="tests">
          <Panel>
            <PanelHeader
              title="Test set"
              description={`${tests.length} cases · ${formatBytes(totalBytes)} total`}
              actions={<Badge variant="ok">validator passed</Badge>}
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse">
                <thead>
                  <tr className="border-b border-line text-left">
                    {['#', 'Group', 'Size', 'Generator', 'Seed', 'Verdict', 'Note'].map((h) => (
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
                  {tests.map((t) => (
                    <tr key={t.id} className="border-b border-line transition-colors last:border-0 hover:bg-[hsl(var(--fg)/0.03)]">
                      <td className="tabular px-4 py-2 text-base text-fg-muted">{t.index}</td>
                      <td className="px-4 py-2">
                        <Badge
                          size="sm"
                          variant={
                            t.group === 'sample'
                              ? 'brand'
                              : t.group === 'max'
                                ? 'warn'
                                : t.group === 'adversarial'
                                  ? 'danger'
                                  : 'default'
                          }
                        >
                          {t.group}
                        </Badge>
                      </td>
                      <td className="tabular px-4 py-2 text-right text-base text-fg-muted">
                        {formatBytes(t.bytes)}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-fg-muted">{t.generator}</td>
                      <td className="tabular px-4 py-2 font-mono text-xs text-fg-subtle">{t.seed}</td>
                      <td className="px-4 py-2">
                        <span className={cn('text-xs', t.verdict === 'ok' ? 'text-ok' : 'text-warn')}>
                          {t.verdict}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm text-fg-subtle">{t.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="submissions">
          <Panel>
            <PanelHeader title="Submissions" description="Reference and candidate runs" />
            {submissions.length === 0 ? (
              <EmptyState
                icon={<FileText className="h-4 w-4" />}
                title="No submissions yet"
                description="Run a stress session to populate this table."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse">
                  <thead>
                    <tr className="border-b border-line text-left">
                      {['Verdict', 'Language', 'Time', 'Memory', 'Author', 'Submitted'].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-2 text-2xs font-semibold uppercase tracking-[0.07em] text-fg-subtle"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.map((s) => (
                      <tr key={s.id} className="border-b border-line last:border-0 hover:bg-[hsl(var(--fg)/0.03)]">
                        <td className="px-4 py-2">
                          <span
                            className={cn(
                              'rounded-sm px-1.5 py-[1px] text-xs font-semibold',
                              s.verdict === 'AC' && 'bg-ok-soft text-ok',
                              s.verdict === 'WA' && 'bg-danger-soft text-danger',
                              s.verdict === 'TLE' && 'bg-warn-soft text-warn',
                              s.verdict === 'RE' && 'bg-danger-soft text-danger',
                              s.verdict === 'MLE' && 'bg-warn-soft text-warn',
                            )}
                          >
                            {s.verdict}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-base text-fg-muted">{s.language}</td>
                        <td className="tabular px-4 py-2 text-base text-fg-muted">{s.timeMs} ms</td>
                        <td className="tabular px-4 py-2 text-base text-fg-muted">
                          {formatNumber(Math.round(s.memoryKb / 1024))} MB
                        </td>
                        <td className="px-4 py-2 font-mono text-xs text-fg-muted">{s.author}</td>
                        <td className="px-4 py-2 text-sm text-fg-subtle">{formatRelative(s.submittedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </TabsContent>
      </Tabs>

      <PackageExportSheet problem={problem} open={exportOpen} onOpenChange={setExportOpen} />
    </div>
  )
}
