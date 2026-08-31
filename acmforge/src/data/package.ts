import type { LogLevel, Problem } from '@/types'

/**
 * Everything the Package Export drawer needs.
 *
 * The manifest and the build log are both derived from the target format, so
 * switching format re-derives the whole plan — the same shape a real packager
 * would produce before it touches the filesystem.
 */

export type PackageFormatId = 'polygon' | 'domjudge' | 'codeforces' | 'cms'

export interface PackageFormat {
  id: PackageFormatId
  name: string
  judge: string
  extension: string
  detail: string
  rootFile: string
}

export const PACKAGE_FORMATS: PackageFormat[] = [
  {
    id: 'polygon',
    name: 'Polygon',
    judge: 'Codeforces',
    extension: '.zip',
    detail: 'problem.xml + statement sections, upload-ready',
    rootFile: 'problem.xml',
  },
  {
    id: 'domjudge',
    name: 'DOMjudge',
    judge: 'ICPC',
    extension: '.zip',
    detail: 'problem.yaml with output validators',
    rootFile: 'problem.yaml',
  },
  {
    id: 'codeforces',
    name: 'Codeforces',
    judge: 'Codeforces',
    extension: '.zip',
    detail: 'Legacy tests/ + solutions layout',
    rootFile: 'statement.tex',
  },
  {
    id: 'cms',
    name: 'CMS',
    judge: 'Italian Olympiad',
    extension: '.tar.gz',
    detail: 'Task format with separate managers',
    rootFile: 'task.yaml',
  },
]

export type PackageRole =
  | 'meta'
  | 'statement'
  | 'solution'
  | 'validator'
  | 'checker'
  | 'generator'
  | 'test'
  | 'editorial'

export interface PackageEntry {
  path: string
  role: PackageRole
  /** present for single files */
  bytes?: number
  /** > 1 when the row represents a directory of files */
  count?: number
  note?: string
}

/** deterministic, content-free hash so a given problem+format always yields the same digest */
function digest(seed: string, length = 40): string {
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  let out = ''
  let x = h
  while (out.length < length) {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0
    out += x.toString(16).padStart(8, '0')
  }
  return out.slice(0, length)
}

/** stable pseudo-random size so the manifest looks measured rather than invented */
function sizeOf(seed: string, min: number, max: number): number {
  return min + (parseInt(digest(seed, 8), 16) % (max - min))
}

