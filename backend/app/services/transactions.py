import csv
import io
from typing import Any
from uuid import UUID

from app.core.database import Db
from app.core.errors import AppError, NotFoundError
from app.models.enums import PAYMENT_METHOD_LABELS, PaymentMethod, TransactionType
from app.repositories import transactions as repo
from app.repositories.transactions import TransactionFilters
from app.schemas.transactions import TransactionCreate, TransactionUpdate
from app.services.accounts import require_usable_account
from app.services.categories import require_category_for
from app.utils.money import paise_to_rupee_str

EDITABLE_FIELDS = ("type", "amount", "description", "category_id", "account_id", "to_account_id",
                   "occurred_on", "occurred_time", "payment_method", "notes", "tags")
NON_NULLABLE = {"type", "amount", "description", "account_id", "occurred_on", "tags"}


def validate_shape(db: Db, data: dict[str, Any], *, changed_accounts: set[str] | None = None) -> None:
    """Enforce the accounting shape of a (merged) transaction before writing it."""
    ttype = data["type"]
    if ttype == TransactionType.transfer:
        if not data.get("to_account_id"):
            raise AppError("A transfer needs a destination account.", code="invalid_transfer")
        if data["to_account_id"] == data["account_id"]:
            raise AppError("Source and destination accounts must differ.", code="invalid_transfer")
        if data.get("category_id"):
            raise AppError("Transfers cannot have a category.", code="invalid_category")
    elif data.get("to_account_id"):
        raise AppError("Only transfers can have a destination account.", code="invalid_transfer")

    check = changed_accounts if changed_accounts is not None else {"account_id", "to_account_id"}
    if "account_id" in check:
        require_usable_account(db, data["account_id"], "Account")
    if "to_account_id" in check and data.get("to_account_id"):
        require_usable_account(db, data["to_account_id"], "Destination account")
    require_category_for(db, data.get("category_id"), ttype)


def list_transactions(db: Db, filters: TransactionFilters, sort: str, order: str,
                      page: int, page_size: int) -> dict[str, Any]:
    totals = repo.totals(db, filters)
    items = repo.list_transactions(db, filters, sort, order, page_size, (page - 1) * page_size)
    return {"items": items, "total": totals["count"], "page": page, "page_size": page_size, "totals": totals}


def get_transaction(db: Db, transaction_id: UUID) -> dict[str, Any]:
    transaction = repo.get_transaction(db, transaction_id)
    if not transaction:
        raise NotFoundError("Transaction not found.")
    return transaction


def create_transaction(db: Db, payload: TransactionCreate, extra: dict[str, Any] | None = None
                       ) -> tuple[dict[str, Any], bool]:
    """Returns (transaction, created). created=False means an idempotent replay."""
    if payload.client_request_id:
        existing = repo.find_by_client_request(db, payload.client_request_id)
        if existing:
            return get_transaction(db, existing), False
    data = payload.model_dump()
    if data["type"] == TransactionType.transfer:
        data["category_id"] = None
    validate_shape(db, data)
    new_id = repo.insert_transaction(db, {**data, **(extra or {})})
    if new_id is None:  # lost a race with a concurrent request using the same key
        existing = repo.find_by_client_request(db, payload.client_request_id)  # type: ignore[arg-type]
        return get_transaction(db, existing), False  # type: ignore[arg-type]
    return get_transaction(db, new_id), True


def update_transaction(db: Db, transaction_id: UUID, payload: TransactionUpdate) -> dict[str, Any]:
    current = repo.lock_transaction(db, transaction_id)
    if not current:
        raise NotFoundError("Transaction not found.")
    changes = payload.model_dump(exclude_unset=True)
    for key in NON_NULLABLE:
        if key in changes and changes[key] is None:
            raise AppError(f"{key} cannot be null.", code="invalid_field")
    # Switching a transfer to another type drops the destination; switching to a transfer drops the category.
    if changes.get("type") and changes["type"] != TransactionType.transfer and "to_account_id" not in changes:
        changes["to_account_id"] = None
    if changes.get("type") == TransactionType.transfer and "category_id" not in changes:
        changes["category_id"] = None
    merged = {**current, **changes}
    changed_accounts = {k for k in ("account_id", "to_account_id") if k in changes and changes[k] != current[k]}
    validate_shape(db, merged, changed_accounts=changed_accounts)
    repo.update_transaction(db, transaction_id, {k: v for k, v in changes.items() if k in EDITABLE_FIELDS})
    return get_transaction(db, transaction_id)


def delete_transaction(db: Db, transaction_id: UUID) -> None:
    if not repo.delete_transaction(db, transaction_id):
        raise NotFoundError("Transaction not found.")


CSV_HEADER = ["date", "time", "type", "description", "category", "account", "to_account",
              "payment_method", "amount", "notes", "tags"]


def _csv_safe(value: str | None) -> str:
    """Neutralise spreadsheet formula injection (cells starting with = + - @)."""
    if not value:
        return ""
    return "'" + value if value[0] in "=+-@\t\r" else value


def export_csv(db: Db, filters: TransactionFilters) -> str:
    rows = repo.list_transactions(db, filters, "date", "desc", None)
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(CSV_HEADER)
    for t in rows:
        method = t["payment_method"]
        writer.writerow([
            t["occurred_on"].isoformat(), t["occurred_time"] or "", t["type"],
            _csv_safe(t["description"]), _csv_safe(t["category"]["name"] if t["category"] else ""),
            _csv_safe(t["account_name"]), _csv_safe(t["to_account_name"]),
            PAYMENT_METHOD_LABELS[PaymentMethod(method)] if method else "",
            paise_to_rupee_str(t["amount"]), _csv_safe(t["notes"]), _csv_safe(";".join(t["tags"])),
        ])
    return buffer.getvalue()
