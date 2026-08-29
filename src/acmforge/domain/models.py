"""核心领域模型（Pydantic v2）。

规则：
- Agent 的所有结构化输出、节点间传递的数据，都必须经过这里的模型校验。
- ProblemSpec 是题目的 Single Source of Truth。
"""

from __future__ import annotations

import re
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

_SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,63}$")


# ---------------------------------------------------------------------------
# 枚举
# ---------------------------------------------------------------------------


class SolutionRole(str, Enum):
    """解的角色。STD/BRUTE 是正确解，其余是必须被测试集击杀的错误解。"""

    STD = "std"
    BRUTE = "brute"
    WA = "wa"
    TLE = "tle"
    MLE = "mle"


class Verdict(str, Enum):
    AC = "AC"
    WA = "WA"
    TLE = "TLE"
    MLE = "MLE"
    RE = "RE"
    CE = "CE"


class MutantCategory(str, Enum):
    BOUNDARY = "BOUNDARY"
    OVERFLOW = "OVERFLOW"
    WRONG_GREEDY = "WRONG_GREEDY"
    WRONG_TRANSITION = "WRONG_TRANSITION"
    MISSING_CASE = "MISSING_CASE"
    TLE = "TLE"
    MLE = "MLE"
    IMPLEMENTATION_BUG = "IMPLEMENTATION_BUG"


class NodeStatus(str, Enum):
    OK = "ok"
    FAIL = "fail"
    SKIP = "skip"


class RunStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    REJECTED = "rejected"


class ArtifactType(str, Enum):
    SOURCE_CODE = "source_code"
    GEN = "gen"
    TESTCASE = "testcase"
    COUNTEREXAMPLE = "counterexample"
    STATEMENT = "statement"
    EDITORIAL = "editorial"
    REVIEW = "review"
    REPORT = "report"
    CONFIG = "config"
    PACKAGE = "package"


# ---------------------------------------------------------------------------
# ProblemSpec 相关
# ---------------------------------------------------------------------------


class Complexity(BaseModel):
    time: str = ""
    memory: str = ""


class ResourceLimit(BaseModel):
    time_ms: int = Field(default=2000, gt=0)
    memory_mb: int = Field(default=256, gt=0)


class ProblemTarget(BaseModel):
    rating: int | None = None
    tags: list[str] = Field(default_factory=list)


class IntendedSolution(BaseModel):
    """意图解法：editorial 与审题都以它为依据。"""

    observations: list[str] = Field(default_factory=list)
    algorithm: list[str] = Field(default_factory=list)
    proof_outline: list[str] = Field(default_factory=list)
    complexity: Complexity = Field(default_factory=Complexity)


class ConstraintItem(BaseModel):
    name: str
    description: str


class Constraints(BaseModel):
    """constraints.items 是给人看的约束描述；bounds 是机器可读的边界。

    bounds 采用统一约定（MVP 针对序列类题目）：
      "n": [1, 200000]      主规模变量的 [min, max]
      "value": [-1e9, 1e9]  元素取值范围
    """

    items: list[ConstraintItem] = Field(default_factory=list)
    bounds: dict[str, list[float]] = Field(default_factory=dict)
    notes: str | None = None


class SampleCase(BaseModel):
    input: str
    # 可以为空：样例答案一律由 brute 程序计算生成（防幻觉规则），绝不手写。
    expected_output: str | None = None
    note: str | None = None


class ProblemAssets(BaseModel):
    """离线导入模式：题目自带的已写好代码（相对 problem.yaml 的路径）。

    全部可缺省 —— 缺的部分在 LLM 模式下由 Agent 生成；offline 模式必须齐全。
    """

    std: str | None = None
    brute: str | None = None
    gen: str | None = None
    mutants: list[dict[str, Any]] = Field(default_factory=list)


class ProblemSpec(BaseModel):
    model_config = ConfigDict(validate_assignment=True)

    version: str = "1"
    slug: str
    title: str
    language: str = "zh"

    target: ProblemTarget = Field(default_factory=ProblemTarget)
    summary: str = ""
    story: str | None = None

    # 形式化定义（single source of truth）
    task: str
    input_format: str
    output_format: str
    constraints: Constraints = Field(default_factory=Constraints)
    samples: list[SampleCase] = Field(default_factory=list)
    intended_solution: IntendedSolution = Field(default_factory=IntendedSolution)
    limits: ResourceLimit = Field(default_factory=ResourceLimit)

    # 预留：SPJ / 自定义 checker（v0.1 只支持 default 精确匹配 checker）
    checker: Literal["default", "custom"] = "default"
    spj: bool = False

    # 预留：Idea 出处（对接未来的 S0 idea 库 / NoveltyChecker）
    source_idea: str | None = None

    assets: ProblemAssets = Field(default_factory=ProblemAssets)
    notes: str | None = None

    @field_validator("slug")
    @classmethod
    def _slug_ok(cls, v: str) -> str:
        if not _SLUG_RE.match(v):
            raise ValueError(f"slug 必须匹配 {_SLUG_RE.pattern}，得到: {v!r}")
        return v

    @field_validator("title", "task", "input_format", "output_format")
    @classmethod
    def _non_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("题目的 task/input_format/output_format 不能为空")
        return v

    @model_validator(mode="after")
    def _samples_exist(self) -> "ProblemSpec":
        if not self.samples:
            raise ValueError("至少需要一个样例 samples")
        return self


