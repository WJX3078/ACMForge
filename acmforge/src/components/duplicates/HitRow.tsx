import { motion } from 'framer-motion'
import { ExternalLink } from 'lucide-react'
import { PLATFORM_META } from '@/data/duplicates'
import { cn } from '@/lib/utils'
import type { DuplicateHit } from '@/types'

const THRESHOLD = 0.62

function similarityTone(s: number) {
  if (s >= THRESHOLD) return { bar: 'bg-danger', text: 'text-danger', label: 'Duplicate risk' }
  if (s >= 0.3) return { bar: 'bg-warn', text: 'text-warn', label: 'Worth review' }
  return { bar: 'bg-ok', text: 'text-ok', label: 'Distinct' }
}

export function HitRow({ hit, revealed, index }: { hit: DuplicateHit; revealed: boolean; index: number }) {
  const meta = PLATFORM_META[hit.platform]
  const tone = similarityTone(hit.similarity)
  const pct = Math.round(hit.similarity * 100)

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: revealed ? 1 : 0.25, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
      className="group px-4 py-3"
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'mt-0.5 flex h-6 w-[42px] shrink-0 items-center justify-center rounded-[4px] text-2xs font-semibold',
            meta.chip,
          )}
        >
          {meta.short}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-base font-medium text-fg">{hit.code}</span>
            <span className="truncate text-base text-fg-muted">{hit.title}</span>
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="ml-auto shrink-0 text-fg-subtle opacity-0 transition-opacity group-hover:opacity-100"
              aria-label="Open source"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="mt-1.5 flex items-center gap-2.5">
            {/* similarity rail with the decision threshold marked */}
            <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[hsl(var(--fg)/0.06)]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: revealed ? `${pct}%` : 0 }}
                transition={{ duration: 0.6, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
                className={cn('h-full rounded-full', tone.bar)}
              />
              <span
                className="absolute top-0 bottom-0 w-px bg-danger/60"
                style={{ left: `${THRESHOLD * 100}%` }}
                title="Duplicate threshold 0.62"
              />
            </div>
            <span className={cn('tabular w-9 shrink-0 text-right text-base font-semibold', tone.text)}>
              {pct}%
            </span>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {hit.matchedConcepts.map((c) => (
              <span
                key={c}
                className="rounded-sm bg-[hsl(var(--fg)/0.05)] px-1.5 py-[1px] text-2xs text-fg-muted"
              >
                {c}
              </span>
            ))}
            <span className="ml-auto text-2xs text-fg-subtle">
              {meta.label} · {hit.year} · {hit.difficulty}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
