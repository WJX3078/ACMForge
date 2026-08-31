import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/* ── numbers ────────────────────────────────────────────────────────────── */

export function formatNumber(n: number) {
  return new Intl.NumberFormat('en-US').format(Math.round(n))
}

export function formatCompact(n: number) {
  if (n < 1000) return String(Math.round(n))
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
}

export function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

/** 12.4s · 1m 04s · 2h 11m */
export function formatDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`
  return `${s}.${Math.floor((ms % 1000) / 100)}s`
}

/** compact elapsed for inline chips: 4.2s / 1:07 / 12:03 */
export function formatElapsed(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  if (m > 0) return `${m}:${String(s).padStart(2, '0')}`
  return `${s}.${Math.floor((ms % 1000) / 100)}s`
}

export function formatRelative(iso: string, now = Date.now()) {
  const diff = now - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${Math.max(1, s)} sec ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d} d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function formatBytes(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`
}

/* ── domain helpers ─────────────────────────────────────────────────────── */

export type DifficultyToneKey =
  | 'novice'
  | 'easy'
  | 'medium'
  | 'hard'
  | 'expert'
  | 'master'
  | 'legendary'

export function difficultyTone(d: number): DifficultyToneKey {
  if (d < 1200) return 'novice'
  if (d < 1400) return 'easy'
  if (d < 1600) return 'medium'
  if (d < 1900) return 'hard'
  if (d < 2100) return 'expert'
  if (d < 2400) return 'master'
  return 'legendary'
}

/**
 * Codeforces-flavoured rating palette, desaturated for a dark, dense UI.
 * Colour carries the signal; the numeral is always present.
 */
export const difficultyStyles: Record<DifficultyToneKey, { text: string; dot: string; chip: string }> = {
  novice: {
    text: 'text-fg-muted',
    dot: 'bg-fg-subtle',
    chip: 'text-fg-muted bg-fg/[0.06] ring-1 ring-inset ring-line',
  },
  easy: {
    text: 'text-[hsl(152_45%_52%)]',
    dot: 'bg-[hsl(152_45%_52%)]',
    chip: 'text-[hsl(152_50%_58%)] bg-[hsl(152_45%_52%/0.12)] ring-1 ring-inset ring-[hsl(152_45%_52%/0.22)]',
  },
  medium: {
    text: 'text-[hsl(178_55%_52%)]',
    dot: 'bg-[hsl(178_55%_52%)]',
    chip: 'text-[hsl(178_60%_58%)] bg-[hsl(178_55%_52%/0.12)] ring-1 ring-inset ring-[hsl(178_55%_52%/0.22)]',
  },
  hard: {
    text: 'text-[hsl(213_80%_66%)]',
    dot: 'bg-[hsl(213_80%_66%)]',
    chip: 'text-[hsl(213_85%_72%)] bg-[hsl(213_80%_66%/0.12)] ring-1 ring-inset ring-[hsl(213_80%_66%/0.24)]',
  },
  expert: {
    text: 'text-[hsl(262_72%_74%)]',
    dot: 'bg-[hsl(262_72%_74%)]',
    chip: 'text-[hsl(262_78%_78%)] bg-[hsl(262_72%_74%/0.12)] ring-1 ring-inset ring-[hsl(262_72%_74%/0.24)]',
  },
  master: {
    text: 'text-[hsl(32_85%_62%)]',
    dot: 'bg-[hsl(32_85%_62%)]',
    chip: 'text-[hsl(32_90%_66%)] bg-[hsl(32_85%_62%/0.12)] ring-1 ring-inset ring-[hsl(32_85%_62%/0.24)]',
  },
  legendary: {
    text: 'text-[hsl(0_78%_66%)]',
    dot: 'bg-[hsl(0_78%_66%)]',
    chip: 'text-[hsl(0_82%_70%)] bg-[hsl(0_78%_66%/0.12)] ring-1 ring-inset ring-[hsl(0_78%_66%/0.26)]',
  },
}

export const agentStatusStyles: Record<
  'running' | 'thinking' | 'waiting' | 'completed' | 'failed',
  { label: string; text: string; dot: string; chip: string }
> = {
  running: {
    label: 'Running',
    text: 'text-[hsl(var(--brand))]',
    dot: 'bg-[hsl(var(--brand))]',
    chip: 'text-[hsl(var(--brand))] bg-[hsl(var(--brand)/0.12)] ring-1 ring-inset ring-[hsl(var(--brand)/0.28)]',
  },
  thinking: {
    label: 'Thinking',
    text: 'text-think',
    dot: 'bg-think',
    chip: 'text-think bg-think-soft ring-1 ring-inset ring-think/25',
  },
  waiting: {
    label: 'Waiting',
    text: 'text-fg-subtle',
    dot: 'bg-fg-subtle',
    chip: 'text-fg-subtle bg-fg/[0.04] ring-1 ring-inset ring-line',
  },
  completed: {
    label: 'Completed',
    text: 'text-ok',
    dot: 'bg-ok',
    chip: 'text-ok bg-ok-soft ring-1 ring-inset ring-ok/25',
  },
  failed: {
    label: 'Failed',
    text: 'text-danger',
    dot: 'bg-danger',
    chip: 'text-danger bg-danger-soft ring-1 ring-inset ring-danger/25',
  },
}

export const problemStatusStyles: Record<
  'ready' | 'testing' | 'stress-testing' | 'generating' | 'failed' | 'draft',
  { label: string; chip: string; dot: string }
> = {
  ready: { label: 'Ready', chip: 'text-ok bg-ok-soft ring-1 ring-inset ring-ok/25', dot: 'bg-ok' },
  testing: { label: 'Testing', chip: 'text-info bg-info-soft ring-1 ring-inset ring-info/25', dot: 'bg-info' },
  'stress-testing': {
    label: 'Stress Testing',
    chip: 'text-think bg-think-soft ring-1 ring-inset ring-think/25',
    dot: 'bg-think',
  },
  generating: {
    label: 'Generating',
    chip: 'text-[hsl(var(--brand))] bg-[hsl(var(--brand)/0.12)] ring-1 ring-inset ring-[hsl(var(--brand)/0.28)]',
    dot: 'bg-[hsl(var(--brand))]',
  },
  failed: { label: 'Failed', chip: 'text-danger bg-danger-soft ring-1 ring-inset ring-danger/25', dot: 'bg-danger' },
  draft: {
    label: 'Draft',
    chip: 'text-fg-subtle bg-fg/[0.04] ring-1 ring-inset ring-line',
    dot: 'bg-fg-subtle',
  },
}

export function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms))
}

/** Trigger a real file download from in-memory text (used by Package Export). */
export function downloadText(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // give the browser a tick to start the download before revoking
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
