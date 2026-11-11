from dataclasses import dataclass, field
from datetime import date
from typing import Any
from uuid import UUID

from app.core.database import Db

_SELECT = """
select t.id, t.type, t.amount, t.description, t.category_id,
       t.account_id, a.name as account_name, t.to_account_id, ta.name as to_account_name,
       t.occurred_on, to_char(t.occurred_time, 'HH24:MI') as occurred_time,
       t.payment_method, t.notes, t.tags, t.is_demo, t.recurring_payment_id,
       t.created_at, t.updated_at,
       c.name as category_name, c.color as category_color, c.icon as category_icon
  from public.transactions t
  join public.accounts a on a.id = t.account_id
  left join public.accounts ta on ta.id = t.to_account_id
  left join public.categories c on c.id = t.category_id
"""

SORT_COLUMNS = {"date": "t.occurred_on {o}, t.occurred_time {o} nulls last, t.created_at {o}",
                "amount": "t.amount {o}, t.occurred_on desc"}


@dataclass
class TransactionFilters:
    search: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    category_ids: list[UUID] = field(default_factory=list)
    uncategorized: bool = False
    types: list[str] = field(default_factory=list)
    account_id: UUID | None = None
    payment_methods: list[str] = field(default_factory=list)


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def build_where(user_id: UUID, f: TransactionFilters) -> tuple[str, list[Any]]:
    clauses = ["t.user_id = %s"]
    params: list[Any] = [user_id]
    if f.search:
        pattern = f"%{_escape_like(f.search)}%"
        clauses.append("(t.description ilike %s or coalesce(t.notes, '') ilike %s)")
        params += [pattern, pattern]
    if f.start_date:
        clauses.append("t.occurred_on >= %s")
        params.append(f.start_date)
    if f.end_date:
        clauses.append("t.occurred_on <= %s")
        params.append(f.end_date)
    if f.category_ids or f.uncategorized:
        parts = []
        if f.category_ids:
            parts.append("t.category_id = any(%s)")
            params.append(f.category_ids)
        if f.uncategorized:
            parts.append("t.category_id is null")
        clauses.append("(" + " or ".join(parts) + ")")
    if f.types:
        clauses.append("t.type = any(%s::public.transaction_type[])")
        params.append(f.types)
    if f.account_id:
        clauses.append("(t.account_id = %s or t.to_account_id = %s)")
        params += [f.account_id, f.account_id]
    if f.payment_methods:
        clauses.append("coalesce(t.payment_method, 'other') = any(%s::public.payment_method[])")
        params.append(f.payment_methods)
    return " where " + " and ".join(clauses), params


def to_api(row: dict[str, Any]) -> dict[str, Any]:
    out = {k: v for k, v in row.items() if not k.startswith("category_") or k == "category_id"}
    out["category"] = (
        {"id": row["category_id"], "name": row["category_name"], "color": row["category_color"],
         "icon": row["category_icon"]}
        if row["category_id"] else None
    )
    return out


def list_transactions(db: Db, f: TransactionFilters, sort: str, order: str,
                      limit: int | None, offset: int = 0) -> list[dict[str, Any]]:
    where, params = build_where(db.user_id, f)
    direction = "asc" if order == "asc" else "desc"
    sql = _SELECT + where + " order by " + SORT_COLUMNS[sort].format(o=direction) + ", t.id"
    if limit is not None:
        sql += " limit %s offset %s"
        params += [limit, offset]
    return [to_api(r) for r in db.all(sql, params)]


def totals(db: Db, f: TransactionFilters) -> dict[str, int]:
    where, params = build_where(db.user_id, f)
    row = db.one(
        """select count(*)::int as count,
                  coalesce(sum(t.amount) filter (where t.type = 'income'), 0)::bigint as income,
                  coalesce(sum(t.amount) filter (where t.type = 'expense'), 0)::bigint as expenses,
                  coalesce(sum(t.amount) filter (where t.type = 'refund'), 0)::bigint as refunds
             from public.transactions t""" + where,
        params,
    )
    assert row is not None
    net_spending = row["expenses"] - row["refunds"]
    return {**row, "net_spending": net_spending, "net_cash_flow": row["income"] - net_spending}


def get_transaction(db: Db, transaction_id: UUID) -> dict[str, Any] | None:
    row = db.one(_SELECT + " where t.id = %s and t.user_id = %s", (transaction_id, db.user_id))
    return to_api(row) if row else None


def lock_transaction(db: Db, transaction_id: UUID) -> dict[str, Any] | None:
    return db.one(
        """select id, type, amount, description, category_id, account_id, to_account_id, occurred_on,
                  occurred_time, payment_method, notes, tags
             from public.transactions where id = %s and user_id = %s for update""",
        (transaction_id, db.user_id),
    )


def find_by_client_request(db: Db, client_request_id: UUID) -> UUID | None:
    return db.scalar(
        "select id from public.transactions where user_id = %s and client_request_id = %s",
        (db.user_id, client_request_id),
    )


INSERT_COLUMNS = ("type", "amount", "description", "category_id", "account_id", "to_account_id",
                  "occurred_on", "occurred_time", "payment_method", "notes", "tags", "is_demo",
                  "recurring_payment_id", "recurring_occurrence", "client_request_id")


def insert_transaction(db: Db, data: dict[str, Any]) -> UUID | None:
    """Insert; returns None if the client_request_id was already used (idempotent replay)."""
    values = [data.get(c, False if c == "is_demo" else ([] if c == "tags" else None)) for c in INSERT_COLUMNS]
    return db.scalar(
        f"""insert into public.transactions (user_id, {", ".join(INSERT_COLUMNS)})
            values (%s, {", ".join(["%s"] * len(INSERT_COLUMNS))})
            on conflict (user_id, client_request_id) where client_request_id is not null do nothing
            returning id""",
        (db.user_id, *values),
    )


def update_transaction(db: Db, transaction_id: UUID, changes: dict[str, Any]) -> None:
    if not changes:
        return
    columns = ", ".join(f"{column} = %s" for column in changes)
    db.execute(
        f"update public.transactions set {columns} where id = %s and user_id = %s",
        (*changes.values(), transaction_id, db.user_id),
    )


def delete_transaction(db: Db, transaction_id: UUID) -> int:
    return db.execute("delete from public.transactions where id = %s and user_id = %s", (transaction_id, db.user_id))
