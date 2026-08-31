import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { uid } from '@/lib/utils'

export type ToastKind = 'default' | 'success' | 'error'

export interface Toast {
  id: string
  title: string
  description?: string
  kind: ToastKind
}

interface UiValue {
  paletteOpen: boolean
  openPalette: () => void
  closePalette: () => void
  togglePalette: () => void
  toasts: Toast[]
  toast: (t: Omit<Toast, 'id' | 'kind'> & { kind?: ToastKind }) => void
  dismiss: (id: string) => void
}

const UiContext = createContext<UiValue | null>(null)

export function UiProvider({ children }: { children: ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<Record<string, number>>({})

  const dismiss = useCallback((id: string) => {
    setToasts((list) => list.filter((t) => t.id !== id))
    window.clearTimeout(timers.current[id])
    delete timers.current[id]
  }, [])

  const toast = useCallback<UiValue['toast']>(
    ({ title, description, kind = 'default' }) => {
      const id = uid('toast')
      setToasts((list) => [...list.slice(-2), { id, title, description, kind }])
      timers.current[id] = window.setTimeout(() => dismiss(id), 4200)
    },
    [dismiss],
  )

  useEffect(() => {
    const map = timers.current
    return () => {
      Object.values(map).forEach((t) => window.clearTimeout(t))
    }
  }, [])

  // ⌘K / Ctrl+K anywhere in the app
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const value = useMemo<UiValue>(
    () => ({
      paletteOpen,
      openPalette: () => setPaletteOpen(true),
      closePalette: () => setPaletteOpen(false),
      togglePalette: () => setPaletteOpen((v) => !v),
      toasts,
      toast,
      dismiss,
    }),
    [paletteOpen, toasts, toast, dismiss],
  )

  return <UiContext.Provider value={value}>{children}</UiContext.Provider>
}

export function useUi() {
  const ctx = useContext(UiContext)
  if (!ctx) throw new Error('useUi must be used inside <UiProvider>')
  return ctx
}
