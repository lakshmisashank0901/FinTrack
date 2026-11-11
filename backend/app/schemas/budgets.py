from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import Field, StringConstraints

from app.models.enums import BudgetState
from app.schemas.common import CategoryRef, Money, MonthStr, RequestModel, ResponseModel

BudgetName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]
Threshold = Annotated[int, Field(ge=1, le=100, strict=True)]


class BudgetStatus(ResponseModel):
    id: UUID
    name: str
    category_id: UUID | None
    category: CategoryRef | None
    amount: int
    alert_threshold: int
    start_month: str
    is_demo: bool
    spent: int
    remaining: int
    percent_used: float
    status: BudgetState
    created_at: datetime
    updated_at: datetime


class BudgetSummary(ResponseModel):
    total_spent: int
    category_budgeted: int
    category_spent: int
    unbudgeted_spent: int


class BudgetMonth(ResponseModel):
    month: str
    overall: BudgetStatus | None
    categories: list[BudgetStatus]
    summary: BudgetSummary


class BudgetHistoryItem(ResponseModel):
    month: str
    budgeted: int
    spent: int
    status: Literal["on_track", "approaching", "exceeded", "none"]


class BudgetHistory(ResponseModel):
    items: list[BudgetHistoryItem]


class BudgetCreate(RequestModel):
    name: BudgetName
    category_id: UUID | None = None
    amount: Money
    alert_threshold: Threshold = 80
    start_month: MonthStr | None = None


class BudgetUpdate(RequestModel):
    name: BudgetName | None = None
    amount: Money | None = None
    alert_threshold: Threshold | None = None
    start_month: MonthStr | None = None
