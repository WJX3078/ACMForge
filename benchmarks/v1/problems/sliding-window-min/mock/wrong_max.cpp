#include <bits/stdc++.h>
using namespace std;

// 按 WrongIdeaSpec(max_instead_of_min)：单调队列方向写反，输出窗口最大值
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n, k;
    cin >> n >> k;
    vector<long long> a(n);
    for (auto &v : a) cin >> v;

    deque<int> dq;  // 值严格递减 => 队头是最大值（错误）
    vector<long long> out;
    for (int i = 0; i < n; ++i) {
        while (!dq.empty() && a[dq.back()] <= a[i]) dq.pop_back();
        dq.push_back(i);
        if (dq.front() <= i - k) dq.pop_front();
        if (i >= k - 1) out.push_back(a[dq.front()]);
    }
    for (size_t i = 0; i < out.size(); ++i) {
        cout << out[i] << " \n"[i + 1 == out.size()];
    }
    return 0;
}
