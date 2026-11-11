from datetime import date
from typing import Any
from uuid import UUID

from app.core.database import Db
from app.core.errors import AppError, NotFoundError
from app.models.enums import ContributionKind
from app.schemas.savings import ContributionCreate, GoalCreate, GoalUpdate
from app.services import clock

_GOAL_SELECT = """
select g.id, g.name, g.target_amount, g.target_date, g.description, g.color, g.is_archived, g.is_demo,
       g.created_at, g.updated_at,
       coalesce((select sum(case when sc.kind = 'contribution' then sc.amount else -sc.amount end)
                   from public.savings_contributions sc where sc.goal_id = g.id), 0)::bigint as saved_amount
  from public.savings_goals g
"""
_CONTRIBUTION_SELECT = """
select id, goal_id, kind, amount, contributed_on, note, created_at
  from public.savings_contributions
"""


def months_between(start: date, end: date) -> int:
    """Whole months remaining, counting a partial month as one."""
    months = (end.year - start.year) * 12 + (end.month - start.month)
    if end.day >= start.day:
        months += 1
    return max(months, 1)


def _decorate(goal: dict[str, Any], contributions: list[dict[str, Any]], today: date) -> dict[str, Any]:
    target, saved = goal["target_amount"], goal["saved_amount"]
    remaining = max(0, target - saved)
    monthly_needed = None
    if remaining > 0 and goal["target_date"] and goal["target_date"] >= today:
        months = months_between(today, goal["target_date"])
        monthly_needed = -(-remaining // months)  # ceiling division
    return {
        **goal,
        "remaining_amount": remaining,
        "progress_percent": min(100.0, round(saved / target * 100, 1)) if target else 0.0,
        "monthly_needed": monthly_needed,
        "recent_contributions": contributions[:5],
    }


def list_goals(db: Db, include_archived: bool) -> dict[str, Any]:
    sql = _GOAL_SELECT + " where g.user_id = %s" + ("" if include_archived else " and not g.is_archived")
    goals = db.all(sql + " order by g.is_archived, g.created_at", (db.user_id,))
    recent: dict[UUID, list[dict[str, Any]]] = {}
    if goals:
        rows = db.all(
            """select * from (
                 select c.*, row_number() over (partition by goal_id order by contributed_on desc, created_at desc) rn
                   from public.savings_contributions c where c.user_id = %s and c.goal_id = any(%s)) x
               where rn <= 5 order by contributed_on desc, created_at desc""",
            (db.user_id, [g["id"] for g in goals]),
        )
        for row in rows:
            row.pop("rn")
            row.pop("user_id")
            row.pop("is_demo")
            recent.setdefault(row["goal_id"], []).append(row)
    today = clock.user_today(db)
    items = [_decorate(g, recent.get(g["id"], []), today) for g in goals]
    active = [g for g in items if not g["is_archived"]]
    return {"items": items, "totals": {"target": sum(g["target_amount"] for g in active),
                                       "saved": sum(g["saved_amount"] for g in active)}}


def _lock_goal(db: Db, goal_id: UUID) -> None:
    if not db.one("select id from public.savings_goals where id = %s and user_id = %s for update",
                  (goal_id, db.user_id)):
        raise NotFoundError("Savings goal not found.")


def get_goal(db: Db, goal_id: UUID) -> dict[str, Any]:
    goal = db.one(_GOAL_SELECT + " where g.id = %s and g.user_id = %s", (goal_id, db.user_id))
    if not goal:
        raise NotFoundError("Savings goal not found.")
    return _decorate(goal, list_contributions(db, goal_id, limit=5), clock.user_today(db))


def list_contributions(db: Db, goal_id: UUID, limit: int | None = None) -> list[dict[str, Any]]:
    sql = _CONTRIBUTION_SELECT + " where goal_id = %s and user_id = %s order by contributed_on desc, created_at desc"
    if limit:
        sql += f" limit {int(limit)}"
    return db.all(sql, (goal_id, db.user_id))


def create_goal(db: Db, payload: GoalCreate, is_demo: bool = False) -> dict[str, Any]:
    goal_id = db.scalar(
        """insert into public.savings_goals (user_id, name, target_amount, target_date, description, color, is_demo)
           values (%s, %s, %s, %s, %s, %s, %s) returning id""",
        (db.user_id, payload.name, payload.target_amount, payload.target_date, payload.description or None,
         payload.color, is_demo),
    )
    return get_goal(db, goal_id)


def update_goal(db: Db, goal_id: UUID, payload: GoalUpdate) -> dict[str, Any]:
    _lock_goal(db, goal_id)
    changes = payload.model_dump(exclude_unset=True)
    for key in ("name", "target_amount", "color", "is_archived"):
        if key in changes and changes[key] is None:
            raise AppError(f"{key} cannot be null.", code="invalid_field")
    if changes:
        columns = ", ".join(f"{column} = %s" for column in changes)
        db.execute(f"update public.savings_goals set {columns} where id = %s and user_id = %s",
                   (*changes.values(), goal_id, db.user_id))
    return get_goal(db, goal_id)


def delete_goal(db: Db, goal_id: UUID) -> None:
    if not db.execute("delete from public.savings_goals where id = %s and user_id = %s", (goal_id, db.user_id)):
        raise NotFoundError("Savings goal not found.")


def _saved(db: Db, goal_id: UUID) -> int:
    return int(db.scalar(
        """select coalesce(sum(case when kind = 'contribution' then amount else -amount end), 0)
             from public.savings_contributions where goal_id = %s and user_id = %s""",
        (goal_id, db.user_id),
    ))


def add_contribution(db: Db, goal_id: UUID, payload: ContributionCreate, is_demo: bool = False) -> dict[str, Any]:
    _lock_goal(db, goal_id)  # serialises concurrent withdrawals on the same goal
    if payload.kind == ContributionKind.withdrawal and payload.amount > _saved(db, goal_id):
        raise AppError("You cannot withdraw more than has been saved toward this goal.",
                       code="insufficient_savings")
    db.execute(
        """insert into public.savings_contributions (user_id, goal_id, kind, amount, contributed_on, note, is_demo)
           values (%s, %s, %s, %s, %s, %s, %s)""",
        (db.user_id, goal_id, payload.kind, payload.amount, payload.contributed_on, payload.note or None, is_demo),
    )
    return get_goal(db, goal_id)


def delete_contribution(db: Db, goal_id: UUID, contribution_id: UUID) -> dict[str, Any]:
    _lock_goal(db, goal_id)
    row = db.one("select kind, amount from public.savings_contributions where id = %s and goal_id = %s and user_id = %s",
                 (contribution_id, goal_id, db.user_id))
    if not row:
        raise NotFoundError("Contribution not found.")
    if row["kind"] == ContributionKind.contribution and _saved(db, goal_id) - row["amount"] < 0:
        raise AppError("Deleting this contribution would make the saved amount negative. "
                       "Delete the later withdrawal first.", code="insufficient_savings")
    db.execute("delete from public.savings_contributions where id = %s and user_id = %s", (contribution_id, db.user_id))
    return get_goal(db, goal_id)
