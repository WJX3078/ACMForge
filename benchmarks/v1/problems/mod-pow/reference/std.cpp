#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    long long b, e, m;
    cin >> b >> e >> m;

    if (m == 1) {
        cout << 0 << "\n";
        return 0;
    }

    long long result = 1 % m;
    long long base = b % m;
    while (e > 0) {
        if (e & 1) result = result * base % m;
        base = base * base % m;
        e >>= 1;
    }
    cout << result << "\n";
    return 0;
}
