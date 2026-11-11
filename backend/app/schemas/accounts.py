from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import StringConstraints

from app.models.enums import AccountType
from app.schemas.common import RequestModel, ResponseModel, SignedMoney

AccountName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]


class Account(ResponseModel):
    id: UUID
    name: str
    type: AccountType
    opening_balance: int
    current_balance: int
    currency: str
    is_liability: bool
    is_archived: bool
    is_demo: bool
    transaction_count: int
    created_at: datetime
    updated_at: datetime


class AccountTotals(ResponseModel):
    assets: int
    liabilities: int
    net_worth: int


class AccountList(ResponseModel):
    items: list[Account]
    totals: AccountTotals


class AccountCreate(RequestModel):
    name: AccountName
    type: AccountType
    opening_balance: SignedMoney = 0
    currency: Literal["INR"] = "INR"


class AccountUpdate(RequestModel):
    name: AccountName | None = None
    type: AccountType | None = None
    opening_balance: SignedMoney | None = None
    is_archived: bool | None = None
