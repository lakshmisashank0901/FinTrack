"""Aggregation queries. Spending is always net of refunds: expense − refund.

Transfers never appear in income or spending.
"""
from datetime import date
from typing import Any
from uuid import UUID

from app.core.database import Db
from app.models.enums import Interval

NET_SPEND = "case when t.type = 'expense' then t.amount else -t.amount end"
SPEND_TYPES = "t.type in ('expense', 'refund')"


def _category_clause(category_id: UUID | None) -> tuple[str, list[Any]]:
    return (" and t.category_id = %s", [category_id]) if category_id else ("", [])


def flow_totals(db: Db, start: date, end: date, category_id: UUID | None = None) -> dict[str, int]:
    """Income (never category-filtered) and spending (optionally filtered) for a date range."""
    clause, extra = _category_clause(category_id)
    spend_filter = f"t.type in ('expense', 'refund'){clause}"
    row = db.one(
        f"""select coalesce(sum(t.amount) filter (where t.type = 'income'), 0)::bigint as income,
                   coalesce(sum(t.amount) filter (where t.type = 'expense'{clause}), 0)::bigint as expenses,
                   coalesce(sum(t.amount) filter (where t.type = 'refund'{clause}), 0)::bigint as refunds,
                   count(*) filter (where t.type = 'income' or ({spend_filter}))::int as count
              from public.transactions t
             where t.user_id = %s and t.occurred_on between %s and %s""",
        [*extra, *extra, *extra, db.user_id, start, end],
    )
    assert row is not None
    return row


def has_data_before(db: Db, before: date) -> bool:
    return bool(db.scalar(
        "select exists(select 1 from public.transactions where user_id = %s and occurred_on < %s and type <> 'transfer')",
        (db.user_id, before),
    ))


def spending_by_category(db: Db, start: date, end: date, category_id: UUID | None = None) -> list[dict[str, Any]]:
    clause, extra = _category_clause(category_id)
    return db.all(
        f"""select t.category_id, coalesce(c.name, 'Uncategorised') as name,
                   coalesce(c.color, '#94a3b8') as color, coalesce(c.icon, 'circle') as icon,
                   sum({NET_SPEND})::bigint as amount,
                   count(*) filter (where t.type = 'expense')::int as transaction_count
              from public.transactions t
              left join public.categories c on c.id = t.category_id
             where t.user_id = %s and {SPEND_TYPES} and t.occurred_on between %s and %s{clause}
             group by t.category_id, c.name, c.color, c.icon
             order by amount desc, name""",
        [db.user_id, start, end, *extra],
    )


def spending_by_month_category(db: Db, start: date, end: date) -> list[dict[str, Any]]:
    return db.all(
        f"""select date_trunc('month', t.occurred_on::timestamp)::date as month, t.category_id,
                   sum({NET_SPEND})::bigint as amount
              from public.transactions t
             where t.user_id = %s and {SPEND_TYPES} and t.occurred_on between %s and %s
             group by 1, 2""",
        (db.user_id, start, end),
    )


def flow_by_bucket(db: Db, start: date, end: date, interval: Interval,
                   category_id: UUID | None = None) -> list[dict[str, Any]]:
    clause, extra = _category_clause(category_id)
    return db.all(
        f"""select date_trunc(%s, t.occurred_on::timestamp)::date as bucket,
                   coalesce(sum(t.amount) filter (where t.type = 'income'), 0)::bigint as income,
                   coalesce(sum({NET_SPEND}) filter (where {SPEND_TYPES}{clause}), 0)::bigint as expenses
              from public.transactions t
             where t.user_id = %s and t.type <> 'transfer' and t.occurred_on between %s and %s
             group by 1""",
        [interval.value, *extra, db.user_id, start, end],
    )


def spending_by_payment_method(db: Db, start: date, end: date, category_id: UUID | None = None
                               ) -> list[dict[str, Any]]:
    clause, extra = _category_clause(category_id)
    return db.all(
        f"""select coalesce(t.payment_method, 'other')::text as method,
                   sum({NET_SPEND})::bigint as amount,
                   count(*) filter (where t.type = 'expense')::int as transaction_count
              from public.transactions t
             where t.user_id = %s and {SPEND_TYPES} and t.occurred_on between %s and %s{clause}
             group by 1
             order by amount desc""",
        [db.user_id, start, end, *extra],
    )


def largest_expense(db: Db, start: date, end: date, category_id: UUID | None = None) -> dict[str, Any] | None:
    clause, extra = _category_clause(category_id)
    return db.one(
        f"""select t.id, t.description, t.amount, t.occurred_on, c.name as category_name
              from public.transactions t
              left join public.categories c on c.id = t.category_id
             where t.user_id = %s and t.type = 'expense' and t.occurred_on between %s and %s{clause}
             order by t.amount desc, t.occurred_on desc
             limit 1""",
        [db.user_id, start, end, *extra],
    )


def net_change(db: Db, start: date, end: date) -> int:
    """Change in net worth caused by transactions dated in the range (transfers net to zero)."""
    return int(db.scalar(
        """select coalesce(sum(case when type in ('income', 'refund') then amount
                                    when type = 'expense' then -amount else 0 end), 0)
             from public.transactions where user_id = %s and occurred_on between %s and %s""",
        (db.user_id, start, end),
    ))
