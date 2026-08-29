#include <bits/stdc++.h>
using namespace std;

// 暴力对拍基准：O(n^2) 枚举所有子段，绝对正确（仅适用于小规模）
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
