from pathlib import Path

import yaml

from acmforge.config import AppConfig, load_config
from acmforge.domain.errors import ConfigError


def test_defaults():
    cfg = AppConfig()
    assert cfg.fuzz.seed == 42
    assert cfg.tests.min_kill_rate == 0.95
    assert cfg.workspace_dir == "workspace"


def test_yaml_override(tmp_path: Path):
    p = tmp_path / "cfg.yaml"
    p.write_text(
        yaml.safe_dump({"fuzz": {"smoke_cases": 7, "seed": 99}, "workspace_dir": "ws2"}),
        encoding="utf-8",
    )
    cfg = load_config(p)
    assert cfg.fuzz.smoke_cases == 7
    assert cfg.fuzz.seed == 99
    assert cfg.workspace_dir == "ws2"
    # 未覆盖的键保留默认
    assert cfg.tests.min_kill_rate == 0.95


def test_invalid_yaml_raises(tmp_path: Path):
    p = tmp_path / "bad.yaml"
    p.write_text("fuzz: [unclosed", encoding="utf-8")
    try:
        load_config(p)
    except ConfigError:
        pass
    else:
        raise AssertionError("应当抛出 ConfigError")


def test_unknown_key_rejected(tmp_path: Path):
    p = tmp_path / "cfg.yaml"
    p.write_text("no_such_section: 1", encoding="utf-8")
    try:
        load_config(p)
    except ConfigError:
        pass
    else:
        raise AssertionError("未知配置键应当报错")
