import * as DialogPrimitive from '@radix-ui/react-dialog'
import {
  ArrowRight,
  CornerDownLeft,
  Github,
  Moon,
  Pause,
  Play,
  RotateCcw,
  ScanSearch,
  Search,
  Sparkles,
  Zap,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Kbd } from '@/components/ui/primitives'
import { NAV_ITEMS } from '@/lib/nav'
import { cn } from '@/lib/utils'
import { PROBLEMS } from '@/data/problems'
import { useAgentEngine } from '@/hooks/useAgentEngine'
import { useTheme } from '@/hooks/useTheme'
import { useUi } from '@/hooks/useUi'
import { DifficultyBadge } from '@/components/ui/badge'

interface Command {
  id: string
  label: string
  group: string
  hint?: string
  icon: ReactNode
  keywords?: string
  run: () => void
}

function score(query: string, text: string) {
  if (!query) return 1
  const q = query.toLowerCase()
  const t = text.toLowerCase()
  const i = t.indexOf(q)
  if (i === 0) return 3
  if (i > 0) return 2
  // subsequence match
  let p = 0
  for (const ch of t) {
    if (ch === q[p]) p++
    if (p === q.length) return 1
  }
  return 0
}

export function CommandPalette() {
  const { paletteOpen, closePalette } = useUi()
  const navigate = useNavigate()
  const location = useLocation()
  const { paused, togglePaused, restart } = useAgentEngine()
  const { theme, toggle } = useTheme()

  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  const commands = useMemo<Command[]>(() => {
    const nav: Command[] = NAV_ITEMS.map((item) => ({
      id: `nav:${item.to}`,
      label: item.label,
      group: 'Navigation',
      icon: <item.icon className="h-4 w-4" />,
      keywords: item.group,
      run: () => navigate(item.to),
    }))

    const actions: Command[] = [
      {
        id: 'act:generate',
        label: 'Generate Problem',
        group: 'Actions',
        hint: 'Open the factory',
        icon: <Sparkles className="h-4 w-4" />,
        run: () => navigate('/factory'),
      },
      {
        id: 'act:stress',
        label: 'Open Stress Test',
        group: 'Actions',
        hint: 'Differential bench',
        icon: <Zap className="h-4 w-4" />,
        run: () => navigate('/stress'),
      },
      {
        id: 'act:search-problems',
        label: 'Search Problems',
        group: 'Actions',
        icon: <Search className="h-4 w-4" />,
        run: () => navigate('/problems'),
      },
      {
        id: 'act:view-agents',
        label: 'View Agents',
        group: 'Actions',
        icon: <Sparkles className="h-4 w-4" />,
        run: () => navigate('/agents'),
      },
      {
        id: 'act:rescan',
        label: 'Rescan duplicates',
        group: 'Actions',
        icon: <ScanSearch className="h-4 w-4" />,
        run: () => navigate('/duplicates'),
      },
      {
        id: 'act:pause',
        label: paused ? 'Resume agent pipeline' : 'Pause agent pipeline',
        group: 'Actions',
        icon: paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />,
        run: togglePaused,
      },
      {
        id: 'act:restart',
        label: 'Restart agent pipeline',
        group: 'Actions',
        icon: <RotateCcw className="h-4 w-4" />,
        run: restart,
      },
      {
        id: 'act:theme',
        label: theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
        group: 'Actions',
        icon: <Moon className="h-4 w-4" />,
        run: toggle,
      },
      {
        id: 'act:github',
        label: 'Open GitHub repository',
        group: 'Actions',
        icon: <Github className="h-4 w-4" />,
        run: () => window.open('https://github.com', '_blank'),
      },
    ]

    const problems: Command[] = PROBLEMS.map((p) => ({
      id: `problem:${p.id}`,
      label: p.title,
      group: 'Problems',
      hint: `${p.difficulty} · ${p.algorithms.join(' / ')}`,
      icon: <DifficultyBadge value={p.difficulty} showDot={false} />,
      keywords: p.algorithms.join(' ') + ' ' + p.status,
      run: () => navigate(`/problems/${p.id}`),
    }))

    return [...nav, ...actions, ...problems]
  }, [navigate, paused, togglePaused, restart, theme, toggle])

  const results = useMemo(() => {
    if (!query.trim()) return commands
    return commands
      .map((c) => ({ c, s: Math.max(score(query, c.label), score(query, c.keywords ?? '') * 0.6, score(query, c.group) * 0.4) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.c)
  }, [commands, query])

  useEffect(() => {
    if (paletteOpen) {
      setQuery('')
      setActive(0)
    }
  }, [paletteOpen])

  useEffect(() => {
    setActive(0)
  }, [query])

  useEffect(() => {
    const node = itemRefs.current[results[active]?.id ?? '']
    node?.scrollIntoView({ block: 'nearest' })
  }, [active, results])

  const grouped = useMemo(() => {
    const map = new Map<string, Command[]>()
    for (const c of results) {
      const list = map.get(c.group) ?? []
      list.push(c)
      map.set(c.group, list)
    }
    return [...map.entries()]
  }, [results])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (i + 1) % Math.max(1, results.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i - 1 + results.length) % Math.max(1, results.length))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const cmd = results[active]
      if (cmd) {
        cmd.run()
        closePalette()
      }
    } else if (e.key === 'Escape') {
      closePalette()
    }
  }

  return (
    <DialogPrimitive.Root open={paletteOpen} onOpenChange={(v) => !v && closePalette()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[hsl(240_10%_2%/0.6)] backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          onKeyDown={onKeyDown}
          className="fixed left-1/2 top-[12%] z-50 w-[min(620px,calc(100vw-24px))] -translate-x-1/2 overflow-hidden rounded-xl border border-line-strong bg-surface-raised shadow-lift data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-150 ease-forge"
        >
          <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
          <div className="flex h-11 items-center gap-2.5 border-b border-line px-3.5">
            <Search className="h-4 w-4 shrink-0 text-fg-subtle" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search commands, problems, agents…"
              className="h-full flex-1 bg-transparent text-md text-fg outline-none placeholder:text-fg-subtle"
            />
            <Kbd>esc</Kbd>
          </div>

          <div ref={listRef} className="max-h-[min(420px,60vh)] overflow-y-auto p-1.5">
            {results.length === 0 && (
              <div className="px-3 py-8 text-center text-base text-fg-subtle">
                No results for “{query}”
              </div>
            )}
            {grouped.map(([group, items]) => (
              <div key={group} className="mb-1 last:mb-0">
                <div className="eyebrow px-2 py-1.5">{group}</div>
                {items.map((cmd) => {
                  const index = results.indexOf(cmd)
                  const isActive = index === active
                  return (
                    <button
                      key={cmd.id}
                      ref={(el) => {
                        itemRefs.current[cmd.id] = el
                      }}
                      type="button"
                      onMouseEnter={() => setActive(index)}
                      onClick={() => {
                        cmd.run()
                        closePalette()
                      }}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors',
                        isActive ? 'bg-[hsl(var(--fg)/0.07)]' : 'hover:bg-[hsl(var(--fg)/0.04)]',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-6 w-6 shrink-0 items-center justify-center rounded-[5px] border border-line bg-surface text-fg-muted',
                          isActive && 'border-line-strong text-fg',
                        )}
                      >
                        {cmd.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-base text-fg">{cmd.label}</span>
                        {cmd.hint && (
                          <span className="block truncate text-xs text-fg-subtle">{cmd.hint}</span>
                        )}
                      </span>
                      {isActive && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-fg-subtle" />}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-line bg-surface-sunken px-3 py-2 text-2xs text-fg-subtle">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd> navigate
              </span>
              <span className="flex items-center gap-1">
                <Kbd>
                  <CornerDownLeft className="h-2.5 w-2.5" />
                </Kbd>
                select
              </span>
            </div>
            <span className="tabular">{results.length} results · {location.pathname}</span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
