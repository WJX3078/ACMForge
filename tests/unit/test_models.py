import pytest
from pydantic import ValidationError

from acmforge.domain.models import ProblemSpec


def _base_spec() -> dict:
    return {
        "slug": "test-problem",
        "title": "测试题",
        "task": "求最大值",
        "input_format": "第一行 n",
        "output_format": "输出答案",
        "samples": [{"input": "1\n1\n"}],
    }


def test_minimal_spec_ok():
    spec = ProblemSpec(**_base_spec())
    assert spec.slug == "test-problem"
    assert spec.limits.time_ms == 2000
    assert spec.checker == "default"


def test_slug_pattern_enforced():
    data = _base_spec()
    data["slug"] = "Bad Slug!"
    with pytest.raises(ValidationError):
        ProblemSpec(**data)


def test_samples_required():
    data = _base_spec()
    data["samples"] = []
    with pytest.raises(ValidationError):
        ProblemSpec(**data)


def test_task_required():
    data = _base_spec()
    data["task"] = "  "
    with pytest.raises(ValidationError):
        ProblemSpec(**data)


def test_limits_positive():
    data = _base_spec()
    data["limits"] = {"time_ms": -5}
    with pytest.raises(ValidationError):
        ProblemSpec(**data)


def test_example_spec_loads(example_dir):
    import yaml

    data = yaml.safe_load((example_dir / "problem.yaml").read_text(encoding="utf-8"))
    spec = ProblemSpec(**data)
    assert spec.slug == "max-subarray-sum"
    assert len(spec.samples) == 3
    assert spec.constraints.bounds["n"] == [1, 200000]
    assert spec.assets.std is not None
    assert len(spec.assets.mutants) == 3
