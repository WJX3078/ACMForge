import type { Problem, Submission, TestFile } from '@/types'

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()

/* ── Reference solutions ────────────────────────────────────────────────── */

const TEMPORAL_BRIDGE_CPP = `#include <bits/stdc++.h>
using namespace std;

struct Edge { int u, v, l, r; };
struct Query { int u, v, id; };

// Union-find with rollback: the history stack records the child and the
// previous size of the parent, so a snapshot can be restored in O(k).
struct RollbackDSU {
    vector<int> p, sz;
    vector<pair<int, int>> hist;

    RollbackDSU(int n = 0) { init(n); }
    void init(int n) {
        p.resize(n + 1); sz.assign(n + 1, 1);
        iota(p.begin(), p.end(), 0); hist.clear();
    }
    int find(int x) { while (p[x] != x) x = p[x]; return x; }
    void unite(int a, int b) {
        a = find(a); b = find(b);
        if (a == b) { hist.emplace_back(-1, -1); return; }
        if (sz[a] < sz[b]) swap(a, b);
        hist.emplace_back(b, sz[a]);
        p[b] = a; sz[a] += sz[b];
    }
    int snapshot() const { return (int)hist.size(); }
    void rollback(int snap) {
        while ((int)hist.size() > snap) {
            auto [child, szBefore] = hist.back();
            hist.pop_back();
            if (child == -1) continue;
            int parent = p[child];
            sz[parent] = szBefore;
            p[child] = child;
        }
    }
};

int n, m, q, T;
vector<Edge> edges;
vector<vector<int>> bucket, atTime;
vector<Query> queries;
vector<int> answer;
RollbackDSU dsu;

void addEdge(int node, int lo, int hi, int ql, int qr, int idx) {
    if (ql <= lo && hi <= qr) { bucket[node].push_back(idx); return; }
    int mid = (lo + hi) >> 1;
    if (ql <= mid) addEdge(node << 1, lo, mid, ql, qr, idx);
    if (qr > mid) addEdge(node << 1 | 1, mid + 1, hi, ql, qr, idx);
}

void dfs(int node, int lo, int hi) {
    int snap = dsu.snapshot();
    for (int idx : bucket[node]) dsu.unite(edges[idx].u, edges[idx].v);

    if (lo == hi) {
        for (int id : atTime[lo]) {
            const auto &qu = queries[id];
            int ru = dsu.find(qu.u), rv = dsu.find(qu.v);
            answer[id] = (ru == rv) ? dsu.sz[ru] : -1;
        }
    } else {
        int mid = (lo + hi) >> 1;
        dfs(node << 1, lo, mid);
        dfs(node << 1 | 1, mid + 1, hi);
    }
    dsu.rollback(snap);
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    cin >> n >> m >> q;
    T = 0;
    edges.resize(m);
    for (int i = 0; i < m; i++) {
        cin >> edges[i].u >> edges[i].v >> edges[i].l >> edges[i].r;
        T = max(T, edges[i].r);
    }
    bucket.assign(4 * (T + 2), {});
    for (int i = 0; i < m; i++)
        addEdge(1, 1, T, edges[i].l, edges[i].r, i);

    atTime.assign(T + 2, {});
    queries.resize(q);
    answer.assign(q, -1);
    for (int i = 0; i < q; i++) {
        int u, v, t;
        cin >> u >> v >> t;
        queries[i] = {u, v, i};
        atTime[t].push_back(i);
    }

    dsu.init(n);
    dfs(1, 1, T);

    for (int i = 0; i < q; i++) cout << answer[i] << '\\n';
    return 0;
}
`

const CRYSTAL_CONVEYOR_CPP = `#include <bits/stdc++.h>
using namespace std;

// dp[j][i] = best value using a prefix of length i and exactly j segments.
// Transition over the previous segment start is maximised with a monotonic
// deque, which turns the naive O(n * k * R) into O(n * k).
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n, k, L, R;
    cin >> n >> k >> L >> R;
    vector<long long> a(n + 1), pref(n + 1, 0);
    for (int i = 1; i <= n; i++) {
        cin >> a[i];
        pref[i] = pref[i - 1] + a[i];
    }

    const long long NEG = -(1LL << 60);
    vector<vector<long long>> dp(k + 1, vector<long long>(n + 1, NEG));
    dp[0][0] = 0;

    for (int j = 1; j <= k; j++) {
        deque<int> dq;
        for (int i = 1; i <= n; i++) {
            int cand = i - L;
            if (cand >= 0) {
                while (!dq.empty() && dp[j - 1][dq.back()] - pref[dq.back()] <= dp[j - 1][cand] - pref[cand])
                    dq.pop_back();
                dq.push_back(cand);
            }
            while (!dq.empty() && dq.front() < i - R) dq.pop_front();
            dp[j][i] = dp[j][i - 1];
            if (!dq.empty()) {
                int b = dq.front();
                dp[j][i] = max(dp[j][i], dp[j - 1][b] - pref[b] + pref[i]);
            }
        }
    }

    cout << dp[k][n] << '\\n';
    return 0;
}
`

