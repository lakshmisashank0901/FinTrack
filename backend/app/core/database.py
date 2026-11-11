"""PostgreSQL access.

The API logs in as a role without privileges of its own. Each request runs in
one database transaction that switches to the `authenticated` role and sets
the verified JWT claims, so Supabase Row Level Security (auth.uid()) applies
to every statement. Repositories additionally filter by user_id explicitly.
"""
import json
from collections.abc import Iterator, Sequence
from contextlib import contextmanager
from typing import Any
from uuid import UUID

from psycopg import Connection
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from app.core.config import Settings

_pool: ConnectionPool | None = None


def open_pool(settings: Settings) -> ConnectionPool:
    global _pool
    if _pool is None:
        _pool = ConnectionPool(
            settings.database_url,
            min_size=settings.db_pool_min_size,
            max_size=settings.db_pool_max_size,
            # prepare_threshold=None keeps us compatible with transaction-mode poolers (Supavisor).
            kwargs={"row_factory": dict_row, "prepare_threshold": None, "autocommit": False},
            open=True,
        )
    return _pool


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


def get_pool() -> ConnectionPool:
    if _pool is None:
        raise RuntimeError("Database pool is not open")
    return _pool


class Db:
    """A user-scoped handle on a connection inside an open transaction."""

    def __init__(self, conn: Connection, user_id: UUID) -> None:
        self.conn = conn
        self.user_id = user_id

    def all(self, sql: str, params: Sequence[Any] | dict[str, Any] | None = None) -> list[dict[str, Any]]:
        return self.conn.execute(sql, params).fetchall()  # type: ignore[return-value]

    def one(self, sql: str, params: Sequence[Any] | dict[str, Any] | None = None) -> dict[str, Any] | None:
        return self.conn.execute(sql, params).fetchone()  # type: ignore[return-value]

    def scalar(self, sql: str, params: Sequence[Any] | dict[str, Any] | None = None) -> Any:
        row = self.conn.execute(sql, params).fetchone()
        return None if row is None else next(iter(row.values()))  # type: ignore[union-attr]

    def execute(self, sql: str, params: Sequence[Any] | dict[str, Any] | None = None) -> int:
        return self.conn.execute(sql, params).rowcount

    @contextmanager
    def savepoint(self) -> Iterator[None]:
        with self.conn.transaction():
            yield


@contextmanager
def user_transaction(user_id: UUID, claims: dict[str, Any]) -> Iterator[Db]:
    with get_pool().connection() as conn:
        with conn.transaction():
            conn.execute("set local role authenticated")
            conn.execute(
                "select set_config('request.jwt.claims', %s, true), "
                "set_config('request.jwt.claim.sub', %s, true), "
                "set_config('request.jwt.claim.role', 'authenticated', true)",
                (json.dumps(claims, default=str), str(user_id)),
            )
            yield Db(conn, user_id)


def check_database() -> bool:
    with get_pool().connection() as conn:
        conn.execute("select 1")
        conn.rollback()
    return True
