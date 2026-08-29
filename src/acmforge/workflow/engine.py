"""确定性 Workflow 引擎：顺序执行 Node，状态落盘，支持 --until / 断点续跑。

原则：Agent = Think，Orchestrator = Decide，Runner = Execute。
Workflow 状态只由本引擎修改，Agent 无权干预。
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from acmforge.console import get_logger
from acmforge.domain.errors import WorkflowError
from acmforge.domain.models import NodeResult, NodeStatus, RunStatus
from acmforge.util import now_iso

logger = get_logger("acmforge.workflow")


@dataclass
class Node:
    name: str
    fn: Callable[[object], NodeResult]
    # 失败时是否终止整个流水线（默认终止）
    critical: bool = True


class WorkflowEngine:
    def __init__(self, nodes: list[Node], ctx, node_order: list[str] | None = None):
        self.nodes = nodes
        self.ctx = ctx
        self.order = node_order or [n.name for n in nodes]

    # ------------------------------------------------------------------

    def _load_state(self) -> dict:
        state = self.ctx.ws.read_state()
        if not state:
            state = {
                "run_id": self.ctx.ws.run_id,
                "slug": self.ctx.ws.slug,
                "status": RunStatus.PENDING.value,
                "node_order": self.order,
                "nodes": {},
                "started_at": now_iso(),
                "updated_at": now_iso(),
            }
        return state

    def _save_state(self, state: dict) -> None:
        state["updated_at"] = now_iso()
        self.ctx.ws.write_state(state)

    def run(self, until: str | None = None, from_node: str | None = None) -> RunStatus:
        state = self._load_state()
        nodes_by_name = {n.name: n for n in self.nodes}
        for name in self.order:
            if name not in nodes_by_name:
                raise WorkflowError(f"未知节点: {name}")

        if from_node and from_node not in self.order:
            raise WorkflowError(f"--from 节点不存在: {from_node}（可用: {', '.join(self.order)}）")
        if until and until not in self.order:
            raise WorkflowError(f"--until 节点不存在: {until}（可用: {', '.join(self.order)}）")

        state["status"] = RunStatus.RUNNING.value
        self._save_state(state)

        started = False
        for name in self.order:
            if from_node and not started:
                started = name == from_node
                if not started:
                    continue
            if until and name == until:
                pass  # 本节点仍执行，执行完即停

            node = nodes_by_name[name]
            prev = state["nodes"].get(name, {})
            if prev.get("status") == NodeStatus.OK.value and not from_node:
                logger.info("skip completed node: %s", name)
                continue

            logger.info("=== node: %s ===", name)
            node_state = {"started_at": now_iso()}
            try:
                result: NodeResult = node.fn(self.ctx)
            except Exception as e:  # 节点内未捕获异常 => FAIL（带栈摘要）
                logger.exception("node %s crashed", name)
                result = NodeResult(
                    status=NodeStatus.FAIL,
                    error=f"{type(e).__name__}: {e}",
                )

            node_state.update(
                {
                    "status": result.status.value,
                    "metrics": result.metrics,
                    "warnings": result.warnings,
                    "error": result.error,
                    "finished_at": now_iso(),
                }
            )
            state["nodes"][name] = node_state

            for w in result.warnings:
                logger.warning("[%s] %s", name, w)

            if result.status == NodeStatus.FAIL:
                state["status"] = RunStatus.FAILED.value
                state["failed_node"] = name
                self._save_state(state)
                logger.error("node %s FAILED: %s", name, result.error)
                return RunStatus.FAILED

            self._save_state(state)

            if until and name == until:
                logger.info("reached --until %s, stop here", until)
                state["status"] = RunStatus.COMPLETED.value  # 部分完成也视为本次运行成功结束
                state["stopped_at"] = until
                self._save_state(state)
                return RunStatus.COMPLETED

        state["status"] = RunStatus.COMPLETED.value
        self._save_state(state)
        return RunStatus.COMPLETED
