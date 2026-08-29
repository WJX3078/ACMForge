#include <bits/stdc++.h>
using namespace std;

// 暴力：从后往前累加（与 std 语义一致）
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int n;
    cin >> n;
    vector<long long> a(n);
    for (auto &v : a) cin >> v;
    long long s = 0;
    for (int i = n - 1; i >= 0; --i) s += a[i];
    cout << s << "\n";
    return 0;
}
