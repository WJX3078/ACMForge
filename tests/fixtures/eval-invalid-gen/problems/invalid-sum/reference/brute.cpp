#include <bits/stdc++.h>
using namespace std;

// 参考正确实现（作为 brute 与最终 repair 目标）
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int n;
    cin >> n;
    long long s = 0;
    for (int i = 0; i < n; ++i) {
        long long x;
        cin >> x;
        s += x;
    }
    cout << s << "\n";
    return 0;
}
