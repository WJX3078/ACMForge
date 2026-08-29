#include <bits/stdc++.h>
using namespace std;

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

    long long last_r = -4e18;
    int cnt = 0;
    for (auto &[l, r] : seg) {
        if (l >= last_r) {
            ++cnt;
            last_r = std::max(last_r, r);
        }
    }
    cout << cnt << "\n";
    return 0;
}