const INFINITE_ORCHARD_CPP = `#include <bits/stdc++.h>
using namespace std;

// Sqrt decomposition. Every block keeps a sorted copy of its values plus a
// lazy add, so a range count is O(#blocks * log B + B) and a range add is
// O(#blocks + B log B).
const int B = 720;

struct SqrtArray {
    int n, nb;
    vector<long long> a, lazy;
    vector<vector<long long>> sorted;

    SqrtArray(const vector<long long> &v) {
        a = v; n = (int)a.size() - 1;
        nb = (n + B - 1) / B;
        lazy.assign(nb, 0);
        sorted.assign(nb, {});
        for (int b = 0; b < nb; b++) rebuild(b);
    }
    void rebuild(int b) {
        int l = b * B + 1, r = min(n, (b + 1) * B);
        sorted[b].assign(a.begin() + l, a.begin() + r + 1);
        sort(sorted[b].begin(), sorted[b].end());
    }
    void rangeAdd(int l, int r, long long x) {
        int bl = (l - 1) / B, br = (r - 1) / B;
        if (bl == br) {
            for (int i = l; i <= r; i++) a[i] += x;
            rebuild(bl);
            return;
        }
        for (int i = l; i <= (bl + 1) * B; i++) a[i] += x;
        rebuild(bl);
        for (int i = br * B + 1; i <= r; i++) a[i] += x;
        rebuild(br);
        for (int b = bl + 1; b < br; b++) lazy[b] += x;
    }
    int countAtLeast(int l, int r, long long k) const {
        int bl = (l - 1) / B, br = (r - 1) / B, ans = 0;
        if (bl == br) {
            for (int i = l; i <= r; i++) ans += (a[i] + lazy[bl] >= k);
            return ans;
        }
        for (int i = l; i <= (bl + 1) * B; i++) ans += (a[i] + lazy[bl] >= k);
        for (int i = br * B + 1; i <= r; i++) ans += (a[i] + lazy[br] >= k);
        for (int b = bl + 1; b < br; b++) {
            long long need = k - lazy[b];
            auto &vec = sorted[b];
            ans += (int)(vec.end() - lower_bound(vec.begin(), vec.end(), need));
        }
        return ans;
    }
};

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n, m;
    cin >> n >> m;
    vector<long long> a(n + 1);
    for (int i = 1; i <= n; i++) cin >> a[i];

    SqrtArray sa(a);
    while (m--) {
        char type;
        cin >> type;
        if (type == 'A') {
            int l, r;
            long long x;
            cin >> l >> r >> x;
            sa.rangeAdd(l, r, x);
        } else {
            int l, r;
            long long k;
            cin >> l >> r >> k;
            cout << sa.countAtLeast(l, r, k) << '\\n';
        }
    }
    return 0;
}
`

const PHANTOM_PALINDROME_CPP = `#include <bits/stdc++.h>
using namespace std;

// pal[l][r] = minimum deletions needed to turn s[l..r] into a palindrome.
// pal[l][r] = pal[l + 1][r - 1]                if s[l] == s[r]
//           = 1 + min(pal[l + 1][r], pal[l][r - 1])   otherwise
// Then scan every interval and keep the longest one within the budget.
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int k;
    string s;
    cin >> k >> s;
    int n = (int)s.size();

    vector<vector<int>> pal(n, vector<int>(n, 0));
    for (int len = 2; len <= n; len++) {
        for (int l = 0; l + len <= n; l++) {
            int r = l + len - 1;
            if (s[l] == s[r]) pal[l][r] = pal[l + 1][r - 1];
            else pal[l][r] = 1 + min(pal[l + 1][r], pal[l][r - 1]);
        }
    }

    int best = 1, bl = 0;
    for (int l = 0; l < n; l++) {
        for (int r = l; r < n; r++) {
            if (pal[l][r] <= k && r - l + 1 > best) {
                best = r - l + 1;
                bl = l;
            }
        }
    }
    cout << best << '\\n' << s.substr(bl, best) << '\\n';
    return 0;
}
`

