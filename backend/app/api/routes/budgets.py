from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query, Response, status

from app.api.dependencies import DbDep
from app.schemas.budgets import BudgetCreate, BudgetHistory, BudgetMonth, BudgetStatus, BudgetUpdate
from app.services import budgets as service

router = APIRouter(prefix="/budgets", tags=["budgets"])
MonthQuery = Annotated[str | None, Query(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")]


@router.get("", response_model=BudgetMonth)
def list_budgets(db: DbDep, month: MonthQuery = None):
    return service.month_status(db, service.resolve_month(db, month))


@router.get("/history", response_model=BudgetHistory)
def budget_history(db: DbDep, months: Annotated[int, Query(ge=1, le=24)] = 6):
    return service.history(db, months)


@router.post("", response_model=BudgetStatus, status_code=status.HTTP_201_CREATED)
def create_budget(payload: BudgetCreate, db: DbDep):
    return service.create_budget(db, payload)


@router.patch("/{budget_id}", response_model=BudgetStatus)
def update_budget(budget_id: UUID, payload: BudgetUpdate, db: DbDep):
    return service.update_budget(db, budget_id, payload)


@router.delete("/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_budget(budget_id: UUID, db: DbDep):
    service.delete_budget(db, budget_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
