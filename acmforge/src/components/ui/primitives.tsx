import { useEffect, useRef, type HTMLAttributes } from 'react'
import { cn, formatCompact, formatNumber } from '@/lib/utils'
import { useCountUp } from '@/hooks/useCountUp'

/* ── Skeleton ───────────────────────────────────────────────────────────── */

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('relative overflow-hidden rounded-sm bg-[hsl(var(--fg)/0.05)]', className)}
      {...props}
    >
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-[hsl(var(--fg)/0.07)] to-transparent" />
    </div>
  )
}

/* ── Animated number ────────────────────────────────────────────────────── */

export function CountUp({
  value,
  duration = 1200,
  delay = 0,
  compact = false,
  decimals = 0,
  className,
}: {
  value: number
  duration?: number
  delay?: number
  compact?: boolean
  decimals?: number
  className?: string
}) {
  const v = useCountUp(value, duration, delay)
  const text = compact
    ? formatCompact(v)
    : decimals > 0
      ? v.toFixed(decimals)
      : formatNumber(v)
  return <span className={cn('tabular', className)}>{text}</span>
}

/** Live counter that eases toward a changing target (used by the stress bench). */
export function LiveNumber({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const prev = useRef(0)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const from = prev.current
    const to = value
    prev.current = to
    const t0 = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 500)
      node.textContent = Math.round(from + (to - from) * p).toLocaleString('en-US')
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return <span ref={ref} className={cn('tabular', className)} />
}

/* ── Progress bar ───────────────────────────────────────────────────────── */

export function ProgressBar({
  value,
  className,
  tone = 'brand',
}: {
  value: number
  className?: string
  tone?: 'brand' | 'ok' | 'warn' | 'danger' | 'think' | 'muted'
}) {
  const tones: Record<string, string> = {
    brand: 'bg-brand',
    ok: 'bg-ok',
    warn: 'bg-warn',
    danger: 'bg-danger',
    think: 'bg-think',
    muted: 'bg-[hsl(var(--fg)/0.22)]',
  }
  return (
    <div className={cn('h-1 w-full overflow-hidden rounded-full bg-[hsl(var(--fg)/0.07)]', className)}>
      <div
        className={cn('h-full rounded-full transition-[width] duration-200 ease-linear', tones[tone])}
        style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }}
      />
    </div>
  )
}

/* ── Status dot with an optional pulse halo ─────────────────────────────── */

export function StatusDot({
  className,
  pulse = false,
  tone = 'brand',
  size = 7,
}: {
  className?: string
  pulse?: boolean
  tone?: 'brand' | 'ok' | 'warn' | 'danger' | 'think' | 'muted'
  size?: number
}) {
  const tones: Record<string, string> = {
    brand: 'bg-brand',
    ok: 'bg-ok',
    warn: 'bg-warn',
    danger: 'bg-danger',
    think: 'bg-think',
    muted: 'bg-fg-subtle',
  }
  return (
    <span
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      {pulse && (
        <span
          className={cn('absolute inset-0 rounded-full animate-pulse-ring', tones[tone])}
          aria-hidden
        />
      )}
      <span className={cn('relative rounded-full', tones[tone])} style={{ width: size, height: size }} />
    </span>
  )
}

/* ── Keyboard hint ──────────────────────────────────────────────────────── */

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-[19px] min-w-[19px] items-center justify-center rounded-[4px] border border-line bg-surface-raised px-1 font-sans text-2xs font-medium text-fg-muted',
        className,
      )}
    >
      {children}
    </kbd>
  )
}

/* ── Empty state ────────────────────────────────────────────────────────── */

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      {icon && (
        <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface-raised text-fg-subtle">
          {icon}
        </div>
      )}
      <div className="text-md font-medium text-fg">{title}</div>
      {description && <p className="mt-1 max-w-sm text-sm text-fg-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