const MIRRORED_CANOPY_CPP = `#include <bits/stdc++.h>
using namespace std;

// Sweep line over x with a segment tree on compressed y-coordinates.
// Each node stores covered length and how many rectangles cover it outright.
struct Event {
    long long x;
    int y1, y2, delta;
    bool operator<(const Event &o) const { return x < o.x; }
};

struct Node {
    int cover = 0;
    long long len = 0;
};

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n;
    cin >> n;
    vector<Event> ev;
    vector<long long> ys;

    for (int i = 0; i < n; i++) {
        long long x1, y1, x2, y2;
        cin >> x1 >> y1 >> x2 >> y2;
        if (x1 > x2) swap(x1, x2);
        if (y1 > y2) swap(y1, y2);
        ev.push_back({x1, 0, 0, +1});
        ev.push_back({x2, 0, 0, -1});
        ys.push_back(y1);
        ys.push_back(y2);
        ev[ev.size() - 2].y1 = ev.back().y1 = (int)ys.size() - 2;
        ev[ev.size() - 2].y2 = ev.back().y2 = (int)ys.size() - 1;
    }

    sort(ys.begin(), ys.end());
    ys.erase(unique(ys.begin(), ys.end()), ys.end());
    sort(ev.begin(), ev.end());

    // remap y indices onto the compressed grid
    vector<long long> raw;
    for (auto &e : ev) { raw.push_back(ys[e.y1]); }
    int m = (int)ys.size();
    vector<Node> seg(4 * m + 4);

    function<void(int, int, int, int, int, int)> update =
        [&](int node, int lo, int hi, int ql, int qr, int delta) {
            if (ql >= qr) return;
            if (ql <= lo && hi <= qr) {
                seg[node].cover += delta;
            } else {
                int mid = (lo + hi) >> 1;
                if (ql < mid) update(node << 1, lo, mid, ql, qr, delta);
                if (qr > mid) update(node << 1 | 1, mid, hi, ql, qr, delta);
            }
            if (seg[node].cover > 0) seg[node].len = ys[hi] - ys[lo];
            else if (hi - lo == 1) seg[node].len = 0;
            else seg[node].len = seg[node << 1].len + seg[node << 1 | 1].len;
        };

    long long area = 0;
    long long prevX = ev.empty() ? 0 : ev[0].x;
    for (size_t i = 0; i < ev.size(); i++) {
        area += (ev[i].x - prevX) * seg[1].len;
        prevX = ev[i].x;
        int l = (int)(lower_bound(ys.begin(), ys.end(), raw[i]) - ys.begin());
        int r = (int)(lower_bound(ys.begin(), ys.end(), raw[i ^ 1]) - ys.begin());
        if (l > r) swap(l, r);
        update(1, 0, m - 1, l, r, ev[i].delta);
    }

    cout << area << '\\n';
    return 0;
}
`

const LEDGER_SHADOWS_CPP = `#include <bits/stdc++.h>
using namespace std;

// Classic job sequencing: process slots greedily by descending profit and
// place each job in the latest free slot not after its deadline. Union-find
// over slots makes the "latest free slot" query near-constant.
struct Job {
    int deadline;
    long long profit;
    bool operator<(const Job &o) const { return profit > o.profit; }
};

struct SlotDSU {
    vector<int> p;
    SlotDSU(int n) : p(n + 1) { iota(p.begin(), p.end(), 0); }
    int find(int x) { return p[x] == x ? x : p[x] = find(p[x]); }
    int take(int x) {
        int root = find(x);
        if (root == 0) return 0;
        p[root] = find(root - 1);
        return root;
    }
};

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n;
    cin >> n;
    vector<Job> jobs(n);
    int maxD = 0;
    for (int i = 0; i < n; i++) {
        cin >> jobs[i].deadline >> jobs[i].profit;
        maxD = max(maxD, jobs[i].deadline);
    }
    sort(jobs.begin(), jobs.end());

    SlotDSU slots(maxD);
    long long total = 0;
    int taken = 0;
    for (const auto &job : jobs) {
        int d = min(job.deadline, maxD);
        if (slots.take(d)) {
            total += job.profit;
            taken++;
        }
    }
    cout << taken << ' ' << total << '\\n';
    return 0;
}
`

