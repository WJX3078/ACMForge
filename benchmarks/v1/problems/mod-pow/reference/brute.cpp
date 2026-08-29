#include <bits/stdc++.h>
using namespace std;

// 暴力基准：连乘 e 次，O(e)，仅适用于 e 很小的对拍数据
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    long long b, e, m;
    cin >> b >> e >> m;

    long long result = 1 % m;
    for (long long i = 0; i < e; ++i) {
        result = result * (b % m) % m;
    }
    cout << result << "\n";
    return 0;
}
