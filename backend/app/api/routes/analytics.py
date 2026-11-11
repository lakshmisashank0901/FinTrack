from datetime import date
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.api.dependencies import DbDep
from app.core.database import Db
from app.models.enums import Interval, Period
from app.services import analytics as service
from app.utils.dates import DateRange

router = APIRouter(prefix="/analytics", tags=["analytics"])


class RangeParams:
    def __init__(self, period: Period | None = None, start_date: date | None = None, end_date: date | None = None,
                 category_id: UUID | None = None) -> None:
        self.period, self.start_date, self.end_date, self.category_id = period, start_date, end_date, category_id

    def resolve(self, db: Db) -> DateRange:
        return service.get_range(db, self.period, self.start_date, self.end_date)


Params = Annotated[RangeParams, Depends()]
MonthQuery = Annotated[str | None, Query(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")]


@router.get("/summary")
def summary(db: DbDep, p: Params) -> dict[str, Any]:
    return service.summary(db, p.resolve(db), p.category_id)


@router.get("/cash-flow")
def cash_flow(db: DbDep, p: Params, interval: Interval | None = None,
              months: Annotated[int | None, Query(ge=1, le=36)] = None) -> dict[str, Any]:
    return service.cash_flow(db, p.resolve(db) if not months else None, interval, months)  # type: ignore[arg-type]


@router.get("/expense-breakdown")
def expense_breakdown(db: DbDep, p: Params) -> dict[str, Any]:
    return service.expense_breakdown(db, p.resolve(db), p.category_id)


@router.get("/spending-trend")
def spending_trend(db: DbDep, p: Params, interval: Interval | None = None) -> dict[str, Any]:
    return service.spending_trend(db, p.resolve(db), interval, p.category_id)


@router.get("/budget-performance")
def budget_performance(db: DbDep, month: MonthQuery = None) -> dict[str, Any]:
    return service.budget_performance(db, month)


@router.get("/payment-methods")
def payment_methods(db: DbDep, p: Params) -> dict[str, Any]:
    return service.payment_methods(db, p.resolve(db), p.category_id)


@router.get("/top-categories")
def top_categories(db: DbDep, p: Params, limit: Annotated[int, Query(ge=1, le=20)] = 7) -> dict[str, Any]:
    return service.top_categories(db, p.resolve(db), p.category_id, limit)


@router.get("/savings-trend")
def savings_trend(db: DbDep, months: Annotated[int, Query(ge=1, le=36)] = 12) -> dict[str, Any]:
    return service.savings_trend(db, months)


@router.get("/insights")
def insights(db: DbDep, p: Params) -> dict[str, Any]:
    return service.insights(db, p.resolve(db))
