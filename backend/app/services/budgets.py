from collections import defaultdict
from datetime import date
from typing import Any
from uuid import UUID

from app.core.database import Db
from app.core.errors import AppError, ConflictError, NotFoundError
from app.models.enums import BudgetState, CategoryKind
from app.repositories import analytics as analytics_repo
from app.repositories import budgets as repo
from app.repositories import categories as categories_repo
from app.schemas.budgets import BudgetCreate, BudgetUpdate
from app.services import clock
from app.utils.dates import add_months, format_month, month_end, month_start, parse_month


def budget_state(spent: int, amount: int, threshold: int) -> BudgetState:
    if spent > amount:
        return BudgetState.exceeded
    if amount and spent * 100 >= amount * threshold:
        return BudgetState.approaching
    return BudgetState.on_track


def _status(budget: dict[str, Any], spent: int) -> dict[str, Any]:
    amount = budget["amount"]
    return {
        "id": budget["id"], "name": budget["name"], "category_id": budget["category_id"],
        "category": (
            {"id": budget["category_id"], "name": budget["category_name"], "color": budget["category_color"],
             "icon": budget["category_icon"]}
            if budget["category_id"] else None
        ),
        "amount": amount, "alert_threshold": budget["alert_threshold"],
        "start_month": format_month(budget["start_month"]), "is_demo": budget["is_demo"],
        "spent": spent, "remaining": amount - spent,
        "percent_used": round(spent / amount * 100, 1) if amount else 0.0,
        "status": budget_state(spent, amount, budget["alert_threshold"]),
        "created_at": budget["created_at"], "updated_at": budget["updated_at"],
    }


def resolve_month(db: Db, month: str | None) -> date:
    return parse_month(month) if month else month_start(clock.user_today(db))


def month_status(db: Db, month: date) -> dict[str, Any]:
    """Budget status for one calendar month.

    The overall budget is measured against all net spending; category budgets
    against their own category. They are reported side by side and never summed
    together, so nothing is double counted.
    """
    budgets = repo.list_active(db, month)
    spend = {row["category_id"]: row["amount"]
             for row in analytics_repo.spending_by_category(db, month, month_end(month))}
    total_spent = max(0, sum(spend.values()))
    overall = None
    categories: list[dict[str, Any]] = []
    for budget in budgets:
        if budget["category_id"] is None:
            overall = _status(budget, total_spent)
        else:
            categories.append(_status(budget, max(0, spend.get(budget["category_id"], 0))))
    category_spent = sum(b["spent"] for b in categories)
    return {
        "month": format_month(month),
        "overall": overall,
        "categories": categories,
        "summary": {
            "total_spent": total_spent,
            "category_budgeted": sum(b["amount"] for b in categories),
            "category_spent": category_spent,
            "unbudgeted_spent": max(0, total_spent - category_spent),
        },
    }


def history(db: Db, months: int) -> dict[str, Any]:
    current = month_start(clock.user_today(db))
    first = add_months(current, -(months - 1))
    budgets = repo.list_active(db, None)
    spend: dict[date, dict[UUID | None, int]] = defaultdict(dict)
    for row in analytics_repo.spending_by_month_category(db, first, month_end(current)):
        spend[row["month"]][row["category_id"]] = row["amount"]

    items = []
    for i in range(months):
        month = add_months(first, i)
        active = [b for b in budgets if b["start_month"] <= month]
        month_spend = spend.get(month, {})
        overall = next((b for b in active if b["category_id"] is None), None)
        if overall:
            budgeted, threshold = overall["amount"], overall["alert_threshold"]
            spent = max(0, sum(month_spend.values()))
        elif active:
            budgeted, threshold = sum(b["amount"] for b in active), 80
            spent = sum(max(0, month_spend.get(b["category_id"], 0)) for b in active)
        else:
            items.append({"month": format_month(month), "budgeted": 0,
                          "spent": max(0, sum(month_spend.values())), "status": "none"})
            continue
        items.append({"month": format_month(month), "budgeted": budgeted, "spent": spent,
                      "status": budget_state(spent, budgeted, threshold).value})
    return {"items": items}


def _status_for(db: Db, budget_id: UUID) -> dict[str, Any]:
    budget = repo.get_budget(db, budget_id)
    if not budget:
        raise NotFoundError("Budget not found.")
    month = max(month_start(clock.user_today(db)), budget["start_month"])
    data = month_status(db, month)
    found = data["overall"] if budget["category_id"] is None else next(
        b for b in data["categories"] if b["id"] == budget_id)
    return found  # type: ignore[return-value]


def create_budget(db: Db, payload: BudgetCreate) -> dict[str, Any]:
    if payload.category_id is not None:
        category = categories_repo.get_category(db, payload.category_id)
        if not category:
            raise AppError("Category not found.", code="invalid_category")
        if category["kind"] != CategoryKind.expense:
            raise AppError("Budgets can only track expense categories.", code="invalid_category")
    if repo.exists_for_category(db, payload.category_id):
        what = "this category" if payload.category_id else "overall spending"
        raise ConflictError(f"A budget for {what} already exists.", code="duplicate_budget")
    data = payload.model_dump()
    data["start_month"] = parse_month(payload.start_month) if payload.start_month else resolve_month(db, None)
    return _status_for(db, repo.insert_budget(db, data))


def update_budget(db: Db, budget_id: UUID, payload: BudgetUpdate) -> dict[str, Any]:
    if not repo.get_budget(db, budget_id):
        raise NotFoundError("Budget not found.")
    changes = payload.model_dump(exclude_unset=True)
    for key, value in changes.items():
        if value is None:
            raise AppError(f"{key} cannot be null.", code="invalid_field")
    if "start_month" in changes:
        changes["start_month"] = parse_month(changes["start_month"])
    repo.update_budget(db, budget_id, changes)
    return _status_for(db, budget_id)


def delete_budget(db: Db, budget_id: UUID) -> None:
    if not repo.delete_budget(db, budget_id):
        raise NotFoundError("Budget not found.")
