"""P0-2 回归：BuiltinValidator 行为。"""

from acmforge.domain.models import ProblemSpec
from acmforge.validator import BuiltinValidator


def _spec(bounds: dict | None) -> ProblemSpec:
    data = {
        "slug": "v",
        "title": "t",
        "task": "求和",
        "input_format": "n\na",
        "output_format": "s",
        "samples": [{"input": "1\n1\n"}],
    }
    if bounds is not None:
        data["constraints"] = {"bounds": bounds}
    return ProblemSpec(**data)


V = BuiltinValidator()


def test_empty_input_fails():
    r = V.validate("   \n", _spec({"n": [1, 10]}))
    assert r.status == "fail" and not r.valid


def test_n_out_of_range_fails():
    spec = _spec({"n": [1, 5]})
    r = V.validate("100\n1 2 3\n", spec)
    assert r.status == "fail" and "bounds.n" in r.reason


def test_n_in_range_passes():
    spec = _spec({"n": [1, 5], "value": [-10, 10]})
    r = V.validate("3\n1 -2 3\n", spec)
    assert r.status == "pass" and r.valid


def test_value_out_of_range_fails():
    spec = _spec({"n": [1, 100], "value": [-10, 10]})
    r = V.validate("3\n1 -2 999999999\n", spec)
    assert r.status == "fail" and "bounds.value" in r.reason


def test_shrunk_input_losing_n_line_is_caught_when_detectable():
    """收缩器删掉 n 行后，若剩余首 token 超出 n 范围必须拒绝。"""
    spec = _spec({"n": [1, 5], "value": [-10, 10]})
    # 原输入 "3\n1 -2 3" 删掉 n 行后首 token 变成 1（恰好在范围内 —— 说明 builtin 有局限）
    # 但值越界的情形必须被抓住：
    r = V.validate("999999\n1 2\n", spec)
    assert r.status == "fail"


def test_non_integer_tokens_unknown():
    spec = _spec({"n": [1, 10]})
    r = V.validate("3\na b c\n", spec)
    assert r.status == "unknown" and not r.valid


def test_multi_token_first_line_skips_n_check():
    """第一行多 token（如 n q / n s）无法确证 n 位置 => 不做 n 检查。"""
    spec = _spec({"n": [1, 5]})
    r = V.validate("100 100\n1 2\n", spec)
    assert r.status == "unknown"


def test_no_applicable_checks_unknown():
    spec = _spec(None)
    r = V.validate("3\n1 2 3\n", spec)
    assert r.status == "unknown"
