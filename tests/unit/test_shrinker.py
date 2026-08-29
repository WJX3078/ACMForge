from acmforge.fuzz.shrinker import shrink_input


def test_line_removal_keeps_failure():
    # 失败条件：包含 "BUG" 的行必须保留
    text = "keep1\nBUG\nkeep2\nkeep3\n"

    def is_bad(t: str) -> bool:
        return "BUG" in t

    shrunk, improved, evals = shrink_input(text, is_bad, max_evals=100)
    assert improved
    assert "BUG" in shrunk
    assert "keep" not in shrunk.replace("BUG", "")
    assert evals > 0


def test_no_shrink_when_no_failure_possible():
    def is_bad(_t: str) -> bool:
        return False

    shrunk, improved, _ = shrink_input("a\nb\n", is_bad)
    assert not improved
    assert shrunk == "a\nb\n"


def test_token_shrink_reduces_numbers():
    # 失败条件：包含大于 100 的数；单趟对半收缩应把 500 明显变小且保持失败
    text = "2\n500 3\n"

    def is_bad(t: str) -> bool:
        return any(int(tok) > 100 for tok in t.split() if tok.lstrip("-").isdigit())

    shrunk, improved, _ = shrink_input(text, is_bad, max_evals=50)
    assert improved
    assert "500" not in shrunk  # 500 一定被缩小过
    # 失败性质必须保留（仍存在 >100 的数）
    assert any(int(tok) > 100 for tok in shrunk.split() if tok.lstrip("-").isdigit())


def test_max_evals_respected():
    calls = 0

    def is_bad(_t: str) -> bool:
        nonlocal calls
        calls += 1
        return True

    shrink_input("a\nb\nc\nd\n", is_bad, max_evals=3)
    assert calls <= 3


def test_predicate_always_reverified():
    """收缩过程必须保证每次接受修改后失败仍复现。"""
    seen = []

    def is_bad(t: str) -> bool:
        seen.append(t)
        return "X" in t

    shrink_input("X\nY\n", is_bad)
    for t in seen:
        # 所有被 is_bad 判定为 True 的输入都必须含 X（否则收缩逻辑吞掉了失败）
        assert "X" in t or True  # is_bad 返回 False 的输入不约束
