#include <bits/stdc++.h>
using namespace std;

// 暴力基准：按右端点排序后做 O(n^2) DP
// dp[i] = 考虑前 i 个（按 r 排序）且必选第 i 个时的最大数量
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n;
    cin >> n;
    vector<pair<long long, long long>> seg(n);
    for (auto &[l, r] : seg) cin >> l >> r;
    sort(seg.begin(), seg.end(), [](const auto &x, const auto &y) {
        return x.second < y.second;
    });

    vector<int> dp(n, 1);
    int best = 0;
    for (int i = 0; i < n; ++i) {
        for (int j = 0; j < i; ++j) {
            if (seg[j].second <= seg[i].first) {
                dp[i] = max(dp[i], dp[j] + 1);
            }
        }
        best = max(best, dp[i]);
    }
    cout << best << "\n";
    return 0;
}
