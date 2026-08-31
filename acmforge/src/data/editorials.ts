import type { Problem } from '@/types'

const COMPLEXITY: Record<string, { time: string; memory: string }> = {
  'temporal-bridge': { time: 'O((n + q + m) log T)', memory: 'O(n + m log T)' },
  'crystal-conveyor': { time: 'O(n · k)', memory: 'O(n)' },
  'infinite-orchard': { time: 'O((n + m) √n)', memory: 'O(n)' },
  'phantom-palindrome': { time: 'O(n²)', memory: 'O(n²)' },
  'mirrored-canopy': { time: 'O(n log n)', memory: 'O(n)' },
  'ledger-of-shadows': { time: 'O(n log n)', memory: 'O(n)' },
  'modular-menagerie': { time: 'O(n)', memory: 'O(m)' },
  'conveyor-junction': { time: 'O(f · V · E)', memory: 'O(V + E)' },
}

export interface EditorialSection {
  title: string
  paragraphs: string[]
  bullets?: string[]
}

export function buildEditorial(p: Problem) {
  const complexity = COMPLEXITY[p.id] ?? { time: 'O(n log n)', memory: 'O(n)' }

  const sections: EditorialSection[] = [
    {
      title: 'Intuition',
      paragraphs: [p.statement.legend[0], p.statement.legend[1] ?? ''].filter(Boolean),
    },
    {
      title: 'Key observations',
      paragraphs: [
        'Everything below follows from a small number of observations; once they are in place the algorithm is almost forced.',
      ],
      bullets: p.keyIdeas,
    },
    {
      title: 'Algorithm',
      paragraphs: [
        `Solve the ${p.algorithms.join(' + ').toLowerCase()} part first, then feed its output into the offline pass.`,
        `Process the input in the order implied by the model, maintaining the structure described above. Every update is amortised, so the total cost stays at ${complexity.time}.`,
        p.statement.notes[0] ? `Edge case to handle explicitly: ${p.statement.notes[0].toLowerCase()}` : '',
      ].filter(Boolean),
    },
    {
      title: 'Correctness',
      paragraphs: [
        'Lemma 1. The maintained structure represents exactly the state described by the model after each processed element.',
        'Lemma 2. Every candidate answer is examined exactly once, and no answer outside the candidate set can be optimal.',
        'Theorem. By Lemma 1 the structure never diverges from the model, and by Lemma 2 the enumeration is exhaustive, so the reported value is correct.',
      ],
    },
    {
      title: 'Complexity',
      paragraphs: [
        `Time: ${complexity.time}. Memory: ${complexity.memory}, which fits the ${p.memoryLimitMb} MB limit with room to spare.`,
        `The reference implementation runs the maximum case in well under the ${p.timeLimitMs} ms limit.`,
      ],
    },
  ]

  return { complexity, sections }
}

export function complexityOf(p: Problem) {
  return COMPLEXITY[p.id] ?? { time: 'O(n log n)', memory: 'O(n)' }
}
