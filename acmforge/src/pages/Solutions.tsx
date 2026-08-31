import { Check, FileCode2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, DifficultyBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CodeBlock } from '@/components/ui/code-block'
import { Panel, PanelHeader, SpecRow } from '@/components/ui/panel'
import { PageHeader } from '@/components/layout/AppShell'
import { PROBLEMS } from '@/data/problems'
import { complexityOf } from '@/data/editorials'
import { useCopy } from '@/hooks/useCopy'
import { cn } from '@/lib/utils'

export default function Solutions() {
  const navigate = useNavigate()
  const [selected, setSelected] = useState(PROBLEMS[0].id)
  const { copied, copy } = useCopy()

  const problem = PROBLEMS.find((p) => p.id === selected) ?? PROBLEMS[0]
  const complexity = complexityOf(problem)
  const lines = problem.solution.trim().split('\n').length

  return (
    <div>
      <PageHeader
        title="Solutions"
        description="Reference implementations produced by the Solution Agent, each verified against a brute force."
        actions={
          <Button variant="secondary" size="sm" onClick={() => copy(problem.solution)}>
            {copied ? <Check className="h-3.5 w-3.5 text-ok" /> : <FileCode2 className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy source'}
          </Button>
        }
      />

      <div className="grid gap-3 xl:grid-cols-[320px,1fr]">
        <Panel className="h-fit">
          <PanelHeader title="Reference solutions" description={`${PROBLEMS.length} problems`} />
          <div className="divide-y divide-line">
            {PROBLEMS.map((p) => {
              const active = p.id === selected
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelected(p.id)}
                  className={cn(
                    'flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left transition-colors',
                    active ? 'bg-[hsl(var(--fg)/0.06)]' : 'hover:bg-[hsl(var(--fg)/0.03)]',
                  )}
                >
                  <span
                    className={cn(
                      'mt-1 h-1.5 w-1.5 shrink-0 rounded-full',
                      p.status === 'failed' ? 'bg-danger' : 'bg-ok',
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-base font-medium text-fg">{p.title}</span>
                      <span className="ml-auto shrink-0">
                        <DifficultyBadge value={p.difficulty} showDot={false} />
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-fg-subtle">
                      {p.algorithms.join(' / ')} · {complexityOf(p).time}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </Panel>

        <div className="min-w-0 space-y-3">
          <CodeBlock
            code={problem.solution}
            filename={`${problem.id}.cpp`}
            language="C++17"
            maxHeight={640}
            actions={
              <Button variant="ghost" size="xs" onClick={() => navigate(`/problems/${problem.id}`)}>
                Open statement
              </Button>
            }
          />

          <div className="grid gap-3 sm:grid-cols-3">
            <Panel>
              <PanelHeader title="Complexity" />
              <div className="px-4 py-2">
                <SpecRow label="Time" value={complexity.time} />
                <SpecRow label="Memory" value={complexity.memory} />
              </div>
            </Panel>
            <Panel>
              <PanelHeader title="Source" />
              <div className="px-4 py-2">
                <SpecRow label="Lines" value={lines} />
                <SpecRow label="Language" value="C++17" />
                <SpecRow label="Standard" value="-std=c++17 -O2" />
              </div>
            </Panel>
            <Panel>
              <PanelHeader title="Verification" actions={<Badge variant="ok">passing</Badge>} />
              <div className="px-4 py-2">
                <SpecRow label="Stress cases" value="18,492" />
                <SpecRow label="Divergences" value="0" />
                <SpecRow label="Coverage" value="94.2%" />
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  )
}
