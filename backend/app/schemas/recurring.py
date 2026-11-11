from datetime import date, datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import StringConstraints

from app.models.enums import Frequency, PaymentMethod
from app.schemas.common import CategoryRef, Money, RequestModel, ResponseModel, SafeDate
from app.schemas.transactions import Transaction

RecurringName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
RecurringNotes = Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)]
RecurringType = Literal["income", "expense"]


class RecurringPayment(ResponseModel):
    id: UUID
    name: str
    type: RecurringType
    amount: int
    category_id: UUID | None
    category: CategoryRef | None
    account_id: UUID
    account_name: str
    payment_method: PaymentMethod
    frequency: Frequency
    next_due_date: SafeDate
    is_active: bool
    notes: str | None
    is_demo: bool
    monthly_equivalent: int
    days_until_due: int
    is_overdue: bool
    created_at: datetime
    updated_at: datetime


class UpcomingPayment(ResponseModel):
    payment_id: UUID
    name: str
    type: RecurringType
    amount: int
    due_date: date
    days_until_due: int


class RecurringSummary(ResponseModel):
    monthly_expense_estimate: int
    monthly_income_estimate: int
    active_count: int
    upcoming: list[UpcomingPayment]


class RecurringList(ResponseModel):
    items: list[RecurringPayment]
    summary: RecurringSummary


class RecurringCreate(RequestModel):
    name: RecurringName
    type: RecurringType
    amount: Money
    category_id: UUID | None = None
    account_id: UUID
    payment_method: PaymentMethod = PaymentMethod.other
    frequency: Frequency
    next_due_date: SafeDate
    is_active: bool = True
    notes: RecurringNotes | None = None


class RecurringUpdate(RequestModel):
    name: RecurringName | None = None
    type: RecurringType | None = None
    amount: Money | None = None
    category_id: UUID | None = None
    account_id: UUID | None = None
    payment_method: PaymentMethod | None = None
    frequency: Frequency | None = None
    next_due_date: SafeDate | None = None
    is_active: bool | None = None
    notes: RecurringNotes | None = None


class RecordPayment(RequestModel):
    occurred_on: SafeDate | None = None
    amount: Money | None = None


class RecordResult(ResponseModel):
    transaction: Transaction
    payment: RecurringPayment
