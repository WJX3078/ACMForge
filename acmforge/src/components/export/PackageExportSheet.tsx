import {
  AlertTriangle,
  Check,
  Download,
  FileArchive,
  Loader2,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/dialog'
import { ProgressBar } from '@/components/ui/primitives'
import { PACKAGE_FORMATS, type GateStatus, type PackageRole } from '@/data/package'
import { usePackageExport } from '@/hooks/usePackageExport'
import { useUi } from '@/hooks/useUi'
import { cn, downloadText, formatBytes } from '@/lib/utils'
import type { LogLevel, Problem } from '@/types'

const ROLE_STYLE: Record<PackageRole, { dot: string; text: string; label: string }> = {
  meta: { dot: 'bg-fg-subtle', text: 'text-fg-subtle', label: 'meta' },
  statement: { dot: 'bg-info', text: 'text-info', label: 'statement' },
  solution: { dot: 'bg-ok', text: 'text-ok', label: 'solution' },
  validator: { dot: 'bg-warn', text: 'text-warn', label: 'validator' },
  checker: { dot: 'bg-think', text: 'text-think', label: 'checker' },
  generator: { dot: 'bg-brand', text: 'text-brand', label: 'generator' },
  test: { dot: 'bg-[hsl(262_72%_74%)]', text: 'text-[hsl(262_72%_74%)]', label: 'tests' },
  editorial: { dot: 'bg-[hsl(32_85%_62%)]', text: 'text-[hsl(32_85%_62%)]', label: 'editorial' },
}

const LEVEL_TEXT: Record<LogLevel, string> = {
  info: 'text-fg-muted',
  debug: 'text-fg-subtle',
  success: 'text-ok',
  warn: 'text-warn',
  error: 'text-danger',
}

const GATE_ICON = {
  pass: <Check className="h-3 w-3 text-ok" />,
  warn: <AlertTriangle className="h-3 w-3 text-warn" />,
  fail: <XCircle className="h-3 w-3 text-danger" />,
}

function GateRow({
  label,
  detail,
  status,
}: {
  label: string
  detail: string
  status: GateStatus
}) {
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <span className="mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--fg)/0.06)]">
        {GATE_ICON[status]}
      </span>
      <div className="min-w-0 flex-1">
        <div className={cn('text-base', status === 'fail' ? 'text-danger' : 'text-fg')}>{label}</div>
        <div className="text-sm text-fg-subtle">{detail}</div>
      </div>
    </div>
  )
}

function Console({ lines }: { lines: { id: string; text: string; level: LogLevel; at: number }[] }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const node = ref.current
    if (node) node.scrollTop = node.scrollHeight
  }, [lines.length])
  return (
    <div
      ref={ref}
      className="max-h-[188px] min-h-[76px] overflow-y-auto rounded-md border border-line bg-surface-sunken px-3 py-2 font-mono text-xs leading-[18px]"
    >
      {lines.length === 0 && <div className="py-4 text-center text-fg-subtle">Not built yet.</div>}
      {lines.map((l) => (
        <div key={l.id} className="flex animate-log-in gap-2">
          <span className="tabular shrink-0 text-fg-subtle/70">+{(l.at / 1000).toFixed(1)}s</span>
          <span className={cn('min-w-0 break-words', LEVEL_TEXT[l.level])}>{l.text}</span>
        </div>
      ))}
    </div>
  )
}

