import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import {
  Bell,
  Command,
  Github,
  Menu,
  Moon,
  Plus,
  Search,
  Sun,
} from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/controls'
import { Kbd } from '@/components/ui/primitives'
import { NOTIFICATIONS } from '@/data/activity'
import { useTheme } from '@/hooks/useTheme'
import { useUi } from '@/hooks/useUi'
import { EXTERNAL_LINKS, pageTitle } from '@/lib/nav'
import { cn, formatRelative } from '@/lib/utils'

function NotificationBell() {
  const unread = NOTIFICATIONS.filter((n) => n.unread).length
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="relative inline-flex h-7 w-7 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-[hsl(var(--fg)/0.06)] hover:text-fg"
          aria-label="Notifications"
        >
          <Bell className="h-[15px] w-[15px]" />
          {unread > 0 && (
            <span className="absolute top-1 right-1 flex h-[13px] min-w-[13px] items-center justify-center rounded-full bg-danger px-[3px] text-[9px] font-semibold text-[hsl(0_0%_100%)]">
              {unread}
            </span>
          )}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-[60] w-[340px] overflow-hidden rounded-lg border border-line-strong bg-surface-raised shadow-lift data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <span className="text-md font-semibold text-fg">Notifications</span>
            <button className="text-xs text-fg-subtle transition-colors hover:text-fg">Mark all read</button>
          </div>
          <div className="max-h-[320px] overflow-y-auto">
            {NOTIFICATIONS.map((n) => (
              <div
                key={n.id}
                className="flex gap-2.5 border-b border-line px-3 py-2.5 last:border-0 hover:bg-[hsl(var(--fg)/0.03)]"
              >
                <span
                  className={cn(
                    'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
                    n.kind === 'success' && 'bg-ok',
                    n.kind === 'error' && 'bg-danger',
                    n.kind === 'warn' && 'bg-warn',
                    n.kind === 'info' && 'bg-info',
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="truncate text-base font-medium text-fg">{n.title}</span>
                    {n.unread && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />}
                  </div>
                  <p className="mt-0.5 text-sm text-fg-muted">{n.detail}</p>
                  <span className="mt-1 block text-2xs text-fg-subtle">{formatRelative(n.at)}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-line px-3 py-2">
            <button className="text-xs font-medium text-brand hover:underline">
              View all activity
            </button>
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

export function Header({
  onOpenSidebar,
  showMenuButton,
}: {
  onOpenSidebar: () => void
  showMenuButton: boolean
}) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { openPalette } = useUi()
  const { theme, toggle } = useTheme()
  const title = pageTitle(pathname)

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-surface px-3 sm:px-4">
      {showMenuButton && (
        <Button variant="ghost" size="icon-sm" onClick={onOpenSidebar} aria-label="Open navigation">
          <Menu className="h-4 w-4" />
        </Button>
      )}

      <div className="flex min-w-0 items-center gap-1.5">
        <span className="hidden truncate text-base text-fg-subtle sm:inline">ACMForge</span>
        <span className="hidden text-fg-subtle/60 sm:inline">/</span>
        <span className="truncate text-base font-semibold tracking-[-0.01em] text-fg">{title}</span>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          onClick={openPalette}
          className="group hidden h-7 items-center gap-2 rounded-md border border-line bg-surface-sunken px-2 text-sm text-fg-subtle transition-colors hover:border-line-strong hover:text-fg-muted md:flex"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="pr-6">Search…</span>
          <Kbd>⌘K</Kbd>
        </button>

        <Tooltip content="Command palette">
          <Button variant="ghost" size="icon-sm" onClick={openPalette} aria-label="Command palette" className="md:hidden">
            <Command className="h-[15px] w-[15px]" />
          </Button>
        </Tooltip>

        <Tooltip content={theme === 'dark' ? 'Light theme' : 'Dark theme'}>
          <Button variant="ghost" size="icon-sm" onClick={toggle} aria-label="Toggle theme">
            {theme === 'dark' ? <Sun className="h-[15px] w-[15px]" /> : <Moon className="h-[15px] w-[15px]" />}
          </Button>
        </Tooltip>

        <NotificationBell />

        <Tooltip content="GitHub">
          <Button variant="ghost" size="icon-sm" asChild>
            <a href={EXTERNAL_LINKS.github} target="_blank" rel="noreferrer" aria-label="GitHub">
              <Github className="h-[15px] w-[15px]" />
            </a>
          </Button>
        </Tooltip>

        <Button variant="primary" size="sm" onClick={() => navigate('/factory')} className="ml-0.5">
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">New Problem</span>
        </Button>
      </div>
    </header>
  )
}
