"""流水线组装：节点顺序定义（--until / --from 使用的名字）。"""

from __future__ import annotations

from acmforge.workflow.engine import Node, WorkflowEngine
from acmforge.workflow.nodes import (
    NodeContext,
    node_compile_solutions,
    node_design_tests,
    node_differential_fuzz,
    node_generate_candidates,
    node_generate_mutants,
    node_kill_matrix,
    node_load_spec,
    node_prepare_solutions,
    node_final_verify,
    node_select_tests,
)

NODE_NAMES = [
    "load_spec",
    "prepare_solutions",
    "compile_solutions",
    "differential_fuzz",
    "generate_mutants",
    "design_tests",
    "generate_candidates",
    "kill_matrix",
    "select_tests",
    "final_verify",
    "generate_content",
    "package",
]


def build_engine(ctx: NodeContext) -> WorkflowEngine:
    from acmforge.workflow.content import node_generate_content
    from acmforge.packaging import node_package

    nodes = [
        Node("load_spec", node_load_spec),
        Node("prepare_solutions", node_prepare_solutions),
        Node("compile_solutions", node_compile_solutions),
        Node("differential_fuzz", node_differential_fuzz),
        Node("generate_mutants", node_generate_mutants),
        Node("design_tests", node_design_tests),
        Node("generate_candidates", node_generate_candidates),
        Node("kill_matrix", node_kill_matrix),
        Node("select_tests", node_select_tests),
        Node("final_verify", node_final_verify),
        Node("generate_content", node_generate_content),
        Node("package", node_package),
    ]
    return WorkflowEngine(nodes, ctx, NODE_NAMES)


__all__ = ["NODE_NAMES", "NodeContext", "WorkflowEngine", "build_engine"]
