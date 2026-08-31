import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Copy `text` via the async Clipboard API, falling back to a hidden textarea
 * when it is unavailable *or* when it rejects (blocked by permissions policy,
 * insecure context, or a non-user-gesture call).
 */
function legacyCopy(text: string): boolean {
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    ta.setAttribute('readonly', '')
    document.body.appendChild(ta)
    ta.select()
    ta.setSelectionRange(0, text.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

async function writeText(text: string): Promise<boolean> {
  // The API can exist yet still reject (e.g. headless / permission denied),
  // so a rejection must fall through to the legacy path instead of aborting.
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through */
  }
  return legacyCopy(text)
}

/** Clipboard write with a short-lived "copied" flag. */
export function useCopy(timeout = 1600) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number>()

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const copy = useCallback(
    async (text: string) => {
      const ok = await writeText(text)
      if (!ok) return false
      setCopied(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), timeout)
      return true
    },
    [timeout],
  )

  return { copied, copy }
}
