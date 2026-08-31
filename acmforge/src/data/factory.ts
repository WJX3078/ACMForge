import type { FactoryStepDef } from '@/types'
import type { Counterexample } from '@/types'

/** Ordered stages of a single "Generate" run, with realistic stage costs. */
export const FACTORY_STEPS: FactoryStepDef[] = [
  {
    id: 'discover',
    label: 'Discovering idea',
    detail: 'Scout is mining five archives for an under-explored concept region',
    durationMs: 2600,
    logs: [
      { at: 0.1, level: 'info', text: 'Connecting to 5 sources…' },
      { at: 0.42, level: 'debug', text: '428 problems embedded · k-NN graph built' },
      { at: 0.78, level: 'success', text: "Selected region: 'temporal connectivity' · novelty 0.87" },
    ],
  },
  {
    id: 'design',
    label: 'Designing mathematical model',
    detail: 'Fixing constraints, invariants and the difficulty target',
    durationMs: 3000,
    logs: [
      { at: 0.12, level: 'info', text: 'Model: offline queries over a time-indexed graph' },
      { at: 0.48, level: 'debug', text: 'Constraints n, q ≤ 2·10^5 · TL 2 s' },
      { at: 0.85, level: 'success', text: 'Target rating 2400 ± 100 locked' },
    ],
  },
  {
    id: 'duplicate',
    label: 'Checking duplicates',
    detail: 'Three-stage retrieval against 213k indexed problems',
    durationMs: 2800,
    logs: [
      { at: 0.15, level: 'info', text: 'Searching Codeforces...' },
      { at: 0.4, level: 'info', text: 'Searching Luogu...' },
      { at: 0.62, level: 'info', text: 'Checking Yuantiji...' },
      { at: 0.8, level: 'debug', text: 'Similarity score: 0.31' },
      { at: 0.94, level: 'success', text: 'No duplicate found. Novelty 96 / 100' },
    ],
  },
  {
    id: 'solution',
    label: 'Constructing solution',
    detail: 'Drafting, compiling and benchmarking the reference implementation',
    durationMs: 3600,
    logs: [
      { at: 0.14, level: 'info', text: 'Generating reference solution...' },
      { at: 0.46, level: 'debug', text: 'Approach: rollback DSU over segment tree of time' },
      { at: 0.72, level: 'debug', text: 'g++ -std=c++17 -O2 · 0 warnings' },
      { at: 0.92, level: 'success', text: '68 lines · 0.41 s on the maximum case' },
    ],
  },
  {
    id: 'prove',
    label: 'Proving correctness',
    detail: 'Decomposing into lemmas and discharging each mechanically',
    durationMs: 3000,
    logs: [
      { at: 0.2, level: 'info', text: 'Lemma 1: partition invariant under merge' },
      { at: 0.55, level: 'debug', text: 'Lemma 2: rollback restores the partition' },
      { at: 0.88, level: 'success', text: 'Theorem discharged · 3 / 3 obligations' },
    ],
  },
  {
    id: 'tests',
    label: 'Generating tests',
    detail: 'Sampling the input space under a coverage budget',
    durationMs: 3200,
    logs: [
      { at: 0.18, level: 'debug', text: 'gen_random · gen_chain · gen_adversarial_star' },
      { at: 0.55, level: 'debug', text: '42 / 42 cases written · 11.4 MB' },
      { at: 0.9, level: 'success', text: 'validator: all 42 accepted' },
    ],
  },
  {
    id: 'stress',
    label: 'Stress testing',
    detail: 'Differential testing against a brute force and two candidates',
    durationMs: 4200,
    logs: [
      { at: 0.2, level: 'debug', text: 'Test #18401  n = 199980  ok' },
      { at: 0.48, level: 'debug', text: 'Test #18447  n = 199993  ok' },
      { at: 0.76, level: 'debug', text: 'Test #18492  n = 200000  ok' },
      { at: 0.94, level: 'success', text: '18,492 cases · no divergence' },
    ],
  },
  {
    id: 'editorial',
    label: 'Writing editorial',
    detail: 'Intuition, formal solution, proof, and figures',
    durationMs: 3000,
    logs: [
      { at: 0.22, level: 'debug', text: '§1 Intuition · 186 words' },
      { at: 0.6, level: 'debug', text: '§2 Model · 12 LaTeX blocks' },
      { at: 0.9, level: 'success', text: 'Editorial packaged · 2 figures' },
    ],
  },
]

export const PRESET_PROMPTS = [
  {
    label: 'Offline query on a decaying graph',
    text: 'A graph whose edges exist only during a time interval; answer offline connectivity queries with component sizes.',
  },
  {
    label: 'Bounded-length segment selection',
    text: 'Choose at most k disjoint segments of length in [L, R] maximising the total value of a sequence.',
  },
  {
    label: 'Range add + threshold counting',
    text: 'Maintain an array under range additions and answer how many elements in a range are at least k.',
  },
  {
    label: 'Weighted scheduling with shifting deadlines',
    text: 'Schedule unit jobs with deadlines where accepting a job shifts every later deadline by one.',
  },
  {
    label: 'Convex hull peeling on a lattice',
    text: 'Repeatedly peel the convex hull of a lattice point set and report the peel index of queried points.',
  },
]

