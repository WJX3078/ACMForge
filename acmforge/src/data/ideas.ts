import type { Idea } from '@/types'

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()

export const ALGORITHM_TAGS = [
  'DP',
  'Graph',
  'Greedy',
  'Math',
  'Data Structure',
  'String',
  'Geometry',
  'Flow',
] as const

export const PROBLEM_STYLES = ['ICPC', 'Codeforces', 'OI', 'Educational'] as const

export const INNOVATION_LEVELS = [
  { id: 'safe', label: 'Safe', hint: 'Stay inside well-understood territory' },
  { id: 'balanced', label: 'Balanced', hint: 'One fresh twist on a known skeleton' },
  { id: 'experimental', label: 'Experimental', hint: 'Allow unfamiliar combinations' },
] as const

export const IDEAS: Idea[] = [
  {
    id: 'idea_1',
    title: 'Tidal bridge connectivity',
    summary:
      'Edges exist only during an interval of time; answer offline connectivity queries. Rollback DSU over a segment tree of time.',
    tags: ['Graph', 'Data Structure'],
    novelty: 96,
    feasibility: 74,
    estDifficulty: 2400,
    source: 'Codeforces archive · cluster #6',
    discoveredAt: ago(3),
    status: 'converted',
  },
  {
    id: 'idea_2',
    title: 'Segmented conveyor valuation',
    summary:
      'Pick at most k disjoint runs with bounded length; the transition admits a sliding-window maximum.',
    tags: ['DP', 'Greedy'],
    novelty: 91,
    feasibility: 88,
    estDifficulty: 1900,
    source: 'Luogu · low-density region',
    discoveredAt: ago(16),
    status: 'converted',
  },
  {
    id: 'idea_3',
    title: 'Threshold counting under range add',
    summary:
      'Interleaved range additions and "how many exceed k" queries force a sqrt-decomposed structure.',
    tags: ['Data Structure'],
    novelty: 98,
    feasibility: 61,
    estDifficulty: 3100,
    source: 'AtCoder · sparse cluster',
    discoveredAt: ago(62),
    status: 'converted',
  },
  {
    id: 'idea_4',
    title: 'Phantom palindromic windows',
    summary:
      'Longest substring convertible to a palindrome within a deletion budget — a textbook interval DP with a twist on the output.',
    tags: ['String', 'DP'],
    novelty: 88,
    feasibility: 92,
    estDifficulty: 1600,
    source: 'ICPC archive · 2021',
    discoveredAt: ago(184),
    status: 'starred',
  },
  {
    id: 'idea_5',
    title: 'Skylight union with weighted glass',
    summary:
      'Union area where each rectangle carries a multiplier; sweep line needs a second accumulator per scanline.',
    tags: ['Geometry'],
    novelty: 93,
    feasibility: 70,
    estDifficulty: 2700,
    source: 'Concept synthesis · agent',
    discoveredAt: ago(302),
    status: 'new',
  },
  {
    id: 'idea_6',
    title: 'Courier with shadow deadlines',
    summary:
      'Deadline scheduling where accepting a job shifts every later deadline — the greedy exchange argument breaks.',
    tags: ['Greedy'],
    novelty: 74,
    feasibility: 45,
    estDifficulty: 2100,
    source: 'Codeforces archive · cluster #11',
    discoveredAt: ago(420),
    status: 'new',
  },
  {
    id: 'idea_7',
    title: 'Residue menagerie',
    summary:
      'Counting pairs by complementary residues, extended to three-term sums with a small modulus.',
    tags: ['Math'],
    novelty: 84,
    feasibility: 95,
    estDifficulty: 1400,
    source: 'Educational set · agent',
    discoveredAt: ago(510),
    status: 'starred',
  },
  {
    id: 'idea_8',
    title: 'Conveyor junction pricing',
    summary:
      'Maximum throughput where cost is piecewise-linear in flow; needs a min-cost flow with convex costs.',
    tags: ['Flow', 'Graph'],
    novelty: 99,
    feasibility: 38,
    estDifficulty: 3300,
    source: 'ICPC archive · unclassified',
    discoveredAt: ago(690),
    status: 'new',
  },
  {
    id: 'idea_9',
    title: 'Echo chambers in a DAG',
    summary:
      'Count vertices reachable through paths whose label sequence is a palindrome — combine DAG DP with Manacher.',
    tags: ['Graph', 'String'],
    novelty: 95,
    feasibility: 52,
    estDifficulty: 2900,
    source: 'Concept synthesis · agent',
    discoveredAt: ago(820),
    status: 'new',
  },
  {
    id: 'idea_10',
    title: 'Lattice orchard pruning',
    summary:
      'Points on a lattice, prune by convex hull peeling; query the layer of a point after k peels.',
    tags: ['Geometry', 'Data Structure'],
    novelty: 90,
    feasibility: 66,
    estDifficulty: 2500,
    source: 'AtCoder · sparse cluster',
    discoveredAt: ago(960),
    status: 'rejected',
  },
  {
    id: 'idea_11',
    title: 'Monotone message queues',
    summary:
      'A queue where the service rate depends on the current backlog — amortised analysis via a potential function.',
    tags: ['Data Structure', 'Greedy'],
    novelty: 87,
    feasibility: 71,
    estDifficulty: 2200,
    source: 'Luogu · cluster #3',
    discoveredAt: ago(1140),
    status: 'new',
  },
  {
    id: 'idea_12',
    title: 'Chromatic cargo routing',
    summary:
      'Route coloured containers so that no two adjacent trucks share a colour; reduces to list-colouring on a path.',
    tags: ['Graph', 'Greedy'],
    novelty: 79,
    feasibility: 84,
    estDifficulty: 1800,
    source: 'Codeforces archive · cluster #2',
    discoveredAt: ago(1380),
    status: 'new',
  },
]

export const IDEA_SOURCE_FILTERS = [
  'All sources',
  'Codeforces archive',
  'Luogu',
  'AtCoder',
  'ICPC archive',
  'Concept synthesis',
]
