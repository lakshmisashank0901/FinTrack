from typing import Any
from uuid import UUID

from app.core.database import Db

_SELECT = """
select a.id, a.name, a.type, a.opening_balance, b.current_balance, a.currency,
       a.type = 'credit_card' as is_liability, a.is_archived, a.is_demo,
       b.transaction_count, a.created_at, a.updated_at
  from public.accounts a
  join public.account_balances b on b.account_id = a.id
"""


def list_accounts(db: Db, include_archived: bool) -> list[dict[str, Any]]:
    sql = _SELECT + " where a.user_id = %s" + ("" if include_archived else " and not a.is_archived")
    return db.all(sql + " order by a.is_archived, a.created_at", (db.user_id,))


def get_account(db: Db, account_id: UUID, *, for_update: bool = False) -> dict[str, Any] | None:
    if for_update:
        db.one("select id from public.accounts where id = %s and user_id = %s for update", (account_id, db.user_id))
    return db.one(_SELECT + " where a.id = %s and a.user_id = %s", (account_id, db.user_id))


def insert_account(db: Db, data: dict[str, Any]) -> UUID:
    return db.scalar(
        """insert into public.accounts (user_id, name, type, opening_balance, currency, is_demo)
           values (%s, %s, %s, %s, %s, %s) returning id""",
        (db.user_id, data["name"], data["type"], data.get("opening_balance", 0),
         data.get("currency", "INR"), data.get("is_demo", False)),
    )


def update_account(db: Db, account_id: UUID, changes: dict[str, Any]) -> None:
    if not changes:
        return
    columns = ", ".join(f"{column} = %s" for column in changes)
    db.execute(
        f"update public.accounts set {columns} where id = %s and user_id = %s",
        (*changes.values(), account_id, db.user_id),
    )


def delete_account(db: Db, account_id: UUID) -> int:
    return db.execute("delete from public.accounts where id = %s and user_id = %s", (account_id, db.user_id))


def name_taken(db: Db, name: str, exclude_id: UUID | None = None) -> bool:
    return bool(db.scalar(
        """select exists(select 1 from public.accounts
                          where user_id = %s and lower(name) = lower(%s) and id is distinct from %s)""",
        (db.user_id, name, exclude_id),
    ))
