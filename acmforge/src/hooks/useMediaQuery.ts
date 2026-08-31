import { useEffect, useState } from 'react'

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  )

  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches)
    setMatches(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/** Breakpoints mirror the ones the layout actually branches on. */
export const useBreakpoints = () => ({
  isDesktop: useMediaQuery('(min-width: 1280px)'),
  isLaptop: useMediaQuery('(min-width: 1024px)'),
  isTablet: useMediaQuery('(min-width: 768px)'),
  isWide: useMediaQuery('(min-width: 1800px)'),
})
