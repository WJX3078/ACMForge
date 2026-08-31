import { ArrowRight, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { AGENT_MAP } from '@/data/agents'
import { useAgentEngine } from '@/hooks/useAgentEngine'
import { agentProgress } from '@/services/agentEngine'
import { cn } from '@/lib/utils'

/** The seven-node pipeline minimap shown on the right of the hero. */
function PipelineMinimap() {
  const { view, state } = useAgentEngine()
  const dots = view.list.map((rt) => ({ id: rt.id, status: rt.status, p: agentProgress(rt) }))

  return (
    <div className="flex items-center gap-1">
      {dots.map((d, i) => {
        const def = AGENT_MAP[d.id]
        const Icon = def.icon
        return (
          <div key={d.id} className="flex items-center gap-1">
            <div
              className={cn(
                'relative flex h-7 w-7 items-center justify-center rounded-md border transition-colors duration-500',
                d.status === 'completed' && 'border-ok/40 bg-ok-soft text-ok',
                d.status === 'failed' && 'border-danger/50 bg-danger-soft text-danger',
                d.status === 'running' && 'border-brand/50 bg-brand-soft text-brand',
                d.status === 'thinking' && 'border-think/40 bg-think-soft text-think',
                d.status === 'waiting' && 'border-line bg-surface-sunken text-fg-subtle',
              )}
              title={`${def.name} · ${d.status}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {(d.status === 'running' || d.status === 'thinking') && (
                <span className="absolute -inset-[3px] rounded-[7px] border border-brand/30 animate-pulse-ring" />
              )}
            </div>
            {i < dots.length - 1 && (
              <span
                className={cn(
                  'h-px w-3 transition-colors duration-500',
                  d.status === 'completed' ? 'bg-ok/40' : 'bg-line',
                )}
              />
            )}
          </div>
        )
      })}
      <span className="tabular ml-2 text-xs text-fg-subtle">cycle #{state.cycle}</span>
    </div>
  )
}

export function Hero() {
  const navigate = useNavigate()
  const { view } = useAgentEngine()

  return (
    <section className="panel relative mb-3 overflow-hidden">
      {/* faint structural grid, masked to the top-left */}
      <div
        className="pointer-events-none absolute inset-0 bg-grid opacity-60"
        style={{ maskImage: 'radial-gradient(120% 120% at 0% 0%, black 0%, transparent 62%)', WebkitMaskImage: 'radial-gradient(120% 120% at 0% 0%, black 0%, transparent 62%)' }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -top-28 -left-20 h-56 w-56 rounded-full bg-brand/[0.07] blur-3xl"
        aria-hidden
      />

      <div className="relative flex flex-col gap-6 px-5 py-7 sm:px-7 sm:py-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-sunken px-2 py-1">
            <Sparkles className="h-3 w-3 text-brand" />
            <span className="text-2xs font-medium text-fg-muted">
              {view.activeCount} agents active · {view.failedCount} incident
              {view.failedCount === 1 ? '' : 's'}
            </span>
          </div>
          <h1 className="text-balance text-3xl font-semibold leading-[1.08] tracking-[-0.03em] text-fg sm:text-4xl">
            Build problems, not pipelines.
          </h1>
          <p className="mt-2.5 max-w-xl text-md text-fg-muted">
            From idea discovery to judge-ready package — powered by autonomous competitive
            programming agents.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button variant="primary" size="lg" onClick={() => navigate('/factory')}>
              Generate Problem
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="lg" onClick={() => navigate('/ideas')}>
              Explore Ideas
            </Button>
            <span className="ml-1 hidden items-center gap-1.5 text-xs text-fg-subtle sm:flex">
              or press
              <kbd className="rounded border border-line bg-surface-raised px-1.5 py-0.5 text-2xs">⌘K</kbd>
              for commands
            </span>
          </div>
        </div>

        <div className="shrink-0">
          <div className="text-2xs uppercase tracking-[0.09em] text-fg-subtle">Live pipeline</div>
          <div className="mt-2 hidden lg:block">
            <PipelineMinimap />
          </div>
        </div>
      </div>
    </section>
  )
}
