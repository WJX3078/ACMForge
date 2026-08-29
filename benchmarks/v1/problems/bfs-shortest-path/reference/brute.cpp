#include <bits/stdc++.h>
using namespace std;

// 暴力基准：Bellman-Ford 松弛（无权即逐层 +1），O(nm)，仅适用于小规模
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n, m;
    cin >> n >> m;
    vector<pair<int, int>> edges;
    edges.reserve(2 * m);
    for (int i = 0; i < m; ++i) {
        int u, v;
        cin >> u >> v;
        edges.push_back({u, v});
        edges.push_back({v, u});
    }
    const int INF = 1e9;
    vector<int> dist(n + 1, INF);
    dist[1] = 0;
    for (int round = 0; round <= n; ++round) {
        bool changed = false;
        for (auto [u, v] : edges) {
            if (dist[u] != INF && dist[u] + 1 < dist[v]) {
                dist[v] = dist[u] + 1;
                changed = true;
            }
        }
        if (!changed) break;
    }
    cout << (dist[n] >= INF ? -1 : dist[n]) << "\n";
    return 0;
}
