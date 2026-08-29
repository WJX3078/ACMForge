#include <bits/stdc++.h>
using namespace std;

// 暴力基准：O(n^2) 双重循环
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n;
    long long s;
    cin >> n >> s;
    vector<long long> a(n);
    for (auto &v : a) cin >> v;

    long long cnt = 0;
    for (int i = 0; i < n; ++i) {
        for (int j = i + 1; j < n; ++j) {
            if (a[i] + a[j] == s) ++cnt;
        }
    }
    cout << cnt << "\n";
    return 0;
}
