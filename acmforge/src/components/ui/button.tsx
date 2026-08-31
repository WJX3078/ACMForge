import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-[background-color,border-color,color,box-shadow] duration-150 disabled:pointer-events-none disabled:opacity-45',
  {
    variants: {
      variant: {
        primary:
          'bg-brand text-brand-fg shadow-[inset_0_1px_0_0_hsl(0_0%_100%/0.18)] hover:bg-[hsl(var(--brand)/0.88)] active:bg-[hsl(var(--brand)/0.8)]',
        secondary:
          'border border-line bg-surface-raised text-fg hover:border-line-strong hover:bg-[hsl(var(--fg)/0.06)]',
        ghost: 'text-fg-muted hover:bg-[hsl(var(--fg)/0.06)] hover:text-fg',
        outline: 'border border-line-strong text-fg hover:bg-[hsl(var(--fg)/0.04)]',
        danger: 'bg-danger text-[hsl(0_0%_100%)] hover:bg-[hsl(var(--danger)/0.88)]',
        subtle: 'bg-[hsl(var(--fg)/0.05)] text-fg-muted hover:bg-[hsl(var(--fg)/0.09)] hover:text-fg',
      },
      size: {
        xs: 'h-6 px-2 text-xs',
        sm: 'h-7 px-2.5 text-sm',
        md: 'h-8 px-3 text-base',
        lg: 'h-9 px-4 text-md',
        icon: 'h-8 w-8',
        'icon-sm': 'h-7 w-7',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  },
)
Button.displayName = 'Button'

export { buttonVariants }
