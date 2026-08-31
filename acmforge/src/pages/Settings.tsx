import {
  Blocks,
  Bot,
  Check,
  Cpu,
  Github,
  Keyboard,
  Moon,
  RotateCcw,
  Save,
  ShieldCheck,
  Sliders,
  Sun,
  Trash2,
  Webhook,
} from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '@/components/layout/AppShell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Segmented,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/controls'
import { Field, Input, SettingRow } from '@/components/ui/input'
import { Panel, PanelBody, PanelFooter, PanelHeader, SpecRow } from '@/components/ui/panel'
import { Kbd } from '@/components/ui/primitives'
import { AGENT_DEFS } from '@/data/agents'
import { useTheme } from '@/hooks/useTheme'
import { useUi } from '@/hooks/useUi'
import { cn, formatNumber } from '@/lib/utils'

/* ── local state model ──────────────────────────────────────────────────── */

interface SettingsState {
  org: string
  workspace: string
  defaultModel: string
  defaultStyle: string
  defaultDifficulty: string
  innovation: string
  autoStress: boolean
  autoDuplicate: boolean
  autoEditorial: boolean
  reducedMotion: boolean
  showDock: boolean
  telemetry: boolean
  timeLimit: string
  testsPerRun: string
  maxN: string
  sandboxImage: string
  webhook: string
}

const DEFAULTS: SettingsState = {
  org: 'icpc-lab',
  workspace: 'BJTU · Problem Factory',
  defaultModel: 'hy4-agent',
  defaultStyle: 'codeforces',
  defaultDifficulty: '2100',
  innovation: 'balanced',
  autoStress: true,
  autoDuplicate: true,
  autoEditorial: false,
  reducedMotion: false,
  showDock: true,
  telemetry: true,
  timeLimit: '2000',
  testsPerRun: '64',
  maxN: '200000',
  sandboxImage: 'gcc:13.2-cxx17',
  webhook: 'https://judge.icpc-lab.internal/hooks/acmforge',
}

const MODELS = [
  { value: 'hy4-agent', label: 'HY4 Agent', hint: 'Default reasoning model' },
  { value: 'hy4-agent-fast', label: 'HY4 Agent · Fast', hint: 'Lower latency, leaner proofs' },
  { value: 'hy4-agent-max', label: 'HY4 Agent · Max', hint: 'Longest reasoning budget' },
]

const INTEGRATIONS = [
  { name: 'Codeforces Mirror', detail: 'problem index · 38,412 problems', connected: true },
  { name: 'Luogu Archive', detail: 'problem index · 12,908 problems', connected: true },
  { name: 'AtCoder Archive', detail: 'problem index · 4,271 problems', connected: true },
  { name: 'Polygon', detail: 'package export · read/write', connected: false },
  { name: 'GitHub Actions', detail: 'CI stress runner', connected: true },
]

const SHORTCUTS: { keys: string[]; action: string }[] = [
  { keys: ['⌘', 'K'], action: 'Open command palette' },
  { keys: ['G', 'then', 'D'], action: 'Go to Dashboard' },
  { keys: ['G', 'then', 'F'], action: 'Go to Problem Factory' },
  { keys: ['G', 'then', 'S'], action: 'Go to Stress Test' },
  { keys: ['⌘', '↵'], action: 'Run current pipeline' },
  { keys: ['⌘', 'B'], action: 'Toggle sidebar' },
  { keys: ['Esc'], action: 'Close drawer / palette' },
]

/* ── page ───────────────────────────────────────────────────────────────── */

