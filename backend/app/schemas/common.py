from datetime import date
from typing import Annotated
from uuid import UUID

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, StringConstraints

MAX_AMOUNT = 100_000_000_000_000  # ₹1 lakh crore, in paise

# Positive amount in paise. Strict: floats and numeric strings are rejected.
Money = Annotated[int, Field(gt=0, le=MAX_AMOUNT, strict=True)]
SignedMoney = Annotated[int, Field(ge=-MAX_AMOUNT, le=MAX_AMOUNT, strict=True)]
HexColor = Annotated[str, StringConstraints(pattern=r"^#[0-9a-fA-F]{6}$")]
MonthStr = Annotated[str, StringConstraints(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")]

MIN_DATE = date(1970, 1, 1)
MAX_DATE = date(2100, 12, 31)


def _check_date(value: date) -> date:
    if not (MIN_DATE <= value <= MAX_DATE):
        raise ValueError("date must be between 1970-01-01 and 2100-12-31")
    return value


SafeDate = Annotated[date, AfterValidator(_check_date)]


class RequestModel(BaseModel):
    # Unknown fields (e.g. a smuggled "user_id") are rejected outright.
    model_config = ConfigDict(extra="forbid")


class ResponseModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class CategoryRef(ResponseModel):
    id: UUID
    name: str
    color: str
    icon: str