/* ── Stress test bench ──────────────────────────────────────────────────── */

export const STRESS_REFERENCE_CPP = `#include <bits/stdc++.h>
using namespace std;

// Reference implementation — rollback DSU over a segment tree of time.
struct RollbackDSU {
    vector<int> p, sz;
    vector<array<int, 3>> hist; // {child, parent, size(parent) before}

    RollbackDSU(int n) : p(n + 1), sz(n + 1, 1) {
        iota(p.begin(), p.end(), 0);
    }
    int find(int x) { return p[x] == x ? x : find(p[x]); }
    int snapshot() const { return (int)hist.size(); }

    void unite(int a, int b) {
        a = find(a); b = find(b);
        if (a == b) return;
        if (sz[a] < sz[b]) swap(a, b);
        hist.push_back({b, a, sz[a]});
        p[b] = a;
        sz[a] += sz[b];
    }

    void rollback(int snap) {
        while ((int)hist.size() > snap) {
            auto h = hist.back();
            hist.pop_back();
            sz[h[1]] = h[2];
            p[h[0]] = h[0];
        }
    }
};

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n, m;
    cin >> n >> m;
    RollbackDSU dsu(n);
    vector<array<int, 2>> ops(m);

    for (int i = 0; i < m; i++) {
        int type;
        cin >> type;
        if (type == 1) {
            int a, b;
            cin >> a >> b;
            dsu.unite(a, b);
            ops[i] = {a, b};
        } else {
            int snap;
            cin >> snap;
            dsu.rollback(snap);
            ops[i] = {-1, snap};
        }
    }

    long long answer = 0;
    for (int i = 1; i <= n; i++)
        if (dsu.p[i] == i) answer += 1LL * dsu.sz[i] * dsu.sz[i];
    cout << answer << '\\n';
    return 0;
}
`

export const STRESS_CANDIDATE_CPP = `#include <bits/stdc++.h>
using namespace std;

// Candidate #2 — same idea, independently generated by solver-v5.
struct RollbackDSU {
    vector<int> p, sz;
    vector<array<int, 3>> hist; // {child, parent, size(parent) before}

    RollbackDSU(int n) : p(n + 1), sz(n + 1, 1) {
        iota(p.begin(), p.end(), 0);
    }
    int find(int x) { return p[x] == x ? x : find(p[x]); }
    int snapshot() const { return (int)hist.size(); }

    void unite(int a, int b) {
        a = find(a); b = find(b);
        if (a == b) return;
        if (sz[a] < sz[b]) swap(a, b);
        hist.push_back({b, a, sz[a]});
        p[b] = a;
        sz[a] += sz[b];
    }

    void rollback(int snap) {
        while ((int)hist.size() > snap) {
            auto h = hist.back();
            hist.pop_back();
            sz[h[0]] = h[2];
            p[h[0]] = h[0];
        }
    }
};

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n, m;
    cin >> n >> m;
    RollbackDSU dsu(n);

    for (int i = 0; i < m; i++) {
        int type;
        cin >> type;
        if (type == 1) {
            int a, b;
            cin >> a >> b;
            dsu.unite(a, b);
        } else {
            int snap;
            cin >> snap;
            dsu.rollback(snap);
        }
    }

    long long answer = 0;
    for (int i = 1; i <= n; i++)
        if (dsu.p[i] == i) answer += 1LL * dsu.sz[i] * dsu.sz[i];
    cout << answer << '\\n';
    return 0;
}
`

export const COUNTEREXAMPLE_FULL: Counterexample = {
  n: 200000,
  input:
    '200000 199999\n' +
    '1 1 2\n'.repeat(0) +
    '1 3 7\n1 19 44\n1 200 199\n2 0\n1 5 91\n1 91 92\n2 1\n1 6 6\n1 44 44\n' +
    '/* … 199,989 further operations … */',
  reference: '127391',
  candidate: '127390',
}

export const COUNTEREXAMPLE_MIN: Counterexample = {
  n: 7,
  input: '7 8\n1 1 2\n1 3 4\n1 5 6\n2 0\n1 2 3\n1 4 5\n2 1\n2 2',
  reference: '13',
  candidate: '15',
}

export const MINIMIZATION_LOG = [
  'Shrinking input space · 200000 → 512 (delta debugging, 14 rounds)',
  'Removing operations that never touch the affected component…',
  'n = 512 → 64 → 23 → 7',
  'Fixpoint reached: removing any further operation makes the mismatch vanish',
]
