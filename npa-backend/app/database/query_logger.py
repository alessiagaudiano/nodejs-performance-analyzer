from __future__ import annotations

import time
import uuid
from contextvars import ContextVar
from typing import Optional

from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlalchemy.ext.asyncio import AsyncEngine

# Request-scoped id to correlate queries to a specific API call
request_id_var: ContextVar[Optional[str]] = ContextVar("request_id", default=None)


def new_request_id() -> str:
    return uuid.uuid4().hex[:8]


def install_query_logger(engine: AsyncEngine | Engine) -> None:
    """Attach before/after cursor hooks to print SQL with timings.

    Works with both AsyncEngine (by using its sync_engine) and Engine.
    """
    # Resolve to a sync Engine when given AsyncEngine
    sync_engine: Engine
    if hasattr(engine, "sync_engine"):
        sync_engine = getattr(engine, "sync_engine")  # type: ignore[assignment]
    else:
        sync_engine = engine  # type: ignore[assignment]

    @event.listens_for(sync_engine, "before_cursor_execute")
    def _before_execute(conn, cursor, statement, parameters, context, executemany):  # noqa: D401
        rid = request_id_var.get() or "-"
        context._query_start_time = time.perf_counter()  # noqa: SLF001
        print(f"[DB {rid}] SQL: {statement}")
        if parameters:
            try:
                print(f"[DB {rid}] PAR: {parameters}")
            except Exception:
=                pass

    @event.listens_for(sync_engine, "after_cursor_execute")
    def _after_execute(conn, cursor, statement, parameters, context, executemany):  # noqa: D401
        rid = request_id_var.get() or "-"
        start = getattr(context, "_query_start_time", None)
        if start is not None:
            elapsed_ms = (time.perf_counter() - start) * 1000.0
            print(f"[DB {rid}] OK in {elapsed_ms:.1f} ms")
        else:
            print(f"[DB {rid}] OK")

