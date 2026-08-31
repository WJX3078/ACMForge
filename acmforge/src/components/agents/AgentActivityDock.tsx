import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, ChevronUp, Pause, Play, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AGENT_MAP } from '@/data/agents'
import { useAgentEngine } from '@/hooks/useAgentEngine'
import { agentTaskDetail, agentProgress } from '@/services/agentEngine'
import { cn, formatElapsed } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ProgressBar, StatusDot } from '@/components/ui/primitives'

const TONE: Record<string, 'brand' | 'think' | 'muted' | 'ok' | 'danger'> = {
  running: 'brand',
  thinking: 'think',
  completed: 'ok',
  failed: 'danger',
  waiting: 'muted',
}

export function AgentActivityDock() {
  const [open, setOpen] = useState(false)
  const { view, state, paused, togglePaused, restart, select } = useAgentEngine()
  const navigate = useNavigate()

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-40 hidden w-[336px] sm:block">
      <div className="pointer-events-auto overflow-hidden rounded-lg border border-line-strong bg-surface shadow-lift">
        {/* header */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-[hsl(var(--fg)/0.03)]"
        >
          <StatusDot tone={view.failedCount ? 'danger' : 'brand'} pulse={view.activeCount > 0} size={7} />
          <span className="text-base font-medium text-fg">
            {view.activeCount} Agent{view.activeCount === 1 ? '' : 's'} Running
          </span>
          <span className="tabular ml-auto text-xs text-fg-subtle">cycle #{state.cycle}</span>
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 text-fg-subtle" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5 text-fg-subtle" />
          )}
        </button>

        <div className="px-3 pb-2.5">
          <ProgressBar value={view.progress} />
        </div>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden border-t border-line"
            >
              <div className="max-h-[min(46vh,420px)] overflow-y-auto">
                {view.list.map((rt) => {
                  const def = AGENT_MAP[rt.id]
                  const Icon = def.icon
                  const active = rt.status === 'running' || rt.status === 'thinking'
                  return (
                    <button
                      key={rt.id}
                      type="button"
                      onClick={() => select(rt.id)}
                      className="flex w-full items-start gap-2.5 border-b border-line px-3 py-2 text-left transition-colors last:border-0 hover:bg-[hsl(var(--fg)/0.04)]"
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] border border-line bg-surface-sunken',
                          active ? 'text-brand' : 'text-fg-subtle',
                        )}
                      >
                        <Icon className="h-3 w-3" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-fg">{def.name}</span>
                          <span className="tabular ml-auto shrink-0 text-2xs text-fg-subtle">
                            {rt.status === 'waiting' ? '—' : formatElapsed(rt.elapsed)}
                          </span>
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-fg-muted">
                          {agentTaskDetail(rt)}
                        </span>
                        <span className="mt-1 block">
                          <ProgressBar
                            value={agentProgress(rt)}
                            tone={TONE[rt.status] ?? 'brand'}
                            className="h-[3px]"
                          />
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
              <div className="flex items-center gap-1.5 border-t border-line bg-surface-sunken px-2.5 py-2">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={togglePaused}
                  aria-label={paused ? 'Resume' : 'Pause'}
                >
                  {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={restart} aria-label="Restart">
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  onClick={() => navigate('/agents')}
                >
                  View all agents
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
