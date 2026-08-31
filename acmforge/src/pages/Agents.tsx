import { ArrowUpRight, Pause, Play, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Panel } from '@/components/ui/panel'
import { ProgressBar } from '@/components/ui/primitives'
import { PageHeader } from '@/components/layout/AppShell'
import { AGENT_MAP } from '@/data/agents'
import { useAgentEngine } from '@/hooks/useAgentEngine'
import { agentProgress, agentTaskDetail, agentTaskLabel } from '@/services/agentEngine'
import { agentStatusStyles, cn, formatDuration, formatNumber } from '@/lib/utils'
import type { AgentRuntime } from '@/types'

const PROGRESS_TONE: Record<string, 'brand' | 'think' | 'ok' | 'danger' | 'warn'> = {
  running: 'brand',
  thinking: 'think',
  completed: 'ok',
  failed: 'danger',
  waiting: 'warn',
}

function AgentTile({ rt }: { rt: AgentRuntime }) {
  const { select } = useAgentEngine()
  const def = AGENT_MAP[rt.id]
  const Icon = def.icon
  const st = agentStatusStyles[rt.status]
  const active = rt.status === 'running' || rt.status === 'thinking'

  return (
    <div
      className={cn(
        'flex flex-col rounded-lg border bg-surface p-4 transition-colors duration-200',
        rt.status === 'failed' ? 'border-danger/40' : 'border-line hover:border-line-strong',
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-colors duration-300',
            rt.status === 'running' && 'border-brand/40 bg-brand-soft text-brand',
            rt.status === 'thinking' && 'border-think/40 bg-think-soft text-think',
            rt.status === 'completed' && 'border-ok/35 bg-ok-soft text-ok',
            rt.status === 'failed' && 'border-danger/45 bg-danger-soft text-danger',
            rt.status === 'waiting' && 'border-line bg-surface-sunken text-fg-subtle',
          )}
        >
          <Icon className="h-4 w-4" />
          {active && (
            <span className="absolute -inset-[3px] animate-pulse-ring rounded-[9px] border border-brand/30" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-md font-semibold text-fg">{def.name}</h3>
            <span className={cn('ml-auto shrink-0 rounded-sm px-1.5 py-[2px] text-2xs font-medium', st.chip)}>
              {st.label}
            </span>
          </div>
          <div className="mt-0.5 truncate font-mono text-2xs text-fg-subtle">
            {def.codename} · {def.role}
          </div>
        </div>
      </div>

      <p className="mt-3 text-sm leading-[20px] text-fg-muted">{def.description}</p>

      <div className="mt-3 rounded-md border border-line bg-surface-sunken px-2.5 py-2">
        <div className="eyebrow">Current task</div>
        <div className="mt-1 truncate text-base font-medium text-fg">{agentTaskLabel(rt)}</div>
        <div className="mt-0.5 line-clamp-2 text-xs text-fg-muted">{agentTaskDetail(rt)}</div>
        <ProgressBar value={agentProgress(rt)} tone={PROGRESS_TONE[rt.status]} className="mt-2" />
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        {[
          { label: 'Runtime', value: rt.status === 'waiting' ? '—' : formatDuration(rt.elapsed) },
          { label: 'Tokens', value: formatNumber(rt.tokens.in + rt.tokens.out) },
          { label: 'In', value: formatNumber(rt.io.in) },
          { label: 'Out', value: formatNumber(rt.io.out) },
        ].map((m) => (
          <div key={m.label}>
            <div className="text-2xs text-fg-subtle">{m.label}</div>
            <div className="tabular mt-0.5 text-sm font-medium text-fg">{m.value}</div>
          </div>
        ))}
      </div>

      <Button variant="secondary" size="sm" className="mt-3" onClick={() => select(rt.id)}>
        Inspect agent
        <ArrowUpRight className="h-3 w-3" />
      </Button>
    </div>
  )
}

export default function Agents() {
  const { view, state, paused, togglePaused, restart } = useAgentEngine()

  return (
    <div>
      <PageHeader
        title="Agents"
        description="Seven specialised agents share one streaming pipeline. Inspect any of them for its reasoning, tool calls and token budget."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={togglePaused}>
              {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
              {paused ? 'Resume' : 'Pause'}
            </Button>
            <Button variant="secondary" size="sm" onClick={restart}>
              <RotateCcw className="h-3.5 w-3.5" />
              Restart run
            </Button>
          </>
        }
      />

      <Panel className="mb-3">
        <div className="grid grid-cols-2 divide-line sm:grid-cols-5 sm:divide-x">
          {[
            { label: 'Cycle', value: `#${state.cycle}` },
            { label: 'Running', value: view.activeCount },
            { label: 'Completed', value: `${view.completedCount} / 7` },
            { label: 'Incidents', value: view.failedCount, tone: view.failedCount ? 'text-danger' : undefined },
            { label: 'Tokens', value: formatNumber(view.totalTokens) },
          ].map((s) => (
            <div key={s.label} className="px-3.5 py-2.5">
              <div className="eyebrow">{s.label}</div>
              <div className={cn('tabular mt-1 text-lg font-semibold text-fg', s.tone)}>{s.value}</div>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
        {view.list.map((rt) => (
          <AgentTile key={rt.id} rt={rt} />
        ))}
      </div>
    </div>
  )
}
