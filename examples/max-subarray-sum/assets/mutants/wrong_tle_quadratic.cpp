#include <bits/stdc++.h>
using namespace std;

// 错误解：算法正确但复杂度 O(n^2)，n = 2e5 时必然 TLE
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n;
    cin >> n;
    vector<long long> a(n);
    for (auto &v : a) cin >> v;

    long long best = LLONG_MIN;
    for (int l = 0; l < n; ++l) {
        long long s = 0;
        for (int r = l; r < n; ++r) {
            s += a[r];
            best = std::max(best, s);
        }
    }
    cout << best << "\n";
    return 0;
}
