#include <bits/stdc++.h>
using namespace std;

// 错误解：遇到负数就把当前和清零。
// 看似"及时止损"，实际上丢掉了负数作为"桥梁"的情形：3, -1, 2 的答案是 4，而不是 3。
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n;
    cin >> n;

    long long best = LLONG_MIN, cur = 0;
    for (int i = 0; i < n; ++i) {
        long long x;
        cin >> x;
        cur += x;
        if (x < 0) cur = 0;   // 错误所在
        best = std::max(best, cur);
    }
    cout << best << "\n";
    return 0;
}
