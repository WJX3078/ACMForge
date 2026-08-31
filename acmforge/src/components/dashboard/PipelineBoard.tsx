import { ChevronRight, Pause, Play, RotateCcw } from 'lucide-react'
import { Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { ProgressBar, StatusDot } from '@/components/ui/primitives'
import { AGENT_MAP } from '@/data/agents'
import { useAgentEngine } from '@/hooks/useAgentEngine'
import { agentProgress, agentTaskLabel } from '@/services/agentEngine'
import { agentStatusStyles, cn, formatElapsed, formatNumber } from '@/lib/utils'
import type { AgentRuntime } from '@/types'

const PROGRESS_TONE: Record<string, 'brand' | 'think' | 'ok' | 'danger' | 'warn'> = {
  running: 'brand',
  thinking: 'think',
  completed: 'ok',
  failed: 'danger',
  waiting: 'warn',
}

export function AgentCard({ rt, index }: { rt: AgentRuntime; index: number }) {
  const { select } = useAgentEngine()
  const def = AGENT_MAP[rt.id]
  const Icon = def.icon
  const st = agentStatusStyles[rt.status]
  const active = rt.status === 'running' || rt.status === 'thinking'

  return (
    <button
      type="button"
      onClick={() => select(rt.id)}
      className={cn(
        'group relative flex min-w-0 flex-1 flex-col gap-2.5 rounded-lg border bg-surface p-3 text-left transition-all duration-200',
        'hover:border-line-strong hover:bg-surface-raised',
        rt.status === 'failed' ? 'border-danger/40' : 'border-line',
      )}
    >
      <span className="tabular absolute right-2.5 top-2 text-2xs text-fg-subtle/70">
        {String(index + 1).padStart(2, '0')}
      </span>

      <div className="flex items-center gap-2">
        <span
          className={cn(
            'relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors duration-300',
            rt.status === 'running' && 'border-brand/40 bg-brand-soft text-brand',
            rt.status === 'thinking' && 'border-think/40 bg-think-soft text-think',
            rt.status === 'completed' && 'border-ok/35 bg-ok-soft text-ok',
            rt.status === 'failed' && 'border-danger/45 bg-danger-soft text-danger',
            rt.status === 'waiting' && 'border-line bg-surface-sunken text-fg-subtle',
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {active && (
            <span className="absolute -inset-[3px] animate-pulse-ring rounded-[7px] border border-brand/30" />
          )}
        </span>
        <span className={cn('rounded-sm px-1.5 py-[2px] text-2xs font-medium', st.chip)}>
          {st.label}
        </span>
      </div>

      <div className="min-w-0">
        <div className="truncate text-base font-medium text-fg">{def.name}</div>
        <div className="mt-0.5 line-clamp-2 min-h-[28px] text-xs leading-[14px] text-fg-muted">
          {agentTaskLabel(rt)}
        </div>
      </div>

      <div className="mt-auto w-full space-y-1.5">
        <ProgressBar value={agentProgress(rt)} tone={PROGRESS_TONE[rt.status]} />
        <div className="flex items-center justify-between text-2xs text-fg-subtle">
          <span className="tabular">
            {rt.status === 'waiting' ? 'queued' : formatElapsed(rt.elapsed)}
          </span>
          <span className="tabular flex items-center gap-1">
            <span className="text-fg-subtle/70">io</span>
            {formatNumber(rt.io.in)}
            <ChevronRight className="h-2.5 w-2.5" />
            {formatNumber(rt.io.out)}
          </span>
        </div>
      </div>
    </button>
  )
}

export function PipelineBoard() {
  const { view, state, paused, togglePaused, restart } = useAgentEngine()
  const navigate = useNavigate()

  return (
    <Panel>
      <PanelHeader
        title="Agent Pipeline"
        description={
          <span className="flex items-center gap-2">
            <span>Streaming run</span>
            <span className="tabular rounded-sm bg-[hsl(var(--fg)/0.06)] px-1 text-2xs text-fg-subtle">
              cycle #{state.cycle}
            </span>
            <span className="tabular">
              {view.completedCount}/{view.list.length} completed
            </span>
            {view.failedCount > 0 && (
              <span className="text-danger">{view.failedCount} failed</span>
            )}
          </span>
        }
        actions={
          <>
            <Button variant="ghost" size="icon-sm" onClick={togglePaused} aria-label={paused ? 'Resume' : 'Pause'}>
              {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={restart} aria-label="Restart run">
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
            <Button variant="secondary" size="sm" onClick={() => navigate('/agents')}>
              All agents
            </Button>
          </>
        }
      />

      <div className="p-3">
        {/* wide: a literal flow with hand-off arrows */}
        <div className="hidden items-stretch xl:flex">
          {view.list.map((rt, i) => (
            <Fragment key={rt.id}>
              {i > 0 && (
                <div className="flex w-5 shrink-0 items-center justify-center">
                  <ChevronRight
                    className={cn(
                      'h-3.5 w-3.5 transition-colors duration-300',
                      view.list[i - 1].status === 'completed' ? 'text-ok/60' : 'text-fg-subtle/40',
                    )}
                  />
                </div>
              )}
              <AgentCard rt={rt} index={i} />
            </Fragment>
          ))}
        </div>

        {/* narrow: grid, order carried by the step number */}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:hidden">
          {view.list.map((rt, i) => (
            <AgentCard key={rt.id} rt={rt} index={i} />
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line pt-2.5">
          {(['running', 'thinking', 'completed', 'waiting', 'failed'] as const).map((s) => (
            <span key={s} className="flex items-center gap-1.5 text-2xs text-fg-subtle">
              <StatusDot
                tone={s === 'running' ? 'brand' : s === 'thinking' ? 'think' : s === 'completed' ? 'ok' : s === 'failed' ? 'danger' : 'muted'}
                size={6}
              />
              {agentStatusStyles[s].label}
            </span>
          ))}
          <span className="tabular ml-auto text-2xs text-fg-subtle">
            {formatNumber(view.totalTokens)} tokens this cycle
          </span>
        </div>
      </div>
    </Panel>
  )
}
