from datetime import date, timedelta
from typing import Any
from uuid import UUID

from app.core.database import Db
from app.core.errors import AppError, ConflictError, NotFoundError
from app.models.enums import Frequency
from app.repositories import recurring as repo
from app.schemas.recurring import RecordPayment, RecurringCreate, RecurringUpdate
from app.schemas.transactions import TransactionCreate
from app.services import clock
from app.services import transactions as transactions_service
from app.services.accounts import require_usable_account
from app.services.categories import require_category_for
from app.utils.dates import next_occurrence

UPCOMING_DAYS = 30
MAX_UPCOMING = 50


def monthly_equivalent(amount: int, frequency: Frequency) -> int:
    if frequency == Frequency.weekly:
        return round(amount * 52 / 12)
    if frequency == Frequency.quarterly:
        return round(amount / 3)
    if frequency == Frequency.yearly:
        return round(amount / 12)
    return amount


def _decorate(row: dict[str, Any], today: date) -> dict[str, Any]:
    out = {k: v for k, v in row.items() if not k.startswith("category_") or k == "category_id"}
    out["category"] = (
        {"id": row["category_id"], "name": row["category_name"], "color": row["category_color"],
         "icon": row["category_icon"]} if row["category_id"] else None
    )
    out["monthly_equivalent"] = monthly_equivalent(row["amount"], Frequency(row["frequency"]))
    out["days_until_due"] = (row["next_due_date"] - today).days
    out["is_overdue"] = row["is_active"] and row["next_due_date"] < today
    return out


def list_payments(db: Db) -> dict[str, Any]:
    today = clock.user_today(db)
    items = [_decorate(r, today) for r in repo.list_payments(db)]
    active = [p for p in items if p["is_active"]]
    horizon = today + timedelta(days=UPCOMING_DAYS)
    upcoming = []
    for p in active:
        due = p["next_due_date"]
        while due <= horizon and len(upcoming) < MAX_UPCOMING * 2:
            upcoming.append({"payment_id": p["id"], "name": p["name"], "type": p["type"], "amount": p["amount"],
                             "due_date": due, "days_until_due": (due - today).days})
            due = next_occurrence(due, Frequency(p["frequency"]))
    upcoming.sort(key=lambda u: (u["due_date"], u["name"]))
    return {
        "items": items,
        "summary": {
            "monthly_expense_estimate": sum(p["monthly_equivalent"] for p in active if p["type"] == "expense"),
            "monthly_income_estimate": sum(p["monthly_equivalent"] for p in active if p["type"] == "income"),
            "active_count": len(active),
            "upcoming": upcoming[:MAX_UPCOMING],
        },
    }


def get_payment(db: Db, payment_id: UUID) -> dict[str, Any]:
    row = repo.get_payment(db, payment_id)
    if not row:
        raise NotFoundError("Recurring payment not found.")
    return _decorate(row, clock.user_today(db))


def _validate(db: Db, data: dict[str, Any], check_account: bool) -> None:
    if check_account:
        require_usable_account(db, data["account_id"])
    require_category_for(db, data.get("category_id"), data["type"])


def create_payment(db: Db, payload: RecurringCreate, is_demo: bool = False) -> dict[str, Any]:
    data = payload.model_dump()
    _validate(db, data, check_account=True)
    return get_payment(db, repo.insert_payment(db, {**data, "is_demo": is_demo}))


def update_payment(db: Db, payment_id: UUID, payload: RecurringUpdate) -> dict[str, Any]:
    current = repo.get_payment(db, payment_id, for_update=True)
    if not current:
        raise NotFoundError("Recurring payment not found.")
    changes = payload.model_dump(exclude_unset=True)
    for key in ("name", "type", "amount", "account_id", "payment_method", "frequency", "next_due_date", "is_active"):
        if key in changes and changes[key] is None:
            raise AppError(f"{key} cannot be null.", code="invalid_field")
    merged = {**current, **changes}
    _validate(db, merged, check_account="account_id" in changes)
    repo.update_payment(db, payment_id, changes)
    return get_payment(db, payment_id)


def delete_payment(db: Db, payment_id: UUID) -> None:
    if not repo.delete_payment(db, payment_id):
        raise NotFoundError("Recurring payment not found.")


def record_payment(db: Db, payment_id: UUID, payload: RecordPayment) -> dict[str, Any]:
    """Record the current due occurrence as a real transaction, then advance the schedule.

    FinTrack never executes payments: this is the user confirming that it happened.
    The (payment, occurrence) unique index makes double-recording impossible.
    """
    payment = repo.get_payment(db, payment_id, for_update=True)
    if not payment:
        raise NotFoundError("Recurring payment not found.")
    if not payment["is_active"]:
        raise AppError("This recurring payment is inactive.", code="inactive_payment")
    occurrence = payment["next_due_date"]
    if repo.occurrence_recorded(db, payment_id, occurrence):
        raise ConflictError("This occurrence has already been recorded.", code="already_recorded")
    transaction, _ = transactions_service.create_transaction(
        db,
        TransactionCreate(
            type=payment["type"], amount=payload.amount or payment["amount"], description=payment["name"],
            category_id=payment["category_id"], account_id=payment["account_id"],
            occurred_on=payload.occurred_on or occurrence, payment_method=payment["payment_method"],
            notes=payment["notes"], tags=["recurring"],
        ),
        extra={"recurring_payment_id": payment_id, "recurring_occurrence": occurrence, "is_demo": payment["is_demo"]},
    )
    repo.update_payment(db, payment_id, {"next_due_date": next_occurrence(occurrence, Frequency(payment["frequency"]))})
    return {"transaction": transaction, "payment": get_payment(db, payment_id)}


def skip_payment(db: Db, payment_id: UUID) -> dict[str, Any]:
    payment = repo.get_payment(db, payment_id, for_update=True)
    if not payment:
        raise NotFoundError("Recurring payment not found.")
    repo.update_payment(db, payment_id, {"next_due_date": next_occurrence(payment["next_due_date"],
                                                                          Frequency(payment["frequency"]))})
    return get_payment(db, payment_id)
