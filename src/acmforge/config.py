"""配置加载：代码内置默认 -> configs/default.yaml -> ACMFORGE_CONFIG 指定文件 -> CLI 覆盖。"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, ConfigDict, Field

from acmforge.domain.errors import ConfigError


class LLMConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")
    base_url: str = "https://open.bigmodel.cn/api/paas/v4"
    api_key_env: str = "ACMFORGE_API_KEY"
    api_key: str | None = None  # 也可直接写进配置文件（不推荐，勿提交）
    model: str = "glm-4.6"
    temperature: float = 0.3
    max_retries: int = 3
    timeout_s: int = 300

    def resolve_api_key(self) -> str | None:
        if self.api_key:
            return self.api_key
        env_name = self.api_key_env or "ACMFORGE_API_KEY"
        return os.environ.get(env_name) or os.environ.get("OPENAI_API_KEY")

    def is_enabled(self) -> bool:
        return bool(self.resolve_api_key())


class RunnerConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    compiler_path: str | None = None
    compile_timeout_ms: int = 60000
    extra_flags: list[str] = Field(default_factory=lambda: ["-O2", "-std=c++20", "-pipe"])


class FuzzConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    smoke_cases: int = 300
    small_n: int = 50
    seed: int = 42
    shrink: bool = True
    shrink_max_evals: int = 200
    # P0-7：有效性门禁 —— 有效 case 占比不足或 oracle 失败过多时必须 FAIL
    min_success_ratio: float = 0.95
    max_oracle_errors: int = 0
    # P0-8：每个 generator 模式的最少覆盖 case 数（暴力可缩小的模式）
    per_mode_cases: int = 20
    # P0-9：repair 之后的 fresh / holdout 对拍（seed 偏移保证互不重叠）
    fresh_cases_after_repair: int = 300
    holdout_cases_after_repair: int = 200
    fresh_seed_offset: int = 7_000_000
    holdout_seed_offset: int = 9_000_000


class MutantsConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_mutations: bool = True
    llm_count: int = 6
    max_total: int = 24


class TestsConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    candidate_batch: int = 30
    min_kill_rate: float = 0.95
    max_rounds: int = 3
    per_mutant_eval_budget: int = 40
    enforce_kill_rate: bool = False


class BenchmarkConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    repeats: int = 3
    warmup: int = 1
    std_target_ratio: float = 0.5
    enforce_std_margin: bool = True


class RepairConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    max_attempts: int = 3


class AppConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")
    llm: LLMConfig = Field(default_factory=LLMConfig)
    runner: RunnerConfig = Field(default_factory=RunnerConfig)
    fuzz: FuzzConfig = Field(default_factory=FuzzConfig)
    mutants: MutantsConfig = Field(default_factory=MutantsConfig)
    tests: TestsConfig = Field(default_factory=TestsConfig)
    benchmark: BenchmarkConfig = Field(default_factory=BenchmarkConfig)
    repair: RepairConfig = Field(default_factory=RepairConfig)
    workspace_dir: str = "workspace"
    offline: bool = False  # CLI --offline 透传：禁用一切 LLM 调用


_BUILTIN_DEFAULTS = AppConfig()

# 内置默认 -> 项目根 configs/default.yaml -> ACMFORGE_CONFIG -> 显式路径
_SEARCH_PATHS = (
    Path("configs/default.yaml"),
    Path(__file__).resolve().parents[2] / "configs" / "default.yaml",
)


def load_config(explicit_path: str | Path | None = None, offline: bool = False) -> AppConfig:
    """加载配置。显式路径 > ACMFORGE_CONFIG 环境变量 > 就近的 configs/default.yaml > 内置默认。"""
    candidates: list[Path] = []
    if explicit_path:
        candidates.append(Path(explicit_path))
    env_path = os.environ.get("ACMFORGE_CONFIG")
    if env_path:
        candidates.append(Path(env_path))
    candidates.extend(_SEARCH_PATHS)

    data: dict[str, Any] = {}
    used: Path | None = None
    for path in candidates:
        if path.is_file():
            try:
                with open(path, "r", encoding="utf-8") as f:
                    loaded = yaml.safe_load(f) or {}
            except yaml.YAMLError as e:
                raise ConfigError(f"配置文件 {path} 不是合法 YAML: {e}") from e
            if not isinstance(loaded, dict):
                raise ConfigError(f"配置文件 {path} 顶层必须是映射")
            data = loaded
            used = path
            break

    if offline:
        data = {**data, "offline": True}

    try:
        cfg = AppConfig(**data)
    except Exception as e:  # pydantic ValidationError
        raise ConfigError(f"配置校验失败（来源 {used or '内置默认'}）: {e}") from e
    return cfg
