#include <bits/stdc++.h>
using namespace std;

// 暴力基准：每个窗口 O(k) 扫描，O(nk)，仅适用于小规模
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n, k;
    cin >> n >> k;
    vector<long long> a(n);
    for (auto &v : a) cin >> v;

    vector<long long> out;
    for (int i = k - 1; i < n; ++i) {
        long long mn = a[i];
        for (int j = i - k + 1; j <= i; ++j) {
            mn = min(mn, a[j]);
        }
        out.push_back(mn);
    }
    for (size_t i = 0; i < out.size(); ++i) {
        cout << out[i] << " \n"[i + 1 == out.size()];
    }
    return 0;
}
