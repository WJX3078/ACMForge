import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, X, XCircle } from 'lucide-react'
import { useUi } from '@/hooks/useUi'
import { cn } from '@/lib/utils'

export function Toaster() {
  const { toasts, dismiss } = useUi()

  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-[70] flex w-[min(340px,calc(100vw-32px))] flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-auto flex items-start gap-2.5 rounded-lg border border-line-strong bg-surface-raised px-3 py-2.5 shadow-lift"
          >
            <span className="mt-0.5 shrink-0">
              {t.kind === 'success' && <CheckCircle2 className="h-4 w-4 text-ok" />}
              {t.kind === 'error' && <XCircle className="h-4 w-4 text-danger" />}
              {t.kind === 'default' && <AlertTriangle className="h-4 w-4 text-info" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-base font-medium text-fg">{t.title}</div>
              {t.description && <div className="mt-0.5 text-sm text-fg-muted">{t.description}</div>}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className={cn('shrink-0 rounded-sm p-0.5 text-fg-subtle transition-colors hover:text-fg')}
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