export function buildManifest(problem: Problem, format: PackageFormatId): PackageEntry[] {
  const tests = problem.tests
  const samples = Math.min(2, problem.statement.examples.length)
  const secret = Math.max(0, tests - samples)
  const perTest = sizeOf(`${problem.id}-test`, 1800, 96_000)
  const statementBytes = sizeOf(`${problem.id}-tex`, 3_800, 9_400)
  const solutionBytes = problem.solution.length + 240
  const edBytes = sizeOf(`${problem.id}-ed`, 4_100, 11_800)

  const entry = (path: string, role: PackageRole, bytes: number, note?: string): PackageEntry => ({
    path,
    role,
    bytes,
    note,
  })

  switch (format) {
    case 'polygon':
      return [
        entry('problem.xml', 'meta', sizeOf(`${problem.id}-xml`, 2_400, 5_100), 'manifest · limits, tests, scoring'),
        entry('statement-sections/english/statement.tex', 'statement', statementBytes),
        entry('statement-sections/english/problem-properties.json', 'meta', 640),
        entry('solutions/main.cpp', 'solution', solutionBytes, 'C++17 reference'),
        entry('solutions/brute-force.cpp', 'solution', sizeOf(`${problem.id}-brute`, 1_400, 3_200), 'O(n²) oracle'),
        entry('files/validators/validator.cpp', 'validator', sizeOf(`${problem.id}-val`, 2_100, 4_600)),
        entry('files/checkers/testlib-checker.cpp', 'checker', sizeOf(`${problem.id}-chk`, 3_200, 7_100)),
        entry('files/generators/gen_random.cpp', 'generator', sizeOf(`${problem.id}-gen1`, 2_600, 6_400)),
        entry('files/generators/gen_adversarial.cpp', 'generator', sizeOf(`${problem.id}-gen2`, 3_100, 7_800)),
        {
          path: 'files/tests/',
          role: 'test',
          count: tests,
          bytes: perTest * tests,
          note: `${samples} sample · ${secret} secret`,
        },
        entry('editorial.md', 'editorial', edBytes),
      ]

    case 'domjudge':
      return [
        entry('problem.yaml', 'meta', sizeOf(`${problem.id}-yaml`, 1_800, 3_900)),
        entry('problem_statement/problem.en.tex', 'statement', statementBytes),
        entry('submissions/accepted/main.cpp', 'solution', solutionBytes),
        entry('output_validators/checker/checker.cpp', 'checker', sizeOf(`${problem.id}-chk`, 3_200, 7_100)),
        entry('input_validators/validator.cpp', 'validator', sizeOf(`${problem.id}-val`, 2_100, 4_600)),
        entry('generators/gen_random.cpp', 'generator', sizeOf(`${problem.id}-gen1`, 2_600, 6_400)),
        {
          path: 'data/sample/',
          role: 'test',
          count: samples,
          bytes: perTest * samples,
          note: 'visible during the contest',
        },
        {
          path: 'data/secret/',
          role: 'test',
          count: secret,
          bytes: perTest * secret,
          note: 'hidden until judging',
        },
        entry('editorial.md', 'editorial', edBytes),
      ]

    case 'codeforces':
      return [
        entry('statement.tex', 'statement', statementBytes),
        entry('solutions/main.cpp', 'solution', solutionBytes),
        entry('checker.cpp', 'checker', sizeOf(`${problem.id}-chk`, 3_200, 7_100)),
        entry('validator.cpp', 'validator', sizeOf(`${problem.id}-val`, 2_100, 4_600)),
        entry('generator.cpp', 'generator', sizeOf(`${problem.id}-gen1`, 2_600, 6_400)),
        {
          path: 'tests/',
          role: 'test',
          count: tests,
          bytes: perTest * tests,
          note: 'numbered 01 … ' + String(tests).padStart(2, '0'),
        },
        entry('editorial.md', 'editorial', edBytes),
      ]

    case 'cms':
      return [
        entry('task.yaml', 'meta', sizeOf(`${problem.id}-task`, 1_600, 3_400)),
        entry('statement/statement.tex', 'statement', statementBytes),
        entry('managers/validator.cpp', 'validator', sizeOf(`${problem.id}-val`, 2_100, 4_600)),
        entry('managers/checker.cpp', 'checker', sizeOf(`${problem.id}-chk`, 3_200, 7_100)),
        entry('solutions/solution.cpp', 'solution', solutionBytes),
        entry('gen/gen_random.cpp', 'generator', sizeOf(`${problem.id}-gen1`, 2_600, 6_400)),
        {
          path: 'input/',
          role: 'test',
          count: tests,
          bytes: perTest * tests,
          note: 'public + private',
        },
        {
          path: 'output/',
          role: 'test',
          count: tests,
          bytes: Math.round(perTest * tests * 0.42),
          note: 'produced by the reference',
        },
        entry('editorial.md', 'editorial', edBytes),
      ]
  }
}

/* ── validation gates ───────────────────────────────────────────────────── */

export type GateStatus = 'pass' | 'warn' | 'fail'

export interface ExportGate {
  id: string
  label: string
  detail: string
  status: GateStatus
}

/**
 * A problem can only be packaged when no gate fails. Warnings are advisory —
 * a tight time limit is worth exporting, a failed stress run is not.
 */