export default function Settings() {
  const { theme, setTheme } = useTheme()
  const { toast } = useUi()
  const [s, setS] = useState<SettingsState>(DEFAULTS)
  const [dirty, setDirty] = useState(false)

  const patch = <K extends keyof SettingsState>(k: K, v: SettingsState[K]) => {
    setS((prev) => ({ ...prev, [k]: v }))
    setDirty(true)
  }

  const save = () => {
    setDirty(false)
    toast({ title: 'Settings saved', description: 'Applied to this workspace session.', kind: 'success' })
  }

  const reset = () => {
    setS(DEFAULTS)
    setDirty(false)
    toast({ title: 'Reset to defaults', kind: 'default' })
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Settings"
        description="Workspace defaults for the agent pipeline, judge environment and integrations."
        actions={
          <>
            <Button variant="ghost" size="md" onClick={reset}>
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
            <Button variant="primary" size="md" onClick={save} disabled={!dirty}>
              <Save className="h-3.5 w-3.5" />
              Save changes
            </Button>
          </>
        }
      />

      <Tabs defaultValue="workspace" className="space-y-4">
        <TabsList>
          <TabsTrigger value="workspace">
            <Sliders className="h-3.5 w-3.5" />
            Workspace
          </TabsTrigger>
          <TabsTrigger value="agents">
            <Bot className="h-3.5 w-3.5" />
            Agents
          </TabsTrigger>
          <TabsTrigger value="judge">
            <Cpu className="h-3.5 w-3.5" />
            Judge
          </TabsTrigger>
          <TabsTrigger value="integrations">
            <Webhook className="h-3.5 w-3.5" />
            Integrations
          </TabsTrigger>
          <TabsTrigger value="shortcuts">
            <Keyboard className="h-3.5 w-3.5" />
            Shortcuts
          </TabsTrigger>
        </TabsList>

        {/* ── Workspace ─────────────────────────────────────────────────── */}
        <TabsContent value="workspace" className="grid gap-4 xl:grid-cols-2">
          <Panel>
            <PanelHeader
              icon={<Blocks className="h-4 w-4" />}
              title="Workspace"
              description="Identifies where generated packages are stored."
            />
            <PanelBody className="space-y-4">
              <Field label="Organization" htmlFor="org" description="Used as the namespace for exported packages.">
                <Input id="org" value={s.org} onChange={(e) => patch('org', e.target.value)} />
              </Field>
              <Field label="Workspace name" htmlFor="ws">
                <Input id="ws" value={s.workspace} onChange={(e) => patch('workspace', e.target.value)} />
              </Field>
              <Field label="Webhook endpoint" htmlFor="hook" description="Receives pipeline completion events.">
                <Input id="hook" className="font-mono text-sm" value={s.webhook} onChange={(e) => patch('webhook', e.target.value)} />
              </Field>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader
              icon={<Sun className="h-4 w-4" />}
              title="Appearance"
              description="Dark is the product default; light is a full parity theme."
            />
            <PanelBody className="space-y-3">
              <SettingRow
                title="Theme"
                description="Applies instantly and persists in local storage."
                control={
                  <Segmented
                    value={theme}
                    onValueChange={(v) => setTheme(v as 'dark' | 'light')}
                    options={[
                      { value: 'dark', label: <span className="inline-flex items-center gap-1.5"><Moon className="h-3.5 w-3.5" />Dark</span> },
                      { value: 'light', label: <span className="inline-flex items-center gap-1.5"><Sun className="h-3.5 w-3.5" />Light</span> },
                    ]}
                  />
                }
              />
              <SettingRow
                title="Reduce motion"
                description="Tones down pulse and transition animations."
                control={<Switch checked={s.reducedMotion} onCheckedChange={(v) => patch('reducedMotion', v)} />}
              />
              <SettingRow
                title="Agent activity dock"
                description="Show the floating pipeline monitor on the right."
                control={<Switch checked={s.showDock} onCheckedChange={(v) => patch('showDock', v)} />}
              />
              <SettingRow
                title="Anonymous telemetry"
                description="Sends pipeline latency samples only. No problem content."
                control={<Switch checked={s.telemetry} onCheckedChange={(v) => patch('telemetry', v)} />}
              />
            </PanelBody>
          </Panel>

          <Panel className="xl:col-span-2">
            <PanelHeader
              icon={<ShieldCheck className="h-4 w-4" />}
              title="Session"
              description="Runtime information for this prototype build."
            />
            <PanelBody className="grid gap-x-10 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
              <SpecRow label="Build" value="0.9.4 · prototype" />
              <SpecRow label="Data source" value="mock · in-memory" />
              <SpecRow label="Router" value="hash" />
              <SpecRow label="Problems in library" value={formatNumber(128)} />
              <SpecRow label="Agents registered" value={`${AGENT_DEFS.length}`} />
              <SpecRow label="Package export" value="polygon · zip" />
            </PanelBody>
          </Panel>
        </TabsContent>

        {/* ── Agents ────────────────────────────────────────────────────── */}
        <TabsContent value="agents" className="grid gap-4 xl:grid-cols-2">
          <Panel>
            <PanelHeader
              icon={<Bot className="h-4 w-4" />}
              title="Model & defaults"
              description="Applied when a new pipeline run starts."
            />
            <PanelBody className="space-y-4">
              <Field label="Reasoning model" htmlFor="model">
                <Select value={s.defaultModel} onValueChange={(v) => patch('defaultModel', v)}>
                  <SelectTrigger id="model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODELS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Problem style">
                <Segmented
                  value={s.defaultStyle}
                  onValueChange={(v) => patch('defaultStyle', v)}
                  options={[
                    { value: 'icpc', label: 'ICPC' },
                    { value: 'codeforces', label: 'Codeforces' },
                    { value: 'oi', label: 'OI' },
                    { value: 'educational', label: 'Educational' },
                  ]}
                />
              </Field>
              <Field label="Innovation bias" description="Safe stays close to known patterns; Experimental explores unusual models.">
                <Segmented
                  value={s.innovation}
                  onValueChange={(v) => patch('innovation', v)}
                  options={[
                    { value: 'safe', label: 'Safe' },
                    { value: 'balanced', label: 'Balanced' },
                    { value: 'experimental', label: 'Experimental' },
                  ]}
                />
              </Field>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader
              icon={<Blocks className="h-4 w-4" />}
              title="Pipeline automation"
              description="Stages that run without manual confirmation."
            />
            <PanelBody className="space-y-1">
              <SettingRow
                title="Auto duplicate check"
                description="Runs the similarity sweep before solution generation."
                control={<Switch checked={s.autoDuplicate} onCheckedChange={(v) => patch('autoDuplicate', v)} />}
              />
              <SettingRow
                title="Auto stress test"
                description="Runs 10k randomized cases against the reference solution."
                control={<Switch checked={s.autoStress} onCheckedChange={(v) => patch('autoStress', v)} />}
              />
              <SettingRow
                title="Auto editorial"
                description="Drafts the write-up immediately after validation passes."
                control={<Switch checked={s.autoEditorial} onCheckedChange={(v) => patch('autoEditorial', v)} />}
              />
              <SettingRow
                title="Default difficulty"
                description="Starting point for the difficulty slider."
                control={
                  <Input
                    className="w-[92px] tabular"
                    inputMode="numeric"
                    value={s.defaultDifficulty}
                    onChange={(e) => patch('defaultDifficulty', e.target.value.replace(/\D/g, '').slice(0, 4))}
                  />
                }
              />
            </PanelBody>
          </Panel>

          <Panel className="xl:col-span-2">
            <PanelHeader
              icon={<Bot className="h-4 w-4" />}
              title="Registered agents"
              description={`${AGENT_DEFS.length} agents in the active pipeline. Order defines execution.`}
            />
            <PanelBody className="p-0">
              <div className="divide-y divide-line">
                {AGENT_DEFS.map((a, i) => {
                  const Icon = a.icon
                  return (
                    <div key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="tabular w-5 shrink-0 text-sm text-fg-subtle">{i + 1}</span>
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-line bg-surface-sunken text-fg-muted">
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-base font-medium text-fg">{a.name}</div>
                        <div className="truncate font-mono text-2xs text-fg-subtle">
                          {a.codename} · {a.role}
                        </div>
                      </div>
                      <Badge variant="outline" size="sm" className="tabular shrink-0">
                        {a.steps.length} steps
                      </Badge>
                      <Switch defaultChecked className="shrink-0" />
                    </div>
                  )
                })}
              </div>
            </PanelBody>
            <PanelFooter>
              <span className="text-sm text-fg-subtle">Disabled agents are skipped and their output is inherited upstream.</span>
              <Button variant="ghost" size="sm" onClick={() => toast({ title: 'Agent order saved' })}>
                Apply order
              </Button>
            </PanelFooter>
          </Panel>
        </TabsContent>

        {/* ── Judge ─────────────────────────────────────────────────────── */}
        <TabsContent value="judge" className="grid gap-4 xl:grid-cols-2">
          <Panel>
            <PanelHeader
              icon={<Cpu className="h-4 w-4" />}
              title="Execution limits"
              description="Defaults used by the validator and stress runner."
            />
            <PanelBody className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Time limit (ms)" htmlFor="tl">
                  <Input id="tl" className="tabular" inputMode="numeric" value={s.timeLimit} onChange={(e) => patch('timeLimit', e.target.value.replace(/\D/g, ''))} />
                </Field>
                <Field label="Max n" htmlFor="mn">
                  <Input id="mn" className="tabular" inputMode="numeric" value={s.maxN} onChange={(e) => patch('maxN', e.target.value.replace(/\D/g, ''))} />
                </Field>
              </div>
              <Field label="Tests per run" htmlFor="tpr" description="Number of generated cases before stress testing.">
                <Input id="tpr" className="tabular" inputMode="numeric" value={s.testsPerRun} onChange={(e) => patch('testsPerRun', e.target.value.replace(/\D/g, ''))} />
              </Field>
              <Field label="Sandbox image" htmlFor="img">
                <Select value={s.sandboxImage} onValueChange={(v) => patch('sandboxImage', v)}>
                  <SelectTrigger id="img">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gcc:13.2-cxx17">gcc:13.2 · C++17</SelectItem>
                    <SelectItem value="gcc:13.2-cxx20">gcc:13.2 · C++20</SelectItem>
                    <SelectItem value="clang:18-cxx17">clang:18 · C++17</SelectItem>
                    <SelectItem value="python:3.12-pypy">PyPy 3.10 · 7.3</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader
              icon={<ShieldCheck className="h-4 w-4" />}
              title="Validation gates"
              description="A package cannot be exported until every enabled gate passes."
            />
            <PanelBody className="space-y-1">
              <SettingRow
                title="Multiple valid answers"
                description="Use a special judge instead of exact token comparison."
                control={<Switch defaultChecked />}
              />
              <SettingRow
                title="Strict whitespace"
                description="Fail on trailing spaces and missing final newline."
                control={<Switch />}
              />
              <SettingRow
                title="Deterministic generators"
                description="Seed every generator so a run can be reproduced."
                control={<Switch defaultChecked />}
              />
              <SettingRow
                title="Reject weak tests"
                description="Require brute-force disagreement coverage on small cases."
                control={<Switch defaultChecked />}
              />
            </PanelBody>
            <PanelFooter>
              <span className="text-sm text-fg-subtle">Changes apply to the next run.</span>
              <Button variant="secondary" size="sm" onClick={() => toast({ title: 'Gates updated', kind: 'success' })}>
                Verify gates
              </Button>
            </PanelFooter>
          </Panel>
        </TabsContent>

        {/* ── Integrations ──────────────────────────────────────────────── */}
        <TabsContent value="integrations" className="grid gap-4 xl:grid-cols-2">
          <Panel className="xl:col-span-2">
            <PanelHeader
              icon={<Webhook className="h-4 w-4" />}
              title="Connected services"
              description="Search indexes and export targets available to the agents."
            />
            <PanelBody className="p-0">
              <div className="divide-y divide-line">
                {INTEGRATIONS.map((it) => (
                  <div key={it.name} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-base font-medium text-fg">{it.name}</span>
                        {it.connected ? (
                          <Badge variant="ok" size="sm">
                            <Check className="h-3 w-3" />
                            Connected
                          </Badge>
                        ) : (
                          <Badge variant="outline" size="sm">
                            Not connected
                          </Badge>
                        )}
                      </div>
                      <div className="mt-0.5 truncate font-mono text-2xs text-fg-subtle">{it.detail}</div>
                    </div>
                    <Button
                      variant={it.connected ? 'ghost' : 'secondary'}
                      size="sm"
                      className="shrink-0"
                      onClick={() =>
                        toast({
                          title: it.connected ? `${it.name} disconnected` : `${it.name} connected`,
                          kind: it.connected ? 'default' : 'success',
                        })
                      }
                    >
                      {it.connected ? 'Disconnect' : 'Connect'}
                    </Button>
                  </div>
                ))}
              </div>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader icon={<Github className="h-4 w-4" />} title="Repository" description="Source of truth for exported packages." />
            <PanelBody className="space-y-3">
              <Field label="Remote" htmlFor="remote">
                <Input id="remote" className="font-mono text-sm" defaultValue="git@github.com:icpc-lab/problems.git" />
              </Field>
              <Field label="Branch" htmlFor="branch">
                <Input id="branch" className="font-mono text-sm" defaultValue="main" />
              </Field>
            </PanelBody>
            <PanelFooter>
              <span className="text-sm text-fg-subtle">Auto-commit on export</span>
              <Switch defaultChecked />
            </PanelFooter>
          </Panel>

          <Panel>
            <PanelHeader icon={<Trash2 className="h-4 w-4" />} title="Danger zone" description="Destructive actions cannot be undone." />
            <PanelBody className="space-y-1">
              <SettingRow
                title="Clear run history"
                description="Removes all pipeline logs from this session."
                control={
                  <Button variant="outline" size="sm" onClick={() => toast({ title: 'Run history cleared', kind: 'default' })}>
                    Clear
                  </Button>
                }
              />
              <SettingRow
                title="Purge local cache"
                description="Drops cached problem indexes and re-syncs on next search."
                control={
                  <Button variant="danger" size="sm" onClick={() => toast({ title: 'Cache purged', kind: 'error' })}>
                    Purge
                  </Button>
                }
              />
            </PanelBody>
          </Panel>
        </TabsContent>

        {/* ── Shortcuts ─────────────────────────────────────────────────── */}
        <TabsContent value="shortcuts">
          <Panel>
            <PanelHeader
              icon={<Keyboard className="h-4 w-4" />}
              title="Keyboard shortcuts"
              description="The command palette is the fastest way to move around."
            />
            <PanelBody className="p-0">
              <div className="divide-y divide-line">
                {SHORTCUTS.map((sc) => (
                  <div key={sc.action} className="flex items-center justify-between gap-6 px-4 py-2.5">
                    <span className="text-base text-fg">{sc.action}</span>
                    <span className={cn('flex shrink-0 items-center gap-1')}>
                      {sc.keys.map((k, i) => (
                        <span key={`${k}-${i}`} className="flex items-center gap-1">
                          {k === 'then' ? (
                            <span className="text-2xs text-fg-subtle">then</span>
                          ) : (
                            <Kbd>{k}</Kbd>
                          )}
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </PanelBody>
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  )
}
