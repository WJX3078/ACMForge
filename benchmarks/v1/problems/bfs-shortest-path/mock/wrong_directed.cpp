#include <bits/stdc++.h>
using namespace std;

// 按 WrongIdeaSpec(directed_edge_bug)：无向图只建单向边
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n, m;
    cin >> n >> m;
    vector<vector<int>> adj(n + 1);
    for (int i = 0; i < m; ++i) {
        int u, v;
        cin >> u >> v;
        adj[u].push_back(v);  // 错误：缺少 adj[v].push_back(u)
    }

    vector<int> dist(n + 1, -1);
    vector<int> queue_vec;
    dist[1] = 0;
    queue_vec.push_back(1);
    for (size_t head = 0; head < queue_vec.size(); ++head) {
        int u = queue_vec[head];
        for (int v : adj[u]) {
            if (dist[v] == -1) {
                dist[v] = dist[u] + 1;
                queue_vec.push_back(v);
            }
        }
    }
    cout << dist[n] << "\n";
    return 0;
}
