import { useEffect, useRef, useState } from 'react'

const prefersReduced = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Eased count-up. Returns a float; round/format it at the call site. */
export function useCountUp(target: number, duration = 1200, delay = 0) {
  const [value, setValue] = useState(0)
  const raf = useRef<number>()

  useEffect(() => {
    if (prefersReduced()) {
      setValue(target)
      return
    }
    let startedAt = 0
    const deadline = performance.now() + delay
    const tick = (now: number) => {
      if (now < deadline) {
        raf.current = requestAnimationFrame(tick)
        return
      }
      if (!startedAt) startedAt = now
      const p = Math.min(1, (now - startedAt) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(target * eased)
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current)
    }
  }, [target, duration, delay])

  return value
}
