#include <bits/stdc++.h>
using namespace std;

// 按 WrongIdeaSpec(int_sum_overflow) 实现的"错误解"：累加器用 int
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n;
    cin >> n;

    int best = -2147483647 - 1, cur = 0;
    for (int i = 0; i < n; ++i) {
        int x;
        cin >> x;
        cur = max(x, cur + x);
        best = max(best, cur);
    }
    cout << best << "\n";
    return 0;
}
