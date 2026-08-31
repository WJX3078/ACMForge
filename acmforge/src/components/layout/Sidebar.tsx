import { PanelLeftClose, PanelLeftOpen, Sparkles } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { NAV_GROUPS, NAV_ITEMS } from '@/lib/nav'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/ui/controls'
import { StatusDot } from '@/components/ui/primitives'
import { useAgentEngine } from '@/hooks/useAgentEngine'

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M12 2.5 21 7.5 12 12.5 3 7.5Z" className="fill-brand" />
      <path
        d="M3 12.2 12 17.2 21 12.2"
        className="stroke-brand"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity="0.6"
      />
      <path
        d="M3 16.8 12 21.8 21 16.8"
        className="stroke-brand"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity="0.32"
      />
    </svg>
  )
}

export function Sidebar({
  collapsed,
  onToggleCollapsed,
  onNavigate,
}: {
  collapsed: boolean
  onToggleCollapsed: () => void
  onNavigate?: () => void
}) {
  const { view } = useAgentEngine()

  return (
    <div className="flex h-full w-full flex-col bg-surface">
      {/* brand */}
      <div
        className={cn(
          'flex h-12 shrink-0 items-center border-b border-line',
          collapsed ? 'justify-center px-0' : 'gap-2.5 px-3.5',
        )}
      >
        <LogoMark className="h-[18px] w-[18px] shrink-0" />
        {!collapsed && (
          <>
            <span className="text-md font-semibold tracking-[-0.02em] text-fg">ACMForge</span>
            <span className="mt-[1px] rounded-sm bg-[hsl(var(--fg)/0.06)] px-1 py-[1px] text-2xs font-medium text-fg-subtle">
              v0.1
            </span>
          </>
        )}
      </div>

      {/* nav */}
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        {NAV_GROUPS.map((group) => {
          const items = NAV_ITEMS.filter((i) => i.group === group)
          if (!items.length) return null
          return (
            <div key={group} className="mb-3.5 last:mb-0">
              {!collapsed && <div className="eyebrow mb-1 px-2">{group}</div>}
              <ul className="space-y-px">
                {items.map((item) => {
                  const Icon = item.icon
                  const link = (
                    <NavLink
                      to={item.to}
                      end={item.to === '/'}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          'group relative flex h-7 items-center rounded-md text-base transition-colors duration-150',
                          collapsed ? 'w-7 justify-center' : 'gap-2.5 px-2',
                          isActive
                            ? 'bg-[hsl(var(--fg)/0.07)] font-medium text-fg'
                            : 'text-fg-muted hover:bg-[hsl(var(--fg)/0.04)] hover:text-fg',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && !collapsed && (
                            <span className="absolute left-0 top-1/2 h-3.5 w-[2px] -translate-y-1/2 rounded-r-full bg-brand" />
                          )}
                          <Icon className={cn('h-[15px] w-[15px] shrink-0', isActive && 'text-brand')} />
                          {!collapsed && (
                            <>
                              <span className="truncate">{item.label}</span>
                              {item.badge && (
                                <span
                                  className={cn(
                                    'ml-auto rounded-sm px-1 py-[1px] text-2xs font-medium',
                                    item.badge === 'New'
                                      ? 'bg-brand-soft text-brand'
                                      : 'bg-danger-soft text-danger',
                                  )}
                                >
                                  {item.badge}
                                </span>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </NavLink>
                  )
                  return (
                    <li key={item.to}>
                      {collapsed ? (
                        <div className="flex justify-center">
                          <Tooltip content={item.label} side="right">
                            {link}
                          </Tooltip>
                        </div>
                      ) : (
                        link
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </nav>

      {/* footer */}
      <div className="shrink-0 border-t border-line p-2">
        {!collapsed ? (
          <div className="mb-1.5 rounded-md border border-line bg-surface-sunken px-2.5 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="relative flex h-6 w-6 items-center justify-center rounded-[5px] bg-brand-soft">
                  <Sparkles className="h-3 w-3 text-brand" />
                  <span className="absolute -right-0.5 -bottom-0.5">
                    <StatusDot pulse tone="ok" size={6} />
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-fg">HY4 Agent</div>
                  <div className="text-2xs text-ok">Online</div>
                </div>
              </div>
              <span className="tabular text-2xs text-fg-subtle">{view.activeCount}/7</span>
            </div>
          </div>
        ) : (
          <div className="mb-1.5 flex justify-center">
            <Tooltip content="HY4 Agent · Online" side="right">
              <div className="relative flex h-7 w-7 items-center justify-center rounded-md bg-brand-soft">
                <Sparkles className="h-3.5 w-3.5 text-brand" />
                <span className="absolute -right-0.5 -bottom-0.5">
                  <StatusDot pulse tone="ok" size={6} />
                </span>
              </div>
            </Tooltip>
          </div>
        )}

        <div
          className={cn(
            'flex items-center rounded-md transition-colors hover:bg-[hsl(var(--fg)/0.04)]',
            collapsed ? 'justify-center py-1.5' : 'gap-2.5 px-2 py-1.5',
          )}
        >
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface-raised text-2xs font-semibold text-fg-muted">
            WJ
          </div>
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-fg">邬健翔</div>
                <div className="truncate text-2xs text-fg-subtle">Problem Setter</div>
              </div>
              <button
                type="button"
                onClick={onToggleCollapsed}
                className="hidden rounded-sm p-1 text-fg-subtle transition-colors hover:bg-[hsl(var(--fg)/0.06)] hover:text-fg lg:block"
                aria-label="Toggle sidebar"
              >
                {collapsed ? (
                  <PanelLeftOpen className="h-3.5 w-3.5" />
                ) : (
                  <PanelLeftClose className="h-3.5 w-3.5" />
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
