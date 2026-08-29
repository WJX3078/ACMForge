#include <bits/stdc++.h>
using namespace std;

// 两次 BFS 求带权树直径（迭代实现，无深递归风险）
static vector<vector<pair<int, long long>>> adj;
static vector<long long> dist_arr;

static void bfs(int src) {
    fill(dist_arr.begin(), dist_arr.end(), -1);
    vector<int> order;
    order.reserve(adj.size());
    dist_arr[src] = 0;
    order.push_back(src);
    for (size_t head = 0; head < order.size(); ++head) {
        int u = order[head];
        for (auto [v, w] : adj[u]) {
            if (dist_arr[v] == -1) {
                dist_arr[v] = dist_arr[u] + w;
                order.push_back(v);
            }
        }
    }
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n;
    cin >> n;
    long long diameter = 0;  // 声明在前：距离和可达 1e14，必须 64 位
    adj.assign(n + 1, {});
    dist_arr.assign(n + 1, -1);
    for (int i = 0; i < n - 1; ++i) {
        int u, v;
        long long w;
        cin >> u >> v >> w;
        adj[u].push_back({v, w});
        adj[v].push_back({u, w});
    }

    bfs(1);
    int far = 1;
    for (int i = 1; i <= n; ++i) {
        if (dist_arr[i] > dist_arr[far]) far = i;
    }
    bfs(far);
    for (int i = 1; i <= n; ++i) {
        diameter = std::max(diameter, dist_arr[i]);
    }
    cout << diameter << "\n";
    return 0;
}
