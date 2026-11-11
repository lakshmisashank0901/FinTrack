from uuid import UUID

from fastapi import APIRouter, Response, status

from app.api.dependencies import DbDep
from app.models.enums import CategoryKind
from app.schemas.categories import Category, CategoryCreate, CategoryUpdate
from app.services import categories as service

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[Category])
def list_categories(db: DbDep, kind: CategoryKind | None = None, include_archived: bool = False):
    return service.list_categories(db, kind, include_archived)


@router.post("", response_model=Category, status_code=status.HTTP_201_CREATED)
def create_category(payload: CategoryCreate, db: DbDep):
    return service.create_category(db, payload)


@router.patch("/{category_id}", response_model=Category)
def update_category(category_id: UUID, payload: CategoryUpdate, db: DbDep):
    return service.update_category(db, category_id, payload)


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(category_id: UUID, db: DbDep):
    service.delete_category(db, category_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
