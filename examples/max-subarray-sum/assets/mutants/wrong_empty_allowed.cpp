#include <bits/stdc++.h>
using namespace std;

// 错误解：best 初始化为 0，隐含"允许选空子段"。
// 全负数组会错误输出 0，而题目要求非空子段。
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n;
    cin >> n;

    long long best = 0, cur = 0;   // 错误所在：best 应初始化为 -inf
    for (int i = 0; i < n; ++i) {
        long long x;
        cin >> x;
        cur = std::max(x, cur + x);
        best = std::max(best, cur);
    }
    cout << best << "\n";
    return 0;
}