const MODULAR_MENAGERIE_CPP = `#include <bits/stdc++.h>
using namespace std;

// (a[i] + a[j]) % m == 0  <=>  rem[a[j]] == (m - rem[a[i]]) % m.
// Counting by residue collapses the whole thing into one pass.
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n;
    long long m;
    cin >> n >> m;
    vector<long long> cnt(m, 0);
    long long answer = 0;

    for (int i = 0; i < n; i++) {
        long long x;
        cin >> x;
        long long r = ((x % m) + m) % m;
        answer += cnt[(m - r) % m];
        cnt[r]++;
    }
    cout << answer << '\\n';
    return 0;
}
`

const CONVEYOR_JUNCTION_CPP = `#include <bits/stdc++.h>
using namespace std;

// Min-cost max-flow: successive shortest paths with SPFA (the network has
// negative reduced costs only in the residual, so Bellman-Ford is required).
struct MinCostFlow {
    struct E {
        int to, rev, cap;
        long long cost;
    };
    int n;
    vector<vector<E>> g;

    MinCostFlow(int n) : n(n), g(n) {}
    void addEdge(int v, int to, int cap, long long cost) {
        E a{to, (int)g[to].size(), cap, cost};
        E b{v, (int)g[v].size(), 0, -cost};
        g[v].push_back(a);
        g[to].push_back(b);
    }
    pair<int, long long> run(int s, int t, int maxFlow) {
        int flow = 0;
        long long cost = 0;
        vector<long long> dist(n);
        vector<int> pv(n), pe(n), inq(n);
        while (flow < maxFlow) {
            fill(dist.begin(), dist.end(), LLONG_MAX);
            dist[s] = 0;
            queue<int> q;
            q.push(s);
            inq[s] = 1;
            while (!q.empty()) {
                int v = q.front();
                q.pop();
                inq[v] = 0;
                for (int i = 0; i < (int)g[v].size(); i++) {
                    E &e = g[v][i];
                    if (e.cap > 0 && dist[e.to] > dist[v] + e.cost) {
                        dist[e.to] = dist[v] + e.cost;
                        pv[e.to] = v;
                        pe[e.to] = i;
                        if (!inq[e.to]) { inq[e.to] = 1; q.push(e.to); }
                    }
                }
            }
            if (dist[t] == LLONG_MAX) break;

            int push = maxFlow - flow;
            for (int v = t; v != s; v = pv[v]) push = min(push, g[pv[v]][pe[v]].cap);
            for (int v = t; v != s; v = pv[v]) {
                E &e = g[pv[v]][pe[v]];
                e.cap -= push;
                g[v][e.rev].cap += push;
            }
            flow += push;
            cost += push * dist[t];
        }
        return {flow, cost};
    }
};

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n, m, s, t;
    cin >> n >> m >> s >> t;
    MinCostFlow mf(n);
    for (int i = 0; i < m; i++) {
        int u, v, c;
        long long w;
        cin >> u >> v >> c >> w;
        mf.addEdge(u, v, c, w);
    }
    auto [flow, cost] = mf.run(s, t, INT_MAX);
    cout << flow << ' ' << cost << '\\n';
    return 0;
}
`

/* ── Problem catalogue ──────────────────────────────────────────────────── */

