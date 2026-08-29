"""共享 fixtures。"""

from __future__ import annotations

from pathlib import Path

import pytest

from acmforge.config import AppConfig
from acmforge.runner.compiler import Compiler, find_gxx
from acmforge.workspace import Workspace

EXAMPLE_DIR = Path(__file__).resolve().parents[1] / "examples" / "max-subarray-sum"


def _gxx_available() -> bool:
    try:
        return bool(find_gxx(None))
    except Exception:
        return False


HAVE_GXX = _gxx_available()


@pytest.fixture(scope="session")
def gxx():
    """模块级使用 pytestmark = pytest.mark.usefixtures("gxx") 实现条件跳过。"""
    if not HAVE_GXX:
        pytest.skip("需要 g++ 编译器")
    return find_gxx(None)


@pytest.fixture()
def cfg(tmp_path: Path) -> AppConfig:
    c = AppConfig()
    c.workspace_dir = str(tmp_path / "workspace")
    # 冒烟参数，保证集成测试在 1 分钟内完成
    c.fuzz.smoke_cases = 30
    c.fuzz.small_n = 12
    c.tests.candidate_batch = 8
    c.tests.per_mutant_eval_budget = 18
    c.benchmark.repeats = 1
    c.benchmark.warmup = 0
    return c


@pytest.fixture()
def ws(cfg: AppConfig, tmp_path: Path) -> Workspace:
    return Workspace.create(Path(cfg.workspace_dir), "max-subarray-sum")


@pytest.fixture()
def compiler(cfg: AppConfig, gxx) -> Compiler:
    return Compiler(cfg.runner)


@pytest.fixture()
def example_dir() -> Path:
    return EXAMPLE_DIR
