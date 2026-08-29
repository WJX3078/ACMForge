from acmforge.domain.models import MutantCategory
from acmforge.mutation.operators import apply_mutations

STD = """#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n;
    cin >> n;

    long long best = LLONG_MIN, cur = 0;
    for (int i = 0; i < n; ++i) {
        long long x;
        cin >> x;
        cur = std::max(x, cur + x);
        best = std::max(best, cur);
    }
    cout << best << "\\n";
    return 0;
}
"""


def test_mutations_produced():
    results = apply_mutations(STD)
    assert results, "至少应产生一个变异体"
    names = [op.name for op, _site, _code in results]
    assert "longlong_to_int" in names
    assert "llmin_to_zero" in names
    assert "max_to_min" in names


def test_each_mutation_differs_and_single_site():
    std_lines = STD.split("\n")
    for op, site, mutated in apply_mutations(STD):
        assert mutated != STD, f"{op.name} 未产生变化"
        diff_lines = [
            (a, b) for a, b in zip(std_lines, mutated.split("\n")) if a != b
        ]
        assert len(diff_lines) == 1, f"{op.name} 应只改动一行"
        assert op.category in MutantCategory or isinstance(op.category, MutantCategory)


def test_for_headers_not_mutated():
    for _op, _site, mutated in apply_mutations(STD):
        assert "for (int i = 0; i <= n" not in mutated
        assert "#include <=" not in mutated


def test_max_sites_respected():
    results = apply_mutations(STD)
    counts: dict[str, int] = {}
    for op, _site, _code in results:
        counts[op.name] = counts.get(op.name, 0) + 1
    for name, cnt in counts.items():
        op = next(o for o in apply_mutations(STD) if o[0].name == name)[0]
        assert cnt <= op.max_sites


def test_source_without_sites_yields_nothing():
    plain = "int main() { return 0; }\n"
    assert apply_mutations(plain) == []