# ---------------------------------------------------------------------------
# 解与变异体
# ---------------------------------------------------------------------------


class SolutionCandidate(BaseModel):
    """一道解（std/brute）或一个变异体（wa/tle/mle）的统一记录。"""

    id: str
    role: SolutionRole
    language: str = "cpp20"
    code: str = ""
    # 相对 run 目录的路径
    path: str | None = None
    origin: str = "import"  # import | llm | mutation
    origin_detail: str = ""
    category: MutantCategory | None = None
    description: str = ""
    expected_verdict: Verdict | None = None
    idea_summary: str = ""
    claimed_complexity: Complexity | None = None

    # 编译信息（由 Runner 回填，Agent 无权写入）
    compile_ok: bool | None = None
    compile_stderr: str = ""
    exe_path: str | None = None
    enabled: bool = True


class MutantSpec(BaseModel):
    id: str
    category: MutantCategory
    description: str
    origin: str = "import"
    expected_verdict: Verdict = Verdict.WA


# ---------------------------------------------------------------------------
# 测试策略与数据
# ---------------------------------------------------------------------------


class TestStrategy(BaseModel):
    """TestDesigner 只输出策略；真正生成数据由确定性的 generator 完成。"""

    name: str
    purpose: str = ""
    mode: str  # gen.py --mode 的取值
    params: dict[str, Any] = Field(default_factory=dict)
    seeds: list[int] = Field(default_factory=list)
    count: int = Field(default=1, ge=1)
    # 评估优先级：越高的越先跑（max/对抗类应最高）
    priority: int = 0
    target_mutants: list[str] = Field(default_factory=list)
    origin: str = "builtin"  # builtin | llm | assets


class TestCaseRecord(BaseModel):
    id: str
    strategy: str
    mode: str
    params: dict[str, Any] = Field(default_factory=dict)
    seed: int
    input_path: str
    answer_path: str
    input_sha256: str = ""
    answer_sha256: str = ""
    size_bytes: int = 0
    # 评估优先级：越大的越先被拿去测试变异体（对抗类应最大）
    priority: int = 0
    gen_ok: bool = True


# ---------------------------------------------------------------------------
# 执行与击杀
# ---------------------------------------------------------------------------


class ExecutionResult(BaseModel):
    verdict: Verdict
    exit_code: int | None = None
    runtime_ms: float = 0.0
    memory_kb: int | None = None
    stdout: str = ""
    stderr: str = ""
    timed_out: bool = False
    output_truncated: bool = False


class KillRecord(BaseModel):
    testcase_id: str
    solution_id: str
    verdict: Verdict
    runtime_ms: float = 0.0
    memory_kb: int | None = None
    killed: bool  # verdict != AC


class SelectionResult(BaseModel):
    selected_ids: list[str]
    must_include_ids: list[str] = Field(default_factory=list)
    coverage: dict[str, list[str]] = Field(default_factory=dict)  # mutant -> killing tests
    unkillable: list[str] = Field(default_factory=list)
    kill_rate: float = 0.0
    rounds: int = 1


# ---------------------------------------------------------------------------
# 基准 / 审校 / 报告
# ---------------------------------------------------------------------------


class BenchmarkPoint(BaseModel):
    testcase_id: str
    median_ms: float
    max_ms: float
    memory_kb: int | None = None


class BenchmarkResult(BaseModel):
    points: list[BenchmarkPoint] = Field(default_factory=list)
    std_max_ms: float = 0.0
    time_limit_ms: int = 0
    margin_ratio: float = 0.0  # std_max_ms / time_limit_ms，须 <= std_target_ratio
    passed: bool = False


class ReviewCheck(BaseModel):
    name: str
    passed: bool
    detail: str = ""


class ReviewReport(BaseModel):
    checks: list[ReviewCheck] = Field(default_factory=list)
    passed: bool = False
    reviewer: str = "deterministic"
    notes: str = ""


class QualityReport(BaseModel):
    """最重要的产品指标（不是"生成了一份题面"）。"""

    slug: str
    run_id: str
    compile_passed: bool = False
    differential_cases: int = 0
    differential_mismatches: int = 0
    counterexamples: int = 0
    std_version: int = 0
    mutant_total: int = 0
    mutant_killed: int = 0
    kill_rate: float = 0.0
    tle_mutant_total: int = 0
    tle_mutant_killed: int = 0
    final_test_count: int = 0
    std_max_ms: float = 0.0
    time_limit_ms: int = 0
    std_margin_ratio: float = 0.0
    benchmark_passed: bool = False
    statement_review_passed: bool = False
    decision: Literal["accept", "reject", "needs_review"] = "needs_review"
    warnings: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Workflow / Artifact
# ---------------------------------------------------------------------------


class ArtifactRef(BaseModel):
    id: str
    type: ArtifactType
    path: str  # 相对 run 目录
    sha256: str
    producer: str
    created_at: str


class NodeResult(BaseModel):
    status: NodeStatus = NodeStatus.OK
    metrics: dict[str, Any] = Field(default_factory=dict)
    artifacts: list[ArtifactRef] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    error: str | None = None


class AgentOutput(BaseModel):
    """Agent 返回的统一信封：data 是具体的 Pydantic 模型（dict 形式）。"""

    agent: str
    ok: bool
    data: dict[str, Any] = Field(default_factory=dict)
    meta: dict[str, Any] = Field(default_factory=dict)
