import * as SliderPrimitive from '@radix-ui/react-slider'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import * as SelectPrimitive from '@radix-ui/react-select'
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area'
import { Check, ChevronDown } from 'lucide-react'
import { forwardRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/* ── Tabs ───────────────────────────────────────────────────────────────── */

export const Tabs = TabsPrimitive.Root

export const TabsList = forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'inline-flex h-8 items-center gap-0.5 rounded-md border border-line bg-surface-sunken p-0.5',
      className,
    )}
    {...props}
  />
))
TabsList.displayName = 'TabsList'

export const TabsTrigger = forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex h-7 items-center gap-1.5 rounded-[5px] px-2.5 text-base font-medium text-fg-muted transition-colors',
      'hover:text-fg data-[state=active]:bg-surface-raised data-[state=active]:text-fg data-[state=active]:shadow-panel',
      className,
    )}
    {...props}
  />
))
TabsTrigger.displayName = 'TabsTrigger'

export const TabsContent = forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn('focus-visible:outline-none data-[state=active]:animate-fade-up', className)}
    {...props}
  />
))
TabsContent.displayName = 'TabsContent'

/* ── Slider ─────────────────────────────────────────────────────────────── */

export const Slider = forwardRef<
  HTMLSpanElement,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn('relative flex w-full touch-none select-none items-center', className)}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-[3px] w-full grow overflow-hidden rounded-full bg-[hsl(var(--fg)/0.12)]">
      <SliderPrimitive.Range className="absolute h-full bg-brand" />
    </SliderPrimitive.Track>
    {(props.value ?? props.defaultValue ?? [0]).map((_, i) => (
      <SliderPrimitive.Thumb
        key={i}
        className="block h-3.5 w-3.5 rounded-full border border-brand bg-surface transition-[box-shadow,transform] hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 disabled:pointer-events-none"
      />
    ))}
  </SliderPrimitive.Root>
))
Slider.displayName = 'Slider'

/* ── Switch ─────────────────────────────────────────────────────────────── */

export const Switch = forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      'peer inline-flex h-[18px] w-[32px] shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors',
      'data-[state=checked]:bg-brand data-[state=unchecked]:bg-[hsl(var(--fg)/0.16)] disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb className="pointer-events-none block h-3.5 w-3.5 rounded-full bg-[hsl(0_0%_100%)] shadow-sm transition-transform data-[state=checked]:translate-x-[15px] data-[state=unchecked]:translate-x-[2px]" />
  </SwitchPrimitive.Root>
))
Switch.displayName = 'Switch'

/* ── Segmented control ──────────────────────────────────────────────────── */

export function Segmented<T extends string>({
  value,
  onValueChange,
  options,
  className,
}: {
  value: T
  onValueChange: (v: T) => void
  options: { value: T; label: ReactNode; hint?: string }[]
  className?: string
}) {
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onValueChange(v as T)}
      className={cn('inline-flex h-8 items-center gap-0.5 rounded-md border border-line bg-surface-sunken p-0.5', className)}
    >
      {options.map((o) => (
        <ToggleGroupPrimitive.Item
          key={o.value}
          value={o.value}
          title={o.hint}
          className={cn(
            'inline-flex h-7 items-center justify-center gap-1.5 rounded-[5px] px-2.5 text-base font-medium text-fg-muted transition-colors',
            'hover:text-fg data-[state=on]:bg-surface-raised data-[state=on]:text-fg data-[state=on]:shadow-panel',
          )}
        >
          {o.label}
        </ToggleGroupPrimitive.Item>
      ))}
    </ToggleGroupPrimitive.Root>
  )
}

/* ── Chip multi-select ──────────────────────────────────────────────────── */

export function ChipGroup({
  options,
  selected,
  onToggle,
  className,
}: {
  options: readonly string[]
  selected: string[]
  onToggle: (v: string) => void
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {options.map((o) => {
        const on = selected.includes(o)
        return (
          <button
            key={o}
            type="button"
            onClick={() => onToggle(o)}
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-base transition-all duration-150',
              on
                ? 'border-[hsl(var(--brand)/0.5)] bg-brand-soft text-fg'
                : 'border-line bg-surface-raised text-fg-muted hover:border-line-strong hover:text-fg',
            )}
          >
            {on && <Check className="h-3 w-3 text-brand" />}
            {o}
          </button>
        )
      })}
    </div>
  )
}

/* ── Tooltip ────────────────────────────────────────────────────────────── */

export const TooltipProvider = TooltipPrimitive.Provider

export function Tooltip({
  children,
  content,
  side = 'top',
  delay = 220,
}: {
  children: ReactNode
  content: ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  delay?: number
}) {
  return (
    <TooltipPrimitive.Root delayDuration={delay}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className="z-[60] max-w-[240px] rounded-md border border-line-strong bg-surface-raised px-2 py-1 text-xs text-fg shadow-lift data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95"
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}

/* ── Select ─────────────────────────────────────────────────────────────── */

export const Select = SelectPrimitive.Root
export const SelectValue = SelectPrimitive.Value

export const SelectTrigger = forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex h-8 w-full items-center justify-between gap-2 rounded-md border border-line bg-surface-raised px-2.5 text-base text-fg transition-colors hover:border-line-strong data-[placeholder]:text-fg-subtle',
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-fg-subtle" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = 'SelectTrigger'

export const SelectContent = forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position="popper"
      sideOffset={4}
      className={cn(
        'z-[60] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border border-line-strong bg-surface-raised shadow-lift data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
        className,
      )}
      {...props}
    >
      <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
SelectContent.displayName = 'SelectContent'

export const SelectItem = forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex h-7 cursor-pointer select-none items-center rounded-[4px] pr-2 pl-6 text-base text-fg-muted outline-none data-[highlighted]:bg-[hsl(var(--fg)/0.06)] data-[highlighted]:text-fg data-[state=checked]:text-fg',
      className,
    )}
    {...props}
  >
    <span className="absolute left-1.5 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-3 w-3 text-brand" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = 'SelectItem'

/* ── Scroll area ────────────────────────────────────────────────────────── */

export const ScrollArea = forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> & { viewportClassName?: string }
>(({ className, children, viewportClassName, ...props }, ref) => (
  <ScrollAreaPrimitive.Root ref={ref} className={cn('relative overflow-hidden', className)} {...props}>
    <ScrollAreaPrimitive.Viewport className={cn('h-full w-full', viewportClassName)}>
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollAreaPrimitive.Scrollbar
      orientation="vertical"
      className="flex w-2 touch-none select-none p-0.5 transition-colors"
    >
      <ScrollAreaPrimitive.Thumb className="relative flex-1 rounded-full bg-[hsl(var(--fg)/0.16)]" />
    </ScrollAreaPrimitive.Scrollbar>
  </ScrollAreaPrimitive.Root>
))
ScrollArea.displayName = 'ScrollArea'
