from datetime import date
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from fastapi.responses import JSONResponse

from app.api.dependencies import DbDep
from app.core.errors import AppError
from app.models.enums import PaymentMethod, TransactionType
from app.repositories.transactions import TransactionFilters
from app.schemas.transactions import Transaction, TransactionCreate, TransactionPage, TransactionUpdate
from app.services import clock
from app.services import transactions as service

router = APIRouter(prefix="/transactions", tags=["transactions"])


def transaction_filters(
    search: Annotated[str | None, Query(max_length=100)] = None,
    start_date: date | None = None,
    end_date: date | None = None,
    category_id: Annotated[list[str], Query()] = [],
    type: Annotated[list[TransactionType], Query()] = [],
    account_id: UUID | None = None,
    payment_method: Annotated[list[PaymentMethod], Query()] = [],
) -> TransactionFilters:
    if start_date and end_date and start_date > end_date:
        raise AppError("start_date must be on or before end_date.", code="invalid_range")
    category_ids: list[UUID] = []
    uncategorized = False
    for value in category_id:
        if value == "uncategorized":
            uncategorized = True
            continue
        try:
            category_ids.append(UUID(value))
        except ValueError as exc:
            raise AppError("category_id must be a UUID or 'uncategorized'.", code="invalid_filter") from exc
    return TransactionFilters(
        search=search.strip() if search and search.strip() else None, start_date=start_date, end_date=end_date,
        category_ids=category_ids, uncategorized=uncategorized, types=[t.value for t in type],
        account_id=account_id, payment_methods=[m.value for m in payment_method],
    )


Filters = Annotated[TransactionFilters, Depends(transaction_filters)]


@router.get("", response_model=TransactionPage)
def list_transactions(
    db: DbDep,
    filters: Filters,
    sort: Literal["date", "amount"] = "date",
    order: Literal["asc", "desc"] = "desc",
    page: Annotated[int, Query(ge=1, le=100_000)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 25,
):
    return service.list_transactions(db, filters, sort, order, page, page_size)


@router.get("/export", response_class=Response,
            responses={200: {"content": {"text/csv": {}}, "description": "CSV of all matching transactions"}})
def export_transactions(db: DbDep, filters: Filters):
    body = service.export_csv(db, filters)
    filename = f"fintrack-transactions-{clock.user_today(db).isoformat()}.csv"
    return Response(content="﻿" + body, media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": f'attachment; filename="{filename}"',
                             "Cache-Control": "no-store"})


@router.post("", response_model=Transaction, status_code=status.HTTP_201_CREATED,
             responses={200: {"model": Transaction, "description": "Idempotent replay of an earlier request"}})
def create_transaction(payload: TransactionCreate, db: DbDep):
    transaction, created = service.create_transaction(db, payload)
    if not created:
        return JSONResponse(Transaction.model_validate(transaction).model_dump(mode="json"), status_code=200)
    return transaction


@router.get("/{transaction_id}", response_model=Transaction)
def get_transaction(transaction_id: UUID, db: DbDep):
    return service.get_transaction(db, transaction_id)


@router.patch("/{transaction_id}", response_model=Transaction)
def update_transaction(transaction_id: UUID, payload: TransactionUpdate, db: DbDep):
    return service.update_transaction(db, transaction_id, payload)


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(transaction_id: UUID, db: DbDep):
    service.delete_transaction(db, transaction_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