function manifestText(problem: Problem, fmtName: string, artifactName: string, sha: string, files: number, bytes: number, gates: { label: string; detail: string; status: GateStatus }[], entries: { path: string; role: PackageRole; bytes?: number; count?: number }[], lines: { text: string; at: number }[]) {
  const out: string[] = []
  out.push('# ACMForge package manifest')
  out.push(`problem:  ${problem.title} (${problem.id})`)
  out.push(`format:   ${fmtName}`)
  out.push(`artifact: ${artifactName}`)
  out.push(`files:    ${files}`)
  out.push(`bytes:    ${bytes}`)
  out.push(`sha256:   ${sha}`)
  out.push('')
  out.push('## Validation gates')
  for (const g of gates) out.push(`[${g.status}] ${g.label} — ${g.detail}`)
  out.push('')
  out.push('## Contents')
  for (const e of entries) {
    const size = e.bytes ? formatBytes(e.bytes).padStart(10) : ''.padStart(10)
    const cnt = e.count && e.count > 1 ? ` ×${e.count}` : ''
    out.push(`${size}  ${e.role.padEnd(10)}${e.path}${cnt}`)
  }
  out.push('')
  out.push('## Build log')
  for (const l of lines) out.push(`+${(l.at / 1000).toFixed(1)}s  ${l.text}`)
  out.push('')
  return out.join('\n')
}

