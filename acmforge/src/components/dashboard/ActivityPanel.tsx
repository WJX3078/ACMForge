import { AlertTriangle, CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { ACTIVITY_FEED } from '@/data/activity'
import { useAgentEngine } from '@/hooks/useAgentEngine'
import { agentTaskDetail } from '@/services/agentEngine'
import { cn, formatRelative } from '@/lib/utils'

const ICONS = {
  success: CheckCircle2,
  info: AlertTriangle,
  warn: AlertTriangle,
  error: XCircle,
  progress: Loader2,
}
const TONE = {
  success: 'text-ok',
  info: 'text-info',
  warn: 'text-warn',
  error: 'text-danger',
  progress: 'text-brand',
}

export function ActivityPanel() {
  const { view } = useAgentEngine()
  const live = view.list.filter((a) => a.status === 'running' || a.status === 'thinking')

  return (
    <Panel>
      <PanelHeader title="Activity" description="Live from the agent mesh" />
      <div className="divide-y divide-line">
        {live.slice(0, 3).map((rt) => (
          <div key={rt.id} className="flex items-start gap-2.5 px-3.5 py-2.5">
            <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin-slow text-brand" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-fg capitalize">{rt.id.replace(/-/g, ' ')}</div>
              <div className="mt-0.5 truncate text-xs text-fg-muted">{agentTaskDetail(rt)}</div>
            </div>
            <span className="shrink-0 text-2xs text-fg-subtle">now</span>
          </div>
        ))}
        {ACTIVITY_FEED.map((item) => {
          const Icon = ICONS[item.kind]
          return (
            <div key={item.id} className="flex items-start gap-2.5 px-3.5 py-2.5">
              <Icon className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', TONE[item.kind])} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-fg">{item.title}</div>
                <div className="mt-0.5 truncate text-xs text-fg-muted">{item.detail}</div>
              </div>
              <span className="shrink-0 text-2xs whitespace-nowrap text-fg-subtle">
                {formatRelative(item.at)}
              </span>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}
