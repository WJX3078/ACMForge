#include <bits/stdc++.h>
using namespace std;

// 暴力基准：对每个点 BFS 一遍取最大距离，O(n^2)，仅适用于小规模
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n;
    cin >> n;
    vector<vector<pair<int, long long>>> adj(n + 1);
    for (int i = 0; i < n - 1; ++i) {
        int u, v;
        long long w;
        cin >> u >> v >> w;
        adj[u].push_back({v, w});
        adj[v].push_back({u, w});
    }

    long long diameter = 0;
    for (int src = 1; src <= n; ++src) {
        vector<long long> dist(n + 1, -1);
        vector<int> order;
        dist[src] = 0;
        order.push_back(src);
        for (size_t head = 0; head < order.size(); ++head) {
            int u = order[head];
            for (auto [v, w] : adj[u]) {
                if (dist[v] == -1) {
                    dist[v] = dist[u] + w;
                    order.push_back(v);
                }
            }
        }
        for (int i = 1; i <= n; ++i) diameter = max(diameter, dist[i]);
    }
    cout << diameter << "\n";
    return 0;
}
