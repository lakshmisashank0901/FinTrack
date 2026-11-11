from datetime import date
from typing import Any
from uuid import UUID

from app.core.database import Db

_SELECT = """
select b.id, b.name, b.category_id, b.amount, b.alert_threshold, b.start_month, b.is_demo,
       b.created_at, b.updated_at,
       c.name as category_name, c.color as category_color, c.icon as category_icon
  from public.budgets b
  left join public.categories c on c.id = b.category_id
"""


def list_active(db: Db, month: date | None) -> list[dict[str, Any]]:
    """Budgets active in `month` (all budgets when month is None)."""
    sql = _SELECT + " where b.user_id = %s"
    params: list[Any] = [db.user_id]
    if month is not None:
        sql += " and b.start_month <= %s"
        params.append(month)
    return db.all(sql + " order by b.category_id nulls first, b.name", params)


def get_budget(db: Db, budget_id: UUID) -> dict[str, Any] | None:
    return db.one(_SELECT + " where b.id = %s and b.user_id = %s", (budget_id, db.user_id))


def exists_for_category(db: Db, category_id: UUID | None) -> bool:
    return bool(db.scalar(
        "select exists(select 1 from public.budgets where user_id = %s and category_id is not distinct from %s)",
        (db.user_id, category_id),
    ))


def insert_budget(db: Db, data: dict[str, Any]) -> UUID:
    return db.scalar(
        """insert into public.budgets (user_id, name, category_id, amount, alert_threshold, start_month, is_demo)
           values (%s, %s, %s, %s, %s, %s, %s) returning id""",
        (db.user_id, data["name"], data.get("category_id"), data["amount"], data.get("alert_threshold", 80),
         data["start_month"], data.get("is_demo", False)),
    )


def update_budget(db: Db, budget_id: UUID, changes: dict[str, Any]) -> None:
    if not changes:
        return
    columns = ", ".join(f"{column} = %s" for column in changes)
    db.execute(f"update public.budgets set {columns} where id = %s and user_id = %s",
               (*changes.values(), budget_id, db.user_id))


def delete_budget(db: Db, budget_id: UUID) -> int:
    return db.execute("delete from public.budgets where id = %s and user_id = %s", (budget_id, db.user_id))
