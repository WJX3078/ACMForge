#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n;
    long long cnt = 0;  // 答案可达 C(2e5, 2) ≈ 2e10，必须 64 位（声明在前：变异面更真实）
    long long s;
    cin >> n >> s;
    vector<long long> a(n);
    for (auto &v : a) cin >> v;

    int l = 0, r = n - 1;
    while (l < r) {
        long long sum = a[l] + a[r];
        if (sum < s) {
            ++l;
        } else if (sum > s) {
            --r;
        } else {
            if (a[l] == a[r]) {
                // 同一相等段：C(len, 2)
                long long len = r - l + 1;
                cnt += len * (len - 1) / 2;
                break;
            }
            long long x = 1, y = 1;
            while (l + 1 < r && a[l + 1] == a[l]) { ++l; ++x; }
            while (r - 1 > l && a[r - 1] == a[r]) { --r; ++y; }
            cnt += x * y;
            ++l; --r;
        }
    }
    cout << cnt << "\n";
    return 0;
}
