from datetime import date, datetime, time
from typing import Annotated
from uuid import UUID

from pydantic import Field, StringConstraints, field_validator

from app.models.enums import PaymentMethod, TransactionType
from app.schemas.common import CategoryRef, Money, RequestModel, ResponseModel, SafeDate

Description = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=140)]
Notes = Annotated[str, StringConstraints(strip_whitespace=True, max_length=1000)]
Tag = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=30)]

def _clean_tags(value: list[str] | None) -> list[str] | None:
    if value is None:
        return None
    seen: list[str] = []
    for tag in value:
        tag = tag.lower()
        if tag not in seen:
            seen.append(tag)
    return seen


class Transaction(ResponseModel):
    id: UUID
    type: TransactionType
    amount: int
    description: str
    category_id: UUID | None
    category: CategoryRef | None
    account_id: UUID
    account_name: str
    to_account_id: UUID | None
    to_account_name: str | None
    occurred_on: date
    occurred_time: str | None
    payment_method: PaymentMethod | None
    notes: str | None
    tags: list[str]
    is_demo: bool
    recurring_payment_id: UUID | None
    created_at: datetime
    updated_at: datetime


class TransactionTotals(ResponseModel):
    income: int
    expenses: int
    refunds: int
    net_spending: int
    net_cash_flow: int
    count: int


class TransactionPage(ResponseModel):
    items: list[Transaction]
    total: int
    page: int
    page_size: int
    totals: TransactionTotals


class TransactionBase(RequestModel):
    @field_validator("tags", check_fields=False)
    @classmethod
    def _tags(cls, value: list[str] | None) -> list[str] | None:
        return _clean_tags(value)

    @field_validator("occurred_time", check_fields=False)
    @classmethod
    def _time(cls, value: time | None) -> time | None:
        return value.replace(second=0, microsecond=0, tzinfo=None) if value else value

    @field_validator("notes", check_fields=False)
    @classmethod
    def _notes(cls, value: str | None) -> str | None:
        return value or None


class TransactionCreate(TransactionBase):
    type: TransactionType
    amount: Money
    description: Description
    category_id: UUID | None = None
    account_id: UUID
    to_account_id: UUID | None = None
    occurred_on: SafeDate
    occurred_time: time | None = None
    payment_method: PaymentMethod | None = None
    notes: Notes | None = None
    tags: Annotated[list[Tag], Field(max_length=10)] = []
    client_request_id: UUID | None = None


class TransactionUpdate(TransactionBase):
    type: TransactionType | None = None
    amount: Money | None = None
    description: Description | None = None
    category_id: UUID | None = None
    account_id: UUID | None = None
    to_account_id: UUID | None = None
    occurred_on: SafeDate | None = None
    occurred_time: time | None = None
    payment_method: PaymentMethod | None = None
    notes: Notes | None = None
    tags: Annotated[list[Tag], Field(max_length=10)] | None = None
