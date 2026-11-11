from typing import Any
from uuid import UUID

from app.core.database import Db

_SELECT = """
select c.id, c.name, c.kind, c.color, c.icon, c.is_archived, c.is_demo,
       (select count(*) from public.transactions t where t.category_id = c.id)::int as transaction_count
  from public.categories c
"""


def list_categories(db: Db, kind: str | None, include_archived: bool) -> list[dict[str, Any]]:
    sql = _SELECT + " where c.user_id = %s"
    params: list[Any] = [db.user_id]
    if kind:
        sql += " and c.kind = %s"
        params.append(kind)
    if not include_archived:
        sql += " and not c.is_archived"
    return db.all(sql + " order by c.kind, c.name", params)


def get_category(db: Db, category_id: UUID) -> dict[str, Any] | None:
    return db.one(_SELECT + " where c.id = %s and c.user_id = %s", (category_id, db.user_id))


def insert_category(db: Db, data: dict[str, Any]) -> UUID:
    return db.scalar(
        """insert into public.categories (user_id, name, kind, color, icon, is_demo)
           values (%s, %s, %s, %s, %s, %s) returning id""",
        (db.user_id, data["name"], data["kind"], data.get("color", "#64748b"),
         data.get("icon", "circle"), data.get("is_demo", False)),
    )


def update_category(db: Db, category_id: UUID, changes: dict[str, Any]) -> None:
    if not changes:
        return
    columns = ", ".join(f"{column} = %s" for column in changes)
    db.execute(
        f"update public.categories set {columns} where id = %s and user_id = %s",
        (*changes.values(), category_id, db.user_id),
    )


def delete_category(db: Db, category_id: UUID) -> int:
    return db.execute("delete from public.categories where id = %s and user_id = %s", (category_id, db.user_id))


def name_taken(db: Db, name: str, kind: str, exclude_id: UUID | None = None) -> bool:
    return bool(db.scalar(
        """select exists(select 1 from public.categories where user_id = %s and kind = %s
                         and lower(name) = lower(%s) and id is distinct from %s)""",
        (db.user_id, kind, name, exclude_id),
    ))


def seed_defaults(db: Db) -> None:
    db.execute("select public.seed_default_categories(%s)", (db.user_id,))
