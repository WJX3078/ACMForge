"""P0-3 回归：默认 checker 必须是 token 级精确比较，浮点容差仅显式启用。"""

from acmforge.checkers import ExactTokenChecker, FloatChecker, make_checker
from acmforge.checker import compare_outputs
from acmforge.domain.models import CheckerConfig


def test_exact_checker_rejects_near_integer():
    """核心回归：整数题绝不能因浮点容差被误判 AC。"""
    c = ExactTokenChecker()
    ok, why = c.compare("1000000", "1000000.5")
    assert not ok
    assert "token" in why


def test_exact_checker_rejects_leading_zeros():
    c = ExactTokenChecker()
    ok, _ = c.compare("001", "1")
    assert not ok


def test_exact_checker_accepts_whitespace_difference():
    c = ExactTokenChecker()
    ok, _ = c.compare("1  2\n3\n", "1 2 3")
    assert ok


def test_exact_checker_rejects_token_count_mismatch():
    c = ExactTokenChecker()
    ok, why = c.compare("1 2", "1 2 3")
    assert not ok
    assert "token 数" in why


def test_float_checker_accepts_small_error():
    c = FloatChecker(abs_eps=1e-6, rel_eps=1e-6)
    ok, _ = c.compare("0.1 2.0", "0.1000001 2.0000001")
    assert ok


def test_float_checker_rejects_large_error():
    c = FloatChecker(abs_eps=1e-6, rel_eps=1e-6)
    ok, why = c.compare("0.5", "0.6")
    assert not ok
    assert "超差" in why


def test_float_checker_rejects_near_integer_under_tight_eps():
    c = FloatChecker(abs_eps=1e-9, rel_eps=1e-9)
    ok, _ = c.compare("1000000", "1000000.5")
    assert not ok


def test_module_default_is_exact():
    """compare_outputs 的默认语义必须与 ExactTokenChecker 一致。"""
    ok, _ = compare_outputs("1000000", "1000000.5")
    assert not ok
    ok, _ = compare_outputs("1  2\n3\n", "1 2 3")
    assert ok


def test_make_checker_from_spec_config():
    assert make_checker("default").name == "exact"
    assert make_checker(None).name == "exact"
    assert make_checker(CheckerConfig(type="exact")).name == "exact"
    fc = make_checker(CheckerConfig(type="float", abs_eps=1e-3, rel_eps=1e-3))
    assert fc.name == "float"
    assert fc.abs_eps == 1e-3
