from typing import Any
from uuid import UUID

from app.core.database import Db

_SELECT = """
select r.id, r.name, r.type, r.amount, r.category_id, r.account_id, a.name as account_name,
       r.payment_method, r.frequency, r.next_due_date, r.is_active, r.notes, r.is_demo,
       r.created_at, r.updated_at,
       c.name as category_name, c.color as category_color, c.icon as category_icon
  from public.recurring_payments r
  join public.accounts a on a.id = r.account_id
  left join public.categories c on c.id = r.category_id
"""
COLUMNS = ("name", "type", "amount", "category_id", "account_id", "payment_method", "frequency",
           "next_due_date", "is_active", "notes", "is_demo")


def list_payments(db: Db) -> list[dict[str, Any]]:
    return db.all(_SELECT + " where r.user_id = %s order by r.is_active desc, r.next_due_date, r.name", (db.user_id,))


def get_payment(db: Db, payment_id: UUID, *, for_update: bool = False) -> dict[str, Any] | None:
    if for_update:
        db.one("select id from public.recurring_payments where id = %s and user_id = %s for update",
               (payment_id, db.user_id))
    return db.one(_SELECT + " where r.id = %s and r.user_id = %s", (payment_id, db.user_id))


def insert_payment(db: Db, data: dict[str, Any]) -> UUID:
    values = [data.get(c, False if c == "is_demo" else None) for c in COLUMNS]
    return db.scalar(
        f"""insert into public.recurring_payments (user_id, {", ".join(COLUMNS)})
            values (%s, {", ".join(["%s"] * len(COLUMNS))}) returning id""",
        (db.user_id, *values),
    )


def update_payment(db: Db, payment_id: UUID, changes: dict[str, Any]) -> None:
    if not changes:
        return
    columns = ", ".join(f"{column} = %s" for column in changes)
    db.execute(f"update public.recurring_payments set {columns} where id = %s and user_id = %s",
               (*changes.values(), payment_id, db.user_id))


def delete_payment(db: Db, payment_id: UUID) -> int:
    return db.execute("delete from public.recurring_payments where id = %s and user_id = %s", (payment_id, db.user_id))


def occurrence_recorded(db: Db, payment_id: UUID, occurrence: Any) -> bool:
    return bool(db.scalar(
        "select exists(select 1 from public.transactions where recurring_payment_id = %s and recurring_occurrence = %s)",
        (payment_id, occurrence),
    ))
