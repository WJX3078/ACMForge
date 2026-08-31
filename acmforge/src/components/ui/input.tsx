import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-8 w-full rounded-md border border-line bg-surface-raised px-2.5 text-base text-fg transition-colors',
        'placeholder:text-fg-subtle hover:border-line-strong focus-visible:border-[hsl(var(--brand)/0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand)/0.22)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'w-full rounded-md border border-line bg-surface-raised px-2.5 py-2 text-base leading-6 text-fg transition-colors',
        'placeholder:text-fg-subtle hover:border-line-strong focus-visible:border-[hsl(var(--brand)/0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand)/0.22)]',
        className,
      )}
      {...props}
    />
  ),
)
Textarea.displayName = 'Textarea'

/** Label + description + control, stacked. Used by forms and settings. */
export function Field({
  label,
  description,
  htmlFor,
  children,
  className,
}: {
  label: ReactNode
  description?: ReactNode
  htmlFor?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="block text-base font-medium text-fg">
        {label}
      </label>
      {children}
      {description && <p className="text-sm leading-5 text-fg-subtle">{description}</p>}
    </div>
  )
}

/** One settings row: text on the left, control on the right. */
export function SettingRow({
  title,
  description,
  control,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  control: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-start justify-between gap-6 border-b border-line py-3 last:border-b-0', className)}>
      <div className="min-w-0 flex-1">
        <div className="text-base font-medium text-fg">{title}</div>
        {description && <p className="mt-0.5 max-w-xl text-sm leading-5 text-fg-muted">{description}</p>}
      </div>
      <div className="flex shrink-0 items-center pt-0.5">{control}</div>
    </div>
  )
}