export const PROBLEMS: Problem[] = [
  {
    id: 'temporal-bridge',
    title: 'Temporal Bridge',
    difficulty: 2400,
    algorithms: ['Graph', 'Offline Query'],
    status: 'ready',
    uniqueness: 96,
    tests: 42,
    createdAt: ago(2),
    style: 'Codeforces',
    timeLimitMs: 2000,
    memoryLimitMb: 512,
    author: 'agent:designer-v2',
    keyIdeas: [
      'A bridge is open during [l_i, r_i] — model time as a segment tree axis',
      'Connectivity is monotone only per-interval, so rollback is the only way back',
      'One DFS over the time tree with a rollback DSU answers every query offline',
    ],
    statement: {
      legend: [
        'The archipelago of Aethel holds n islands, connected by m bridges. Unlike ordinary bridges, each one is carved from tidal stone: bridge i joins islands a_i and b_i and stands only during the closed interval of days [l_i, r_i]. Outside that window it dissolves into the sea and leaves no trace.',
        'You are commissioned by the cartographer guild to answer q questions. Each question names two islands u and v and a day t, and asks what the archipelago looks like on that day: if there is a chain of standing bridges leading from u to v, report how many islands lie in that same connected cluster; otherwise report that the two are sundered.',
        'The guild works offline — all questions are known in advance, and a single well-chosen traversal can answer all of them.',
      ],
      input: [
        'The first line contains three integers n, m and q (1 ≤ n ≤ 2·10^5, 0 ≤ m ≤ 2·10^5, 1 ≤ q ≤ 2·10^5) — the number of islands, bridges and questions.',
        'Each of the next m lines contains four integers a_i, b_i, l_i and r_i (1 ≤ a_i, b_i ≤ n, a_i ≠ b_i, 1 ≤ l_i ≤ r_i ≤ 2·10^5) — the endpoints of bridge i and the interval of days on which it stands.',
        'Each of the next q lines contains three integers u, v and t (1 ≤ u, v ≤ n, 1 ≤ t ≤ 2·10^5) — a question about islands u and v on day t.',
      ],
      output: [
        'For each question, print a single line: the size of the connected cluster containing u on day t if u and v are connected, and -1 otherwise.',
      ],
      examples: [
        {
          input: '5 4 3\n1 2 1 3\n2 3 2 5\n4 5 1 2\n3 4 3 4\n1 3 2\n1 5 4\n2 4 2',
          output: '3\n-1\n-1',
          note: 'On day 2 the bridges 1–2, 2–3 and 4–5 stand, so islands 1, 2, 3 form one cluster of size 3 while 4 and 5 form another.',
        },
        {
          input: '2 1 2\n1 2 1 1\n1 2 1\n1 2 2',
          output: '2\n-1',
          note: 'The single bridge stands on day 1 only.',
        },
      ],
      notes: [
        'Multiple bridges may connect the same pair of islands, and they may stand on overlapping intervals.',
        'When u = v the answer is the size of the cluster containing u, since an island is always reachable from itself.',
      ],
    },
    solution: TEMPORAL_BRIDGE_CPP,
  },
  {
    id: 'crystal-conveyor',
    title: 'Crystal Conveyor',
    difficulty: 1900,
    algorithms: ['DP', 'Monotonic Queue'],
    status: 'testing',
    uniqueness: 91,
    tests: 28,
    createdAt: ago(14),
    style: 'Codeforces',
    timeLimitMs: 1500,
    memoryLimitMb: 256,
    author: 'agent:designer-v2',
    keyIdeas: [
      'Fix the number of segments used, then optimise the last cut position',
      'The transition is a sliding-window maximum → monotonic deque',
      'Total complexity drops from O(n·k·R) to O(n·k)',
    ],
    statement: {
      legend: [
        'n crystals travel past a scanning gate in a fixed order. Crystal i carries value v_i, which may be negative if the crystal is flawed. An operator may select up to k disjoint consecutive runs of crystals, each of length between L and R inclusive, and collects the sum of values over every selected crystal.',
        'Determine the largest total value the operator can collect. Selecting nothing is allowed and yields 0.',
      ],
      input: [
        'The first line contains four integers n, k, L and R (1 ≤ n ≤ 10^5, 1 ≤ k ≤ 100, 1 ≤ L ≤ R ≤ n) — the number of crystals, the maximum number of runs, and the length bounds of a run.',
        'The second line contains n integers v_1, …, v_n (−10^9 ≤ v_i ≤ 10^9).',
      ],
      output: ['Print a single integer — the maximum collectible value.'],
      examples: [
        {
          input: '7 2 2 3\n4 -1 3 -2 5 -1 2',
          output: '12',
          note: 'Take the runs [1, 3] (value 6) and [5, 7] (value 6).',
        },
      ],
      notes: [
        'Runs must be disjoint, but they may be adjacent — two adjacent runs of valid lengths are simply two runs.',
        'The answer fits in a signed 64-bit integer.',
      ],
    },
    solution: CRYSTAL_CONVEYOR_CPP,
  },
  {
    id: 'infinite-orchard',
    title: 'Infinite Orchard',
    difficulty: 3100,
    algorithms: ['Data Structure', 'Sqrt Decomposition'],
    status: 'stress-testing',
    uniqueness: 98,
    tests: 64,
    createdAt: ago(60),
    style: 'ICPC',
    timeLimitMs: 3000,
    memoryLimitMb: 512,
    author: 'agent:designer-v2',
    keyIdeas: [
      'Range add + threshold counting is the classic sqrt-decomposition workload',
      'Keep a sorted copy per block so a full block is answered by lower_bound',
      'Partially covered blocks are rebuilt from scratch — at most two per operation',
    ],
    statement: {
      legend: [
        'The Infinite Orchard stores its harvest in n consecutive crates. Crate i initially holds a_i apples. Two kinds of gardeners visit the orchard in sequence: some add x apples to every crate in a contiguous stretch, and some ask how many crates in a stretch hold at least k apples.',
        'Because the orchard never closes, both kinds of visits may be interleaved arbitrarily, and all of them must be answered online.',
      ],
      input: [
        'The first line contains two integers n and m (1 ≤ n, m ≤ 2·10^5).',
        'The second line contains n integers a_1, …, a_n (0 ≤ a_i ≤ 10^9).',
        'Each of the next m lines is either:',
        '  · "A l r x" — add x apples to every crate i with l ≤ i ≤ r (1 ≤ l ≤ r ≤ n, |x| ≤ 10^9);',
        '  · "Q l r k" — report the number of crates i with l ≤ i ≤ r holding at least k apples (1 ≤ l ≤ r ≤ n, 0 ≤ k ≤ 10^18).',
      ],
      output: ['For every "Q" visit, print the answer on its own line.'],
      examples: [
        {
          input: '5 5\n1 5 2 8 3\nQ 1 5 4\nA 2 4 3\nQ 1 5 4\nA 1 3 -4\nQ 2 5 2',
          output: '2\n4\n3',
        },
      ],
      notes: [
        'Counts never go negative in the input model, but intermediate crate totals may, and the comparison must use signed arithmetic.',
        'At least one "Q" visit is guaranteed.',
      ],
    },
    solution: INFINITE_ORCHARD_CPP,
  },
  {
    id: 'phantom-palindrome',
    title: 'Phantom Palindrome',
    difficulty: 1600,
    algorithms: ['String', 'Interval DP'],
    status: 'ready',
    uniqueness: 88,
    tests: 24,
    createdAt: ago(180),
    style: 'Educational',
    timeLimitMs: 1000,
    memoryLimitMb: 256,
    author: 'agent:designer-v2',
    keyIdeas: [
      'The edit distance from a substring to its reverse is an interval DP',
      'Equal endpoints are free; otherwise delete from the left or the right',
      'Scan all O(n^2) intervals for the longest one within budget',
    ],
    statement: {
      legend: [
        'A phantom palindrome is a string that becomes a palindrome once at most k of its characters are removed. Given a string s and the budget k, find the longest contiguous substring of s that is a phantom palindrome.',
      ],
      input: [
        'The first line contains a single integer k (0 ≤ k ≤ 20).',
        'The second line contains the string s (1 ≤ |s| ≤ 2000), consisting of lowercase English letters.',
      ],
      output: [
        'Print the length of the longest phantom palindrome on the first line, and the substring itself on the second line. If several substrings attain the maximum length, print any of them.',
      ],
      examples: [
        {
          input: '1\nabcdeca',
          output: '5\ncdec',
          note: 'Removing the character "d" from "cdec" would also work; removing nothing from "acdca" is not possible here.',
        },
      ],
      notes: ['A single character is always a palindrome, so the answer is at least 1.'],
    },
    solution: PHANTOM_PALINDROME_CPP,
  },
  {
    id: 'mirrored-canopy',
    title: 'Mirrored Canopy',
    difficulty: 2700,
    algorithms: ['Geometry', 'Sweep Line'],
    status: 'draft',
    uniqueness: 93,
    tests: 12,
    createdAt: ago(300),
    style: 'ICPC',
    timeLimitMs: 2000,
    memoryLimitMb: 256,
    author: 'agent:designer-v2',
    keyIdeas: [
      'Sweep a vertical line; coverage of y only changes at rectangle edges',
      'Compress y-coordinates and maintain covered length in a segment tree',
      'Area accumulates as Δx × (currently covered length)',
    ],
    statement: {
      legend: [
        'An architect lays n rectangular skylights onto a glass canopy. The skylights may overlap arbitrarily. Compute the total area of the canopy that is covered by at least one skylight.',
        'All rectangles are axis-aligned and their corners have integer coordinates.',
      ],
      input: [
        'The first line contains an integer n (1 ≤ n ≤ 2·10^5).',
        'Each of the next n lines contains four integers x_1, y_1, x_2, y_2 (0 ≤ x_1 < x_2 ≤ 10^9, 0 ≤ y_1 < y_2 ≤ 10^9) — two opposite corners of a skylight.',
      ],
      output: ['Print the total covered area.'],
      examples: [
        {
          input: '2\n0 0 4 4\n2 2 6 6',
          output: '28',
          note: 'The two 4×4 squares overlap in a 2×2 region: 16 + 16 − 4 = 28.',
        },
      ],
      notes: ['The answer may exceed 32 bits; use 64-bit integers.'],
    },
    solution: MIRRORED_CANOPY_CPP,
  },
  {
    id: 'ledger-of-shadows',
    title: 'Ledger of Shadows',
    difficulty: 2100,
    algorithms: ['Greedy', 'DSU'],
    status: 'failed',
    uniqueness: 74,
    tests: 31,
    createdAt: ago(60 * 26),
    style: 'Codeforces',
    timeLimitMs: 1000,
    memoryLimitMb: 256,
    author: 'agent:designer-v2',
    keyIdeas: [
      'Sorting by profit and taking the latest free slot is optimal by exchange',
      'Union-find over slots answers "latest free slot ≤ d" in near-constant time',
      'The structure doubles as a proof that no better schedule exists',
    ],
    statement: {
      legend: [
        'A courier has n commissions. Commission i pays p_i and must be finished no later than day d_i. Each commission takes exactly one full day, and the courier can handle at most one per day, starting from day 1.',
        'Choose the set of commissions that maximises total pay, and among all such sets the one with the most commissions.',
      ],
      input: [
        'The first line contains n (1 ≤ n ≤ 2·10^5).',
        'Each of the next n lines contains two integers d_i and p_i (1 ≤ d_i ≤ n, 1 ≤ p_i ≤ 10^9).',
      ],
      output: ['Print two integers: the number of accepted commissions and the total pay.'],
      examples: [
        {
          input: '4\n2 100\n1 50\n2 80\n1 60',
          output: '2 180',
          note: 'Accept the commissions paying 100 and 80, scheduled on days 2 and 1.',
        },
      ],
      notes: ['Ties are broken in favour of accepting more commissions.'],
    },
    solution: LEDGER_SHADOWS_CPP,
  },
  {
    id: 'modular-menagerie',
    title: 'Modular Menagerie',
    difficulty: 1400,
    algorithms: ['Math', 'Counting'],
    status: 'ready',
    uniqueness: 84,
    tests: 18,
    createdAt: ago(60 * 50),
    style: 'Educational',
    timeLimitMs: 1000,
    memoryLimitMb: 256,
    author: 'agent:designer-v2',
    keyIdeas: [
      'Only residues modulo m matter',
      'For each element, the partner residue is uniquely determined',
      'One linear pass with a residue counter',
    ],
    statement: {
      legend: [
        'Given n integers and a modulus m, count the number of pairs of indices (i, j) with i < j such that a_i + a_j is divisible by m.',
      ],
      input: [
        'The first line contains two integers n and m (1 ≤ n ≤ 2·10^5, 1 ≤ m ≤ 10^9).',
        'The second line contains n integers a_1, …, a_n (−10^9 ≤ a_i ≤ 10^9).',
      ],
      output: ['Print the number of valid pairs.'],
      examples: [
        {
          input: '5 4\n1 3 2 6 2',
          output: '4',
          note: 'The pairs are (1,3), (2,4), (3,5) and (4,5) using 1-based positions.',
        },
      ],
      notes: ['Negative values must have their residues normalised before counting.'],
    },
    solution: MODULAR_MENAGERIE_CPP,
  },
  {
    id: 'conveyor-junction',
    title: 'Conveyor Junction',
    difficulty: 3300,
    algorithms: ['Flow', 'Min-Cost Max-Flow'],
    status: 'generating',
    uniqueness: 99,
    tests: 8,
    createdAt: ago(60 * 74),
    style: 'ICPC',
    timeLimitMs: 4000,
    memoryLimitMb: 512,
    author: 'agent:designer-v2',
    keyIdeas: [
      'Model freight as flow, junction fees as edge costs',
      'Successive shortest paths with SPFA handles negative residual costs',
      'Potentials would work too, but the graph is small enough for Bellman-Ford',
    ],
    statement: {
      legend: [
        'A freight network consists of n junctions and m directed conveyor belts. Belt i runs from junction u_i to junction v_i, can carry at most c_i containers per hour, and charges w_i per container. Ship as many containers as possible from the depot s to the harbour t; among all maximum-throughput plans, choose the cheapest one.',
      ],
      input: [
        'The first line contains four integers n, m, s and t (2 ≤ n ≤ 400, 1 ≤ m ≤ 5000, 1 ≤ s, t ≤ n, s ≠ t).',
        'Each of the next m lines contains four integers u_i, v_i, c_i and w_i (1 ≤ u_i, v_i ≤ n, 0 ≤ c_i ≤ 10^6, 0 ≤ w_i ≤ 10^6).',
      ],
      output: ['Print two integers: the maximum hourly throughput and its minimum total cost.'],
      examples: [
        {
          input: '4 4 1 4\n1 2 3 2\n1 3 2 5\n2 4 2 1\n3 4 3 3',
          output: '5 19',
        },
      ],
      notes: ['The network is guaranteed to admit at least one positive-throughput plan.'],
    },
    solution: CONVEYOR_JUNCTION_CPP,
  },
]

