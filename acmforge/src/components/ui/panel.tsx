import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export const Panel = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('panel overflow-hidden', className)} {...props} />
  ),
)
Panel.displayName = 'Panel'

export function PanelHeader({
  title,
  description,
  icon,
  actions,
  className,
  dense = false,
}: {
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  actions?: ReactNode
  className?: string
  dense?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 border-b border-line',
        dense ? 'px-4 py-2' : 'px-4 py-2.5',
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        {icon && <div className="mt-[1px] shrink-0 text-fg-subtle">{icon}</div>}
        <div className="min-w-0">
          <div className="truncate text-md font-semibold tracking-[-0.01em] text-fg">{title}</div>
          {description && <div className="mt-0.5 text-sm text-fg-muted">{description}</div>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
    </div>
  )
}

export function PanelBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4', className)} {...props} />
}

export function PanelFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-center justify-between gap-3 border-t border-line px-4 py-2.5', className)}
      {...props}
    />
  )
}

/** Compact key/value row used across detail panels. */
export function SpecRow({
  label,
  value,
  className,
}: {
  label: ReactNode
  value: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4 py-1', className)}>
      <span className="shrink-0 text-sm text-fg-subtle">{label}</span>
      <span className="leader min-w-0 flex-1 self-center" />
      <span className="tabular shrink-0 text-sm font-medium text-fg">{value}</span>
    </div>
  )
}

export function SectionTitle({
  children,
  hint,
  actions,
  className,
}: {
  children: ReactNode
  hint?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-2.5 flex items-end justify-between gap-4', className)}>
      <div>
        <h2 className="text-md font-semibold tracking-[-0.01em] text-fg">{children}</h2>
        {hint && <p className="mt-0.5 text-sm text-fg-muted">{hint}</p>}
      </div>
      {actions}
    </div>
  )
}
