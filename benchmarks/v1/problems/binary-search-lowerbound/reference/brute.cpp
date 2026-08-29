#include <bits/stdc++.h>
using namespace std;

// 暴力基准：每个询问线性扫描
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n, q;
    cin >> n >> q;
    vector<long long> a(n);
    for (auto &v : a) cin >> v;

    while (q--) {
        long long x;
        cin >> x;
        int ans = -1;
        for (int i = 0; i < n; ++i) {
            if (a[i] >= x) {
                ans = i + 1;
                break;
            }
        }
        cout << ans << "\n";
    }
    return 0;
}