export const PROBLEM_MAP = PROBLEMS.reduce<Record<string, Problem>>(
  (acc, p) => ({ ...acc, [p.id]: p }),
  {},
)

/* ── Supporting records ─────────────────────────────────────────────────── */

const GROUPS: TestFile['group'][] = ['sample', 'small', 'boundary', 'max', 'adversarial']
const GENERATORS = ['gen_random.cpp', 'gen_chain.cpp', 'gen_star.cpp', 'gen_hand.cpp', 'gen_extreme.cpp']
const NOTES = [
  'uniform random',
  'degenerate path',
  'all queries at t = 1',
  'tight time limit probe',
  'hash collision attempt',
  'single element',
  'maximum constraints',
  'alternating pattern',
]

export function buildTests(problem: Problem): TestFile[] {
  const seedBase = problem.title.length * 7919 + problem.difficulty
  return Array.from({ length: Math.min(problem.tests, 64) }, (_, i) => {
    const group = i < 2 ? 'sample' : GROUPS[(i * 3 + 1) % GROUPS.length]
    return {
      id: `${problem.id}-t${i + 1}`,
      index: i + 1,
      group,
      bytes:
        group === 'max'
          ? 4_200_000 + ((seedBase + i) % 900_000)
          : group === 'sample'
            ? 120 + i * 34
            : 8_000 + ((seedBase * (i + 3)) % 400_000),
      generator: GENERATORS[(i + problem.tests) % GENERATORS.length],
      seed: seedBase + i * 1013,
      verdict: i === 17 ? 'warn' : 'ok',
      note: NOTES[(i * 5 + 2) % NOTES.length],
    }
  })
}

