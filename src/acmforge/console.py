"""日志与控制台输出。

- 统一 logging，关键实体（run_id / node / solution_id / testcase_id）都进日志上下文。
- Windows 控制台默认 GBK，这里强制 stdout/stderr 走 UTF-8（带替换，避免崩溃）。
- 绝不打印 API Key / 完整 prompt / 大量测试数据。
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path

_CONFIGURED = False


def setup_console() -> None:
    global _CONFIGURED
    if _CONFIGURED:
        return
    for stream in (sys.stdout, sys.stderr):
        if stream is not None and hasattr(stream, "reconfigure"):
            try:
                stream.reconfigure(encoding="utf-8", errors="replace")
            except Exception:  # pragma: no cover
                pass
    _CONFIGURED = True


def get_logger(name: str = "acmforge") -> logging.Logger:
    setup_console()
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stderr)
        handler.setFormatter(
            logging.Formatter("%(asctime)s %(levelname)-7s %(name)s: %(message)s", "%H:%M:%S")
        )
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
        logger.propagate = False
    return logger


def attach_file_logger(logger: logging.Logger, log_path: Path) -> None:
    """把 run 日志同时写入文件（logs/run.log）。"""
    log_path.parent.mkdir(parents=True, exist_ok=True)
    for h in logger.handlers:
        if getattr(h, "_acmforge_file", None) == str(log_path):
            return
    handler = logging.FileHandler(log_path, encoding="utf-8")
    handler.setFormatter(
        logging.Formatter("%(asctime)s %(levelname)-7s %(name)s: %(message)s")
    )
    handler._acmforge_file = str(log_path)  # type: ignore[attr-defined]
    logger.addHandler(handler)
