from typing import Any
from uuid import UUID

from app.core.database import Db
from app.core.errors import AppError, ConflictError, NotFoundError
from app.models.enums import AccountType
from app.repositories import accounts as repo
from app.schemas.accounts import AccountCreate, AccountUpdate


def compute_totals(accounts: list[dict[str, Any]]) -> dict[str, int]:
    """Net worth = assets − liabilities over non-archived accounts.

    Credit-card balances are liabilities (a negative balance is money owed) and
    are never counted as positive cash. A non-credit account that is overdrawn
    is counted as a liability too.
    """
    assets = liabilities = 0
    for account in accounts:
        if account["is_archived"]:
            continue
        balance = account.get("current_balance", account.get("balance", 0))
        if account["type"] == AccountType.credit_card:
            if balance < 0:
                liabilities += -balance
            else:
                assets += balance  # an overpaid card is money owed back to you
        elif balance >= 0:
            assets += balance
        else:
            liabilities += -balance
    return {"assets": assets, "liabilities": liabilities, "net_worth": assets - liabilities}


def list_accounts(db: Db, include_archived: bool) -> dict[str, Any]:
    items = repo.list_accounts(db, include_archived)
    return {"items": items, "totals": compute_totals(items)}


def get_account(db: Db, account_id: UUID) -> dict[str, Any]:
    account = repo.get_account(db, account_id)
    if not account:
        raise NotFoundError("Account not found.")
    return account


def require_usable_account(db: Db, account_id: UUID, label: str = "Account") -> dict[str, Any]:
    account = repo.get_account(db, account_id)
    if not account:
        raise AppError(f"{label} not found.", code="invalid_account")
    if account["is_archived"]:
        raise AppError(f"{label} is archived. Unarchive it before recording activity.", code="account_archived")
    return account


def create_account(db: Db, payload: AccountCreate) -> dict[str, Any]:
    if repo.name_taken(db, payload.name):
        raise ConflictError("An account with this name already exists.", code="duplicate_account")
    account_id = repo.insert_account(db, payload.model_dump())
    return get_account(db, account_id)


def update_account(db: Db, account_id: UUID, payload: AccountUpdate) -> dict[str, Any]:
    get_account(db, account_id)
    changes = payload.model_dump(exclude_unset=True)
    for key in ("name", "type", "opening_balance", "is_archived"):
        if key in changes and changes[key] is None:
            raise AppError(f"{key} cannot be null.", code="invalid_field")
    if "name" in changes and repo.name_taken(db, changes["name"], exclude_id=account_id):
        raise ConflictError("An account with this name already exists.", code="duplicate_account")
    repo.update_account(db, account_id, changes)
    return get_account(db, account_id)


def delete_account(db: Db, account_id: UUID) -> None:
    account = get_account(db, account_id)
    if account["transaction_count"] > 0:
        raise ConflictError(
            "This account has transactions. Archive it instead, or delete its transactions first.",
            code="account_in_use",
        )
    repo.delete_account(db, account_id)
