import { Check, Circle, Loader2, Terminal, Wrench } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/controls'
import { ProgressBar } from '@/components/ui/primitives'
import { AGENT_MAP } from '@/data/agents'
import { useAgentEngine } from '@/hooks/useAgentEngine'
import { useCopy } from '@/hooks/useCopy'
import { agentProgress, agentTaskDetail, agentTaskLabel } from '@/services/agentEngine'
import { cn, formatDuration, formatNumber } from '@/lib/utils'
import type { AgentRuntime, LogLevel } from '@/types'

const LEVEL_STYLE: Record<LogLevel, { text: string; tag: string }> = {
  info: { text: 'text-fg-muted', tag: 'text-info' },
  debug: { text: 'text-fg-subtle', tag: 'text-fg-subtle' },
  success: { text: 'text-ok', tag: 'text-ok' },
  warn: { text: 'text-warn', tag: 'text-warn' },
  error: { text: 'text-danger', tag: 'text-danger' },
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border border-line bg-surface-sunken px-2.5 py-2">
      <div className="eyebrow">{label}</div>
      <div className="tabular mt-1 text-md font-semibold text-fg">{value}</div>
      {hint && <div className="mt-0.5 text-2xs text-fg-subtle">{hint}</div>}
    </div>
  )
}

function Logs({ rt }: { rt: AgentRuntime }) {
  const ref = useRef<HTMLDivElement>(null)
  const { copied, copy } = useCopy()

  useEffect(() => {
    const node = ref.current
    if (node) node.scrollTop = node.scrollHeight
  }, [rt.logs.length])

  const text = rt.logs.map((l) => `[+${(l.at / 1000).toFixed(1)}s] ${l.level.toUpperCase()} ${l.text}`).join('\n')

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between px-4 py-2">
        <span className="eyebrow">Session log · cycle #{rt.cycle}</span>
        <Button variant="ghost" size="xs" onClick={() => copy(text)}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <div
        ref={ref}
        className="min-h-0 flex-1 overflow-y-auto border-t border-line bg-surface-sunken px-3 py-2 font-mono text-xs leading-[18px]"
      >
        {rt.logs.length === 0 && (
          <div className="py-6 text-center text-xs text-fg-subtle">No output yet.</div>
        )}
        {rt.logs.map((l) => (
          <div key={l.id} className="flex animate-log-in gap-2">
            <span className="tabular shrink-0 text-fg-subtle/70">+{(l.at / 1000).toFixed(1)}s</span>
            <span className={cn('w-[46px] shrink-0 uppercase', LEVEL_STYLE[l.level].tag)}>
              {l.level}
            </span>
            <span className={cn('min-w-0 whitespace-pre-wrap break-words', LEVEL_STYLE[l.level].text)}>
              {l.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Timeline({ rt }: { rt: AgentRuntime }) {
  const def = AGENT_MAP[rt.id]
  return (
    <div className="space-y-px px-4 py-3">
      {def.steps.map((step, i) => {
        const done = i < rt.stepIndex || rt.status === 'completed'
        const active = i === rt.stepIndex && (rt.status === 'running' || rt.status === 'thinking')
        const failed = rt.status === 'failed' && i === rt.stepIndex
        const progress = active ? Math.min(1, rt.stepElapsed / step.durationMs) : done ? 1 : 0
        return (
          <div key={step.label} className="relative flex gap-3 pb-3 last:pb-0">
            {i < def.steps.length - 1 && (
              <span
                className={cn(
                  'absolute left-[9px] top-[19px] bottom-0 w-px',
                  done ? 'bg-ok/40' : 'bg-line',
                )}
              />
            )}
            <span className="relative z-10 mt-[2px] flex h-[19px] w-[19px] shrink-0 items-center justify-center">
              {done && !failed && (
                <span className="flex h-[19px] w-[19px] items-center justify-center rounded-full bg-ok-soft">
                  <Check className="h-3 w-3 text-ok" />
                </span>
              )}
              {failed && (
                <span className="flex h-[19px] w-[19px] items-center justify-center rounded-full bg-danger-soft">
                  <span className="h-1.5 w-1.5 rounded-full bg-danger" />
                </span>
              )}
              {active && (
                <span className="flex h-[19px] w-[19px] items-center justify-center rounded-full bg-brand-soft">
                  <Loader2 className="h-3 w-3 animate-spin-slow text-brand" />
                </span>
              )}
              {!done && !active && !failed && (
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
                    active && 'font-medium text-fg',
                    !done && !active && 'text-fg-subtle',
                  )}
                >
                  {step.label}
                </span>
                <span className="tabular shrink-0 text-2xs text-fg-subtle">
                  {(step.durationMs / 1000).toFixed(1)}s
                </span>
              </div>
              <p className="mt-0.5 text-sm text-fg-muted">{step.detail}</p>
              {(active || done) && <ProgressBar value={progress} className="mt-1.5" tone={done ? 'ok' : 'brand'} />}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ToolCalls({ rt }: { rt: AgentRuntime }) {
  if (!rt.toolCalls.length) {
    return (
      <div className="px-4 py-8 text-center text-base text-fg-subtle">
        No tool calls in this cycle yet.
      </div>
    )
  }
  return (
    <div className="divide-y divide-line">
      {rt.toolCalls
        .slice()
        .reverse()
        .map((t) => (
          <div key={t.id} className="flex items-center gap-3 px-4 py-2">
            <span
              className={cn(
                'h-1.5 w-1.5 shrink-0 rounded-full',
                t.status === 'ok' && 'bg-ok',
                t.status === 'running' && 'bg-brand',
                t.status === 'failed' && 'bg-danger',
              )}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate font-mono text-xs text-fg">{t.name}</div>
              <div className="truncate text-xs text-fg-subtle">{t.detail}</div>
            </div>
            <span className="tabular shrink-0 text-2xs text-fg-subtle">{t.durationMs} ms</span>
            <span
              className={cn(
                'w-12 shrink-0 text-right text-2xs',
                t.status === 'ok' && 'text-ok',
                t.status === 'running' && 'text-brand',
                t.status === 'failed' && 'text-danger',
              )}
            >
              {t.status}
            </span>
          </div>
        ))}
    </div>
  )
}

function DrawerBody({ rt }: { rt: AgentRuntime }) {
  const def = AGENT_MAP[rt.id]
  const Icon = def.icon
  const [tab, setTab] = useState('timeline')

  const tokensTotal = Math.max(1, rt.tokens.in + rt.tokens.out)

  return (
    <>
      <SheetHeader
        title={
          <span className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-[5px] border border-line bg-surface-sunken text-brand">
              <Icon className="h-3.5 w-3.5" />
            </span>
            {def.name}
          </span>
        }
        subtitle={
          <span className="font-mono">
            {def.codename} · {def.role}
          </span>
        }
        badge={
          <Badge
            variant={
              rt.status === 'completed'
                ? 'ok'
                : rt.status === 'failed'
                  ? 'danger'
                  : rt.status === 'thinking'
                    ? 'think'
                    : rt.status === 'running'
                      ? 'brand'
                      : 'default'
            }
          >
            {rt.status}
          </Badge>
        }
      />

      <div className="shrink-0 border-b border-line px-5 py-3">
        <div className="eyebrow mb-1 flex items-center gap-1.5">
          <Terminal className="h-3 w-3" /> Current task
        </div>
        <div className="text-md font-medium text-fg">{agentTaskLabel(rt)}</div>
        <p className="mt-0.5 text-sm text-fg-muted">{agentTaskDetail(rt)}</p>
        <div className="mt-2.5 flex items-center gap-3">
          <ProgressBar value={agentProgress(rt)} className="flex-1" />
          <span className="tabular shrink-0 text-xs text-fg-subtle">
            {formatDuration(rt.elapsed)}
          </span>
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-4 gap-2 border-b border-line px-5 py-3">
        <Metric label="Runtime" value={formatDuration(rt.elapsed)} hint={`step ${Math.min(rt.stepIndex + 1, def.steps.length)}/${def.steps.length}`} />
        <Metric label="Tokens" value={formatNumber(rt.tokens.in + rt.tokens.out)} hint={`${formatNumber(rt.tokens.in)} in`} />
        <Metric label="Inputs" value={formatNumber(rt.io.in)} hint="records" />
        <Metric label="Outputs" value={formatNumber(rt.io.out)} hint="records" />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 px-5 pt-3">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="timeline">Reasoning Timeline</TabsTrigger>
            <TabsTrigger value="tools" className="gap-1.5">
              <Wrench className="h-3 w-3" /> Tool Calls
              <span className="tabular rounded-sm bg-[hsl(var(--fg)/0.08)] px-1 text-2xs text-fg-subtle">
                {rt.toolCalls.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="timeline" className="min-h-0 flex-1 overflow-y-auto">
          <Timeline rt={rt} />
          <div className="mx-5 mb-4 rounded-md border border-line bg-surface-sunken px-3 py-2.5">
            <div className="eyebrow mb-1.5">Token usage split</div>
            <div className="flex h-1.5 overflow-hidden rounded-full bg-[hsl(var(--fg)/0.07)]">
              <div className="bg-brand" style={{ width: `${(rt.tokens.in / tokensTotal) * 100}%` }} />
              <div className="bg-think" style={{ width: `${(rt.tokens.out / tokensTotal) * 100}%` }} />
            </div>
            <div className="mt-1.5 flex justify-between text-2xs text-fg-subtle">
              <span>prompt {formatNumber(rt.tokens.in)}</span>
              <span>completion {formatNumber(rt.tokens.out)}</span>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="tools" className="min-h-0 flex-1 overflow-y-auto">
          <ToolCalls rt={rt} />
        </TabsContent>

        <TabsContent value="logs" className="flex min-h-0 flex-1 flex-col">
          <Logs rt={rt} />
        </TabsContent>
      </Tabs>
    </>
  )
}

export function AgentDrawer() {
  const { selected, select, state } = useAgentEngine()
  const rt = selected ? state.agents[selected] : null

  return (
    <Sheet open={!!selected} onOpenChange={(v) => !v && select(null)}>
      <SheetContent side="right" className="w-[min(580px,100vw)] p-0">
        {rt && <DrawerBody rt={rt} />}
      </SheetContent>
    </Sheet>
  )
}
