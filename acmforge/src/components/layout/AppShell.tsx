import { Suspense, useEffect, useState, type ReactNode } from 'react'
import { Outlet } from 'react-router-dom'
import { PageFallback } from '@/components/common/PageFallback'
import { AgentActivityDock } from '@/components/agents/AgentActivityDock'
import { AgentDrawer } from '@/components/agents/AgentDrawer'
import { CommandPalette } from '@/components/layout/CommandPalette'
import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'
import { Toaster } from '@/components/layout/Toaster'
import { Sheet, SheetContent } from '@/components/ui/dialog'
import { TooltipProvider } from '@/components/ui/controls'
import { useBreakpoints } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/utils'

const COLLAPSE_KEY = 'acmforge.sidebar.collapsed'

export function AppShell() {
  const { isDesktop } = useBreakpoints()
  const [collapsed, setCollapsed] = useState(
    () => window.localStorage.getItem(COLLAPSE_KEY) === '1',
  )
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    window.localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0')
  }, [collapsed])

  return (
    <TooltipProvider delayDuration={260}>
      <div className="flex h-screen w-full overflow-hidden bg-canvas">
        {isDesktop ? (
          <aside
            className={cn(
              'shrink-0 border-r border-line transition-[width] duration-200 ease-forge',
              collapsed ? 'w-[60px]' : 'w-[236px]',
            )}
          >
            <Sidebar collapsed={collapsed} onToggleCollapsed={() => setCollapsed((c) => !c)} />
          </aside>
        ) : (
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetContent side="left" className="w-[264px] p-0" width="264px">
              <Sidebar
                collapsed={false}
                onNavigate={() => setMobileOpen(false)}
                onToggleCollapsed={() => setMobileOpen(false)}
              />
            </SheetContent>
          </Sheet>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <Header showMenuButton={!isDesktop} onOpenSidebar={() => setMobileOpen(true)} />
          <main className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[1680px] px-4 pt-4 pb-16 sm:px-6 sm:pt-5">
              {/* Routes are code-split; the shell stays mounted while a chunk loads. */}
              <Suspense fallback={<PageFallback />}>
                <Outlet />
              </Suspense>
            </div>
          </main>
        </div>

        <AgentActivityDock />
        <AgentDrawer />
        <CommandPalette />
        <Toaster />
      </div>
    </TooltipProvider>
  )
}

export function PageHeader({
  title,
  description,
  actions,
  className,
  breadcrumb,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
  breadcrumb?: ReactNode
}) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        {breadcrumb && <div className="mb-1 text-xs text-fg-subtle">{breadcrumb}</div>}
        <h1 className="text-xl font-semibold tracking-[-0.02em] text-fg">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-base text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
