from acmforge.checker import compare_outputs, tokens


def test_exact_match():
    ok, why = compare_outputs("1 2 3\n", "1  2\n3\n")
    assert ok


def test_token_count_mismatch():
    ok, why = compare_outputs("1 2", "1 2 3")
    assert not ok
    assert "token 数" in why


def test_float_tolerance():
    ok, _ = compare_outputs("0.1 2.0", "0.1000001 2.0000001")
    assert ok


def test_float_out_of_tolerance():
    ok, why = compare_outputs("0.5", "0.6")
    assert not ok


def test_negative_numbers():
    ok, _ = compare_outputs("-9223372036854775808", "-9223372036854775808")
    assert ok


def test_tokens_helper():
    assert tokens("a  b\nc") == ["a", "b", "c"]
