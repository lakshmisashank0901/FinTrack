from typing import Any
from uuid import UUID

from app.core.database import Db
from app.core.errors import AppError, ConflictError, NotFoundError
from app.models.enums import CATEGORY_KIND_FOR_TYPE, TransactionType
from app.repositories import categories as repo
from app.schemas.categories import CategoryCreate, CategoryUpdate


def list_categories(db: Db, kind: str | None, include_archived: bool) -> list[dict[str, Any]]:
    return repo.list_categories(db, kind, include_archived)


def get_category(db: Db, category_id: UUID) -> dict[str, Any]:
    category = repo.get_category(db, category_id)
    if not category:
        raise NotFoundError("Category not found.")
    return category


def require_category_for(db: Db, category_id: UUID | None, transaction_type: str) -> None:
    """Income uses income categories; expenses and refunds use expense categories."""
    if category_id is None:
        return
    if transaction_type == TransactionType.transfer:
        raise AppError("Transfers cannot have a category.", code="invalid_category")
    category = repo.get_category(db, category_id)
    if not category:
        raise AppError("Category not found.", code="invalid_category")
    expected = CATEGORY_KIND_FOR_TYPE[TransactionType(transaction_type)]
    if category["kind"] != expected:
        raise AppError(f"A {transaction_type} needs an {expected.value} category.", code="invalid_category")


def create_category(db: Db, payload: CategoryCreate) -> dict[str, Any]:
    if repo.name_taken(db, payload.name, payload.kind):
        raise ConflictError("A category with this name already exists.", code="duplicate_category")
    return get_category(db, repo.insert_category(db, payload.model_dump()))


def update_category(db: Db, category_id: UUID, payload: CategoryUpdate) -> dict[str, Any]:
    category = get_category(db, category_id)
    changes = payload.model_dump(exclude_unset=True)
    for key, value in changes.items():
        if value is None:
            raise AppError(f"{key} cannot be null.", code="invalid_field")
    if "name" in changes and repo.name_taken(db, changes["name"], category["kind"], exclude_id=category_id):
        raise ConflictError("A category with this name already exists.", code="duplicate_category")
    repo.update_category(db, category_id, changes)
    return get_category(db, category_id)


def delete_category(db: Db, category_id: UUID) -> None:
    get_category(db, category_id)
    repo.delete_category(db, category_id)
