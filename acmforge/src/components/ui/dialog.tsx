import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { forwardRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close
export const DialogTitle = DialogPrimitive.Title
export const DialogDescription = DialogPrimitive.Description

const overlayClass =
  'fixed inset-0 z-50 bg-[hsl(240_10%_2%/0.62)] backdrop-blur-[1.5px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'

export const DialogOverlay = DialogPrimitive.Overlay

export const DialogContent = forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { hideClose?: boolean }
>(({ className, children, hideClose, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className={overlayClass} />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-1/2 top-[18%] z-50 w-[min(640px,calc(100vw-32px))] -translate-x-1/2 rounded-xl border border-line-strong bg-surface-raised shadow-lift',
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-200 ease-forge',
        className,
      )}
      {...props}
    >
      {children}
      {!hideClose && (
        <DialogPrimitive.Close
          className="absolute right-3 top-3 rounded-sm p-1 text-fg-subtle transition-colors hover:bg-[hsl(var(--fg)/0.06)] hover:text-fg"
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5" />
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
))
DialogContent.displayName = 'DialogContent'

/* ── Sheet (side drawer) ────────────────────────────────────────────────── */

const sheetSides = {
  right:
    'inset-y-0 right-0 h-full w-[min(560px,100vw)] border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
  left: 'inset-y-0 left-0 h-full w-[min(480px,100vw)] border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left',
  bottom:
    'inset-x-0 bottom-0 max-h-[85vh] w-full rounded-t-xl border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
}

export const Sheet = DialogPrimitive.Root
export const SheetTrigger = DialogPrimitive.Trigger
export const SheetClose = DialogPrimitive.Close
export const SheetTitle = DialogPrimitive.Title
export const SheetDescription = DialogPrimitive.Description

export const SheetContent = forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    side?: keyof typeof sheetSides
    hideClose?: boolean
    width?: string
  }
>(({ className, children, side = 'right', hideClose, width, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className={overlayClass} />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed z-50 flex flex-col border-line-strong bg-surface shadow-lift',
        'data-[state=open]:animate-in data-[state=closed]:animate-out duration-300 ease-forge',
        sheetSides[side],
        className,
      )}
      style={width ? { width } : undefined}
      {...props}
    >
      {children}
      {!hideClose && (
        <DialogPrimitive.Close
          className="absolute right-3.5 top-3.5 rounded-sm p-1 text-fg-subtle transition-colors hover:bg-[hsl(var(--fg)/0.06)] hover:text-fg"
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5" />
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
))
SheetContent.displayName = 'SheetContent'

export function SheetHeader({
  title,
  subtitle,
  badge,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  badge?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 border-b border-line px-5 py-3.5', className)}>
      <div className="min-w-0">
        <DialogPrimitive.Title className="truncate text-lg font-semibold tracking-[-0.015em] text-fg">
          {title}
        </DialogPrimitive.Title>
        {subtitle && (
          <DialogPrimitive.Description className="mt-0.5 text-sm text-fg-muted">
            {subtitle}
          </DialogPrimitive.Description>
        )}
      </div>
      {badge && <div className="shrink-0 pt-0.5">{badge}</div>}
    </div>
  )
}
