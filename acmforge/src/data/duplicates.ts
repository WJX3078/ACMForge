import type { DupSource, DuplicateHit, NoveltyReport } from '@/types'

export const SOURCES: DupSource[] = [
  { id: 'codeforces', name: 'Codeforces', indexed: 92_400, latencyMs: 412, status: 'ok' },
  { id: 'luogu', name: '洛谷', indexed: 58_100, latencyMs: 738, status: 'ok' },
  { id: 'atcoder', name: 'AtCoder', indexed: 31_800, latencyMs: 296, status: 'ok' },
  { id: 'icpc', name: 'ICPC Archive', indexed: 24_600, latencyMs: 1_240, status: 'partial' },
  { id: 'yuanfudao', name: 'Yuantiji', indexed: 6_900, latencyMs: 2_050, status: 'timeout' },
]

export const HITS: DuplicateHit[] = [
  {
    id: 'h1',
    platform: 'luogu',
    code: 'P7412',
    title: 'Bridged Islands',
    similarity: 0.31,
    year: 2021,
    difficulty: 2200,
    matchedConcepts: ['Connectivity over time', 'DSU'],
  },
  {
    id: 'h2',
    platform: 'codeforces',
    code: '1872F',
    title: 'Falling Towers',
    similarity: 0.23,
    year: 2023,
    difficulty: 2100,
    matchedConcepts: ['Offline queries', 'Segment tree'],
  },
  {
    id: 'h3',
    platform: 'atcoder',
    code: 'AGC042E',
    title: 'Domain Isolation',
    similarity: 0.18,
    year: 2020,
    difficulty: 2600,
    matchedConcepts: ['Rollback structures'],
  },
  {
    id: 'h4',
    platform: 'icpc',
    code: 'WF2019-C',
    title: 'Bridges and Tunnels',
    similarity: 0.14,
    year: 2019,
    difficulty: 2800,
    matchedConcepts: ['Graph'],
  },
  {
    id: 'h5',
    platform: 'codeforces',
    code: '1609F',
    title: 'Interesting Sections',
    similarity: 0.11,
    year: 2021,
    difficulty: 2400,
    matchedConcepts: ['Interval decomposition'],
  },
  {
    id: 'h6',
    platform: 'luogu',
    code: 'P9130',
    title: 'Tidal Reach',
    similarity: 0.08,
    year: 2023,
    difficulty: 1500,
    matchedConcepts: ['Union-find'],
  },
]

export const NOVELTY: NoveltyReport = {
  score: 96,
  verdict: 'likely-original',
  scanned: 213_800,
  sources: SOURCES,
  hits: HITS,
}

export const PLATFORM_META: Record<
  string,
  { label: string; short: string; accent: string; chip: string }
> = {
  codeforces: {
    label: 'Codeforces',
    short: 'CF',
    accent: 'text-[hsl(213_80%_66%)]',
    chip: 'bg-[hsl(213_80%_66%/0.12)] text-[hsl(213_85%_74%)] ring-1 ring-inset ring-[hsl(213_80%_66%/0.28)]',
  },
  luogu: {
    label: '洛谷',
    short: 'LG',
    accent: 'text-[hsl(199_89%_60%)]',
    chip: 'bg-[hsl(199_89%_60%/0.12)] text-[hsl(199_89%_66%)] ring-1 ring-inset ring-[hsl(199_89%_60%/0.28)]',
  },
  atcoder: {
    label: 'AtCoder',
    short: 'AT',
    accent: 'text-[hsl(262_72%_76%)]',
    chip: 'bg-[hsl(262_72%_76%/0.12)] text-[hsl(262_78%_80%)] ring-1 ring-inset ring-[hsl(262_72%_76%/0.28)]',
  },
  icpc: {
    label: 'ICPC Archive',
    short: 'ICPC',
    accent: 'text-[hsl(32_85%_64%)]',
    chip: 'bg-[hsl(32_85%_64%/0.12)] text-[hsl(32_90%_68%)] ring-1 ring-inset ring-[hsl(32_85%_64%/0.28)]',
  },
  yuanfudao: {
    label: 'Yuantiji',
    short: 'YT',
    accent: 'text-fg-muted',
    chip: 'bg-fg/[0.06] text-fg-muted ring-1 ring-inset ring-line',
  },
}
