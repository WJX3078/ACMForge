import { Skeleton } from '@/components/ui/primitives'

/**
 * Suspense fallback for lazily-loaded routes. Mirrors the real page skeleton
 * (title row, hero, stat cards, table) so the swap to real content does not
 * shift layout.
 */
export function PageFallback() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading page">
      <div className="flex items-center gap-3">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-5 w-20" />
      </div>
      <Skeleton className="h-28 w-full" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[76px]" />
        ))}
      </div>
      <Skeleton className="h-72 w-full" />
    </div>
  )
}