export function PackageExportSheet({
  problem,
  open,
  onOpenChange,
}: {
  problem: Problem | undefined
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const { toast } = useUi()
  const exp = usePackageExport(problem)

  // start from a clean slate every time the drawer opens, even for the same problem
  const reset = exp.reset
  useEffect(() => {
    if (open) reset()
  }, [open, reset])

  const passCount = exp.gates.filter((g) => g.status === 'pass').length
  const warnCount = exp.gates.filter((g) => g.status === 'warn').length

  const download = () => {
    if (!problem || !exp.artifact) return
    downloadText(
      exp.artifact.name.replace(/\.(zip|tar\.gz)$/, '') + '-manifest.txt',
      manifestText(problem, exp.fmt.name, exp.artifact.name, exp.artifact.sha256, exp.artifact.files, exp.artifact.bytes, exp.gates, exp.entries, exp.lines),
    )
    toast({ title: 'Manifest downloaded', description: exp.artifact.name, kind: 'success' })
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) exp.reset()
        onOpenChange(v)
      }}
    >
      <SheetContent side="right" width="min(640px,100vw)" className="p-0">
        <SheetHeader
          title={
            <span className="flex items-center gap-2">
              <FileArchive className="h-4 w-4 text-brand" />
              Export package
            </span>
          }
          subtitle={
            <span className="font-mono">
              {problem?.title} · {problem?.difficulty}
            </span>
          }
          badge={
            <Badge variant={exp.phase === 'done' ? 'ok' : 'brand'} size="sm">
              {exp.fmt.name}
              {exp.fmt.extension}
            </Badge>
          }
        />

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {/* ── target format ─────────────────────────────────────────── */}
          <div className="eyebrow mb-2">Target format</div>
          <div className="grid grid-cols-2 gap-2">
            {PACKAGE_FORMATS.map((f) => {
              const on = f.id === exp.format
              return (
                <button
                  key={f.id}
                  type="button"
                  disabled={exp.phase === 'building'}
                  onClick={() => exp.setFormat(f.id)}
                  className={cn(
                    'rounded-md border px-3 py-2 text-left transition-colors duration-150 disabled:opacity-50',
                    on
                      ? 'border-[hsl(var(--brand)/0.5)] bg-brand-soft'
                      : 'border-line bg-surface-raised hover:border-line-strong',
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={cn('text-base font-medium', on ? 'text-fg' : 'text-fg-muted')}>
                      {f.name}
                    </span>
                    <span className="font-mono text-2xs text-fg-subtle">{f.extension}</span>
                    {on && <Check className="ml-auto h-3 w-3 text-brand" />}
                  </div>
                  <div className="mt-0.5 text-2xs text-fg-subtle">{f.judge}</div>
                  <div className="mt-1 text-sm leading-4 text-fg-muted">{f.detail}</div>
                </button>
              )
            })}
          </div>

          {/* ── validation gates ──────────────────────────────────────── */}
          <div className="mt-5 flex items-center gap-2">
            <span className="eyebrow">Validation gates</span>
            <span className="text-2xs text-fg-subtle">
              {passCount} pass
              {warnCount > 0 && ` · ${warnCount} warn`}
            </span>
            {exp.blocked ? (
              <Badge variant="danger" size="sm" className="ml-auto">
                Export blocked
              </Badge>
            ) : (
              <Badge variant="ok" size="sm" className="ml-auto">
                <ShieldCheck className="h-3 w-3" />
                Clear to build
              </Badge>
            )}
          </div>
          <div className="mt-1 divide-y divide-line rounded-md border border-line bg-surface-sunken px-3 py-1">
            {exp.gates.map((g) => (
              <GateRow key={g.id} label={g.label} detail={g.detail} status={g.status} />
            ))}
          </div>

          {/* ── contents ─────────────────────────────────────────────── */}
          <div className="mt-5 flex items-center gap-2">
            <span className="eyebrow">Contents</span>
            <span className="tabular text-2xs text-fg-subtle">
              {exp.fileCount} entries · {formatBytes(exp.totalBytes)}
            </span>
          </div>
          <div className="mt-1 overflow-hidden rounded-md border border-line">
            {exp.entries.map((e, i) => {
              const role = ROLE_STYLE[e.role]
              return (
                <div
                  key={e.path}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-1.5',
                    i > 0 && 'border-t border-line',
                  )}
                >
                  <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', role.dot)} />
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-fg">{e.path}</span>
                  {e.count && e.count > 1 && (
                    <span className="tabular shrink-0 text-2xs text-fg-subtle">×{e.count}</span>
                  )}
                  <span className={cn('w-[68px] shrink-0 text-2xs', role.text)}>{role.label}</span>
                  <span className="tabular w-[64px] shrink-0 text-right text-2xs text-fg-subtle">
                    {e.bytes ? formatBytes(e.bytes) : '—'}
                  </span>
                </div>
              )
            })}
          </div>

          {/* ── build log ────────────────────────────────────────────── */}
          {(exp.phase !== 'idle' || exp.lines.length > 0) && (
            <>
              <div className="mt-5 flex items-center gap-2">
                <span className="eyebrow">Build log</span>
                <span className="tabular text-2xs text-fg-subtle">
                  step {Math.min(exp.stepIndex, exp.plan.length)}/{exp.plan.length}
                </span>
                {exp.phase === 'building' && (
                  <Loader2 className="ml-auto h-3 w-3 animate-spin-slow text-brand" />
                )}
              </div>
              <div className="mt-1">
                <ProgressBar
                  value={exp.plan.length ? exp.stepIndex / exp.plan.length : 0}
                  tone={exp.phase === 'done' ? 'ok' : 'brand'}
                  className="mb-2"
                />
                <Console lines={exp.lines} />
              </div>
            </>
          )}
        </div>

        {/* ── footer ───────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
          {exp.phase === 'done' && exp.artifact ? (
            <>
              <div className="min-w-0">
                <div className="truncate font-mono text-sm text-fg">{exp.artifact.name}</div>
                <div className="tabular truncate text-2xs text-fg-subtle">
                  {formatBytes(exp.artifact.bytes)} · sha256:{exp.artifact.sha256.slice(0, 12)}…
                </div>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <Button variant="ghost" size="sm" onClick={exp.reset}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  Rebuild
                </Button>
                <Button variant="primary" size="sm" onClick={download}>
                  <Download className="h-3.5 w-3.5" />
                  Download manifest
                </Button>
              </div>
            </>
          ) : (
            <>
              <span className="text-sm text-fg-subtle">
                {exp.blocked
                  ? 'Resolve the failing gates before packaging.'
                  : 'Every gate is advisory except a hard failure.'}
              </span>
              <Button
                variant="primary"
                size="sm"
                onClick={exp.build}
                disabled={exp.blocked || exp.phase === 'building'}
              >
                {exp.phase === 'building' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin-slow" />
                ) : (
                  <FileArchive className="h-3.5 w-3.5" />
                )}
                {exp.phase === 'building' ? 'Building…' : 'Build package'}
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
