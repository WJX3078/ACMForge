#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n, k;
    cin >> n >> k;
    vector<long long> a(n);
    for (auto &v : a) cin >> v;

    deque<int> dq;  // 存下标，值严格递增
    vector<long long> out;
    for (int i = 0; i < n; ++i) {
        while (!dq.empty() && a[dq.back()] >= a[i]) dq.pop_back();
        dq.push_back(i);
        if (dq.front() <= i - k) dq.pop_front();
        if (i >= k - 1) out.push_back(a[dq.front()]);
    }
    for (size_t i = 0; i < out.size(); ++i) {
        cout << out[i] << " \n"[i + 1 == out.size()];
    }
    return 0;
}
