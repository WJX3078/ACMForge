#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n;
    cin >> n;
    vector<long long> c(n + 1);
    for (int i = 1; i <= n; ++i) cin >> c[i];

    vector<long long> dp(n + 1, 0);
    for (int i = 1; i <= n; ++i) {
        // dp[i] = c[i] + min(dp[i-1], dp[i-2])，越界（地面）视为 0
        long long take = c[i] + std::min(i == 1 ? 0LL : dp[i - 1], i == 2 ? 0LL : dp[i - 2]);
        dp[i] = take;
    }
    cout << dp[n] << "\n";
    return 0;
}
