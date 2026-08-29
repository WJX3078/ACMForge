#include <bits/stdc++.h>
using namespace std;

// 暴力基准：直接按定义累加（用 vector 保存后再求和）
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n;
    cin >> n;
    vector<long long> a(n);
    for (auto &v : a) cin >> v;
    long long s = 0;
    for (int i = 0; i < n; ++i) s += a[i];
    cout << s << "\n";
    return 0;
}