export const SUBMISSIONS: Submission[] = [
  { id: 's_1', problemId: 'temporal-bridge', language: 'C++17', verdict: 'AC', timeMs: 421, memoryKb: 12600, submittedAt: ago(1), author: 'agent:solver-v5' },
  { id: 's_2', problemId: 'temporal-bridge', language: 'C++17', verdict: 'WA', timeMs: 118, memoryKb: 4200, submittedAt: ago(3), author: 'candidate#2' },
  { id: 's_3', problemId: 'temporal-bridge', language: 'C++20', verdict: 'AC', timeMs: 512, memoryKb: 15800, submittedAt: ago(6), author: 'brute-force' },
  { id: 's_4', problemId: 'temporal-bridge', language: 'C++17', verdict: 'TLE', timeMs: 2000, memoryKb: 204800, submittedAt: ago(11), author: 'candidate#1' },
  { id: 's_5', problemId: 'temporal-bridge', language: 'PyPy3', verdict: 'RE', timeMs: 0, memoryKb: 0, submittedAt: ago(19), author: 'candidate#3' },
  { id: 's_6', problemId: 'temporal-bridge', language: 'C++17', verdict: 'AC', timeMs: 388, memoryKb: 12400, submittedAt: ago(34), author: 'reference' },
  { id: 's_7', problemId: 'temporal-bridge', language: 'C++17', verdict: 'AC', timeMs: 402, memoryKb: 12900, submittedAt: ago(52), author: 'reference' },
  { id: 's_8', problemId: 'temporal-bridge', language: 'C++17', verdict: 'MLE', timeMs: 900, memoryKb: 540000, submittedAt: ago(77), author: 'candidate#4' },
]

export const THROUGHPUT: { t: string; generated: number; rejected: number }[] = [
  { t: '00:00', generated: 3, rejected: 11 },
  { t: '04:00', generated: 7, rejected: 24 },
  { t: '08:00', generated: 12, rejected: 19 },
  { t: '12:00', generated: 21, rejected: 38 },
  { t: '16:00', generated: 18, rejected: 27 },
  { t: '20:00', generated: 29, rejected: 41 },
  { t: '24:00', generated: 38, rejected: 52 },
]

export const DASHBOARD_STATS = [
  { key: 'problems', label: 'Problems Generated', value: 128, delta: '+12 today', hint: 'Packages that passed the full pipeline' },
  { key: 'ideas', label: 'Ideas Discovered', value: 2431, delta: '+96 today', hint: 'Candidate regions mined from 5 archives' },
  { key: 'dupes', label: 'Duplicates Rejected', value: 317, delta: '+4 today', hint: 'Similarity above the 0.62 threshold' },
  { key: 'stress', label: 'Stress Tests Run', value: 18492, delta: '+1,204 today', hint: 'Differential cases executed in 24 h' },
]
