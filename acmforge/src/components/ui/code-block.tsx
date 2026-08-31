import { Check, Copy, Terminal } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { TOKEN_CLASS, highlightLines } from '@/lib/highlight'
import { cn } from '@/lib/utils'
import { useCopy } from '@/hooks/useCopy'
import { Button } from './button'

export function CodeBlock({
  code,
  filename,
  language = 'C++17',
  showLineNumbers = true,
  maxHeight = 520,
  actions,
  highlight,
  className,
  dense = false,
}: {
  code: string
  filename?: string
  language?: string
  showLineNumbers?: boolean
  maxHeight?: number | string
  actions?: ReactNode
  highlight?: number[]
  className?: string
  dense?: boolean
}) {
  const lines = useMemo(() => highlightLines(code), [code])
  const { copied, copy } = useCopy()
  const gutter = String(lines.length).length

  return (
    <div className={cn('flex min-w-0 flex-col overflow-hidden rounded-lg border border-line bg-surface-sunken', className)}>
      <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-line bg-surface px-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Terminal className="h-3.5 w-3.5 shrink-0 text-fg-subtle" />
          <span className="truncate font-mono text-xs text-fg-muted">
            {filename ?? language}
          </span>
          {filename && (
            <span className="shrink-0 rounded-sm bg-[hsl(var(--fg)/0.06)] px-1.5 py-[1px] text-2xs text-fg-subtle">
              {language}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {actions}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => copy(code)}
            aria-label="Copy code"
            className="text-fg-subtle"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-ok" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
      <div className="overflow-auto" style={{ maxHeight }}>
        <pre
          className={cn(
            'min-w-full py-2 font-mono text-xs',
            dense ? 'leading-[17px]' : 'leading-[19px]',
          )}
        >
          <code className="block">
            {lines.map((tokens, i) => (
              <div
                key={i}
                className={cn(
                  'flex px-2.5',
                  highlight?.includes(i + 1) && 'bg-[hsl(var(--brand)/0.10)]',
                )}
              >
                {showLineNumbers && (
                  <span
                    className="sticky left-0 shrink-0 select-none bg-surface-sunken pr-3 text-right text-fg-subtle/60"
                    style={{ width: `${gutter + 1.6}ch` }}
                  >
                    {i + 1}
                  </span>
                )}
                <span className="min-w-0 whitespace-pre pl-1">
                  {tokens.length === 0 ? (
                    ' '
                  ) : (
                    tokens.map((t, j) => (
                      <span key={j} className={TOKEN_CLASS[t.t]}>
                        {t.v}
                      </span>
                    ))
                  )}
                </span>
              </div>
            ))}
          </code>
        </pre>
      </div>
    </div>
  )
}