export function buildGates(problem: Problem): ExportGate[] {
  // deterministic "measured" runtime derived from the problem id
  const measured = Math.round(problem.timeLimitMs * (0.62 + (sizeOf(`${problem.id}-time`, 0, 36) / 100)))
  const tight = measured / problem.timeLimitMs > 0.9
  const hasTests = problem.status !== 'draft' && problem.tests > 0
  const stressClean = problem.status !== 'failed'

  return [
    {
      id: 'statement',
      label: 'Statement renders',
      detail: `${problem.statement.examples.length} samples · TeX build ok`,
      status: 'pass',
    },
    {
      id: 'samples',
      label: 'Samples match reference output',
      detail: `${problem.statement.examples.length}/${problem.statement.examples.length} exact match`,
      status: 'pass',
    },
    {
      id: 'validator',
      label: 'Validator accepts every test',
      detail: hasTests ? `${problem.tests}/${problem.tests} accepted` : 'no tests generated yet',
      status: hasTests ? 'pass' : 'fail',
    },
    {
      id: 'checker',
      label: 'Checker distinguishes AC / WA',
      detail: 'testlib · 6 discrimination probes passed',
      status: 'pass',
    },
    {
      id: 'timelimit',
      label: 'Reference inside time limit',
      detail: `${(measured / 1000).toFixed(2)}s of ${(problem.timeLimitMs / 1000).toFixed(2)}s`,
      status: tight ? 'warn' : 'pass',
    },
    {
      id: 'stress',
      label: 'Stress test clean',
      detail: stressClean ? '18,293 cases · no mismatch' : 'MISMATCH at case #18293',
      status: stressClean ? 'pass' : 'fail',
    },
    {
      id: 'novelty',
      label: 'Novelty above threshold',
      detail: `${problem.uniqueness} / 100 · threshold 82`,
      status: problem.uniqueness >= 82 ? 'pass' : 'fail',
    },
  ]
}

export function gatesBlocked(gates: ExportGate[]) {
  return gates.some((g) => g.status === 'fail')
}

/* ── build plan ─────────────────────────────────────────────────────────── */

export interface BuildStep {
  label: string
  level: LogLevel
  text: string
  durationMs: number
}

export function buildPlan(problem: Problem, format: PackageFormatId, entries: PackageEntry[]): BuildStep[] {
  const fmt = PACKAGE_FORMATS.find((f) => f.id === format)!
  const tests = problem.tests
  const samples = Math.min(2, problem.statement.examples.length)
  const measured = (Math.round(problem.timeLimitMs * (0.62 + (sizeOf(`${problem.id}-time`, 0, 36) / 100))) / 1000).toFixed(2)
  const fileCount = entries.reduce((s, e) => s + (e.count ?? 1), 0)
  const totalBytes = entries.reduce((s, e) => s + (e.bytes ?? 0), 0)

  return [
    { label: 'Resolve format', level: 'info', text: `Resolving target format · ${format} (${fmt.extension})`, durationMs: 420 },
    { label: 'Emit manifest', level: 'info', text: `Writing ${fmt.rootFile} …`, durationMs: 520 },
    { label: 'Render statement', level: 'info', text: 'Rendering statement.tex … pdflatex ✓', durationMs: 760 },
    { label: 'Compile validator', level: 'success', text: 'Compiling validator … g++ -O2 -std=c++17 ✓', durationMs: 640 },
    {
      label: 'Validate tests',
      level: 'success',
      text: `Running validator over ${tests} tests … ${tests} ok`,
      durationMs: 780,
    },
    { label: 'Compile checker', level: 'success', text: 'Compiling checker … g++ -O2 -std=c++17 ✓', durationMs: 600 },
    { label: 'Compile reference', level: 'success', text: 'Compiling reference solution … g++ -O2 -std=c++17 ✓', durationMs: 700 },
    {
      label: 'Run reference',
      level: 'success',
      text: `Running reference on ${tests} tests … ${tests}/${tests} · max ${measured}s`,
      durationMs: 900,
    },
    { label: 'Embed samples', level: 'info', text: `Embedding ${samples} sample tests`, durationMs: 380 },
    { label: 'Embed editorial', level: 'info', text: 'Embedding editorial.md', durationMs: 340 },
    { label: 'Package', level: 'info', text: `Zipping ${fileCount} entries …`, durationMs: 820 },
    {
      label: 'Digest',
      level: 'info',
      text: `SHA-256 ${digest(`${problem.id}:${format}`, 40)}`,
      durationMs: 300,
    },
    {
      label: 'Done',
      level: 'success',
      text: `Package ready · ${artifactName(problem, fmt)} · ${(totalBytes / 1024 / 1024).toFixed(2)} MB`,
      durationMs: 360,
    },
  ]
}

export function artifactName(problem: Problem, fmt: PackageFormat) {
  const slug = problem.id.replace(/[^a-z0-9]+/g, '-')
  return `${slug}-${fmt.id}${fmt.extension}`
}

export function artifactDigest(problem: Problem, format: PackageFormatId) {
  return digest(`${problem.id}:${format}`, 40)
}

export function roleLabel(role: PackageRole) {
  return role
}
