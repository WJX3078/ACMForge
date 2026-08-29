#include <bits/stdc++.h>
using namespace std;

// 暴力基准：无记忆化递归枚举所有爬法，O(2^n)，仅适用于小规模
int n;
vector<long long> c;

// bestFrom(pos)：已经站在 pos（已付 c[pos]），到达 n 的最小后续花费
long long bestFrom(int pos) {
    long long best = LLONG_MAX;
    for (int step = 1; step <= 2; ++step) {
        int nxt = pos + step;
        if (nxt > n) continue;
        long long cost = c[nxt] + (nxt == n ? 0LL : bestFrom(nxt));
        best = min(best, cost);
    }
    return best;
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    cin >> n;
    c.assign(n + 1, 0);
    for (int i = 1; i <= n; ++i) cin >> c[i];

    long long ans = LLONG_MAX;
    for (int first = 1; first <= min(2, n); ++first) {
        long long cost = c[first] + (first == n ? 0LL : bestFrom(first));
        ans = min(ans, cost);
    }
    cout << ans << "\n";
    return 0;
}
