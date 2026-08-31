import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'
import { cn, difficultyStyles, difficultyTone, problemStatusStyles } from '@/lib/utils'
import type { ProblemStatus } from '@/types'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-sm border border-transparent font-medium leading-none w-fit',
  {
    variants: {
      variant: {
        default: 'bg-[hsl(var(--fg)/0.06)] text-fg-muted',
        outline: 'border-line text-fg-muted',
        brand: 'bg-brand-soft text-brand',
        ok: 'bg-ok-soft text-ok',
        warn: 'bg-warn-soft text-warn',
        danger: 'bg-danger-soft text-danger',
        info: 'bg-info-soft text-info',
        think: 'bg-think-soft text-think',
      },
      size: {
        sm: 'h-[18px] px-1.5 text-2xs',
        md: 'h-[21px] px-2 text-xs',
      },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  },
)

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />
}

/** Codeforces-style rating numeral, desaturated to sit inside a dense dark UI. */
export function DifficultyBadge({
  value,
  className,
  showDot = true,
}: {
  value: number
  className?: string
  showDot?: boolean
}) {
  const tone = difficultyStyles[difficultyTone(value)]
  return (
    <span
      className={cn(
        'tabular inline-flex items-center gap-1.5 rounded-sm px-1.5 py-[2px] text-xs font-semibold',
        tone.chip,
        className,
      )}
      title={`Codeforces rating ${value}`}
    >
      {showDot && <span className={cn('h-1.5 w-1.5 rounded-full', tone.dot)} />}
      {value}
    </span>
  )
}

export function StatusBadge({ status, className }: { status: ProblemStatus; className?: string }) {
  const s = problemStatusStyles[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm px-1.5 py-[2px] text-xs font-medium',
        s.chip,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
      {s.label}
    </span>
  )
}
