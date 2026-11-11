from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import Field, StringConstraints

from app.schemas.common import RequestModel, ResponseModel

PeriodPreference = Literal["this_week", "this_month", "last_month", "last_3_months", "this_year"]
DateFormat = Literal["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]
NumberFormat = Literal["en-IN", "en-US"]
Theme = Literal["light", "dark", "system"]


class Preferences(ResponseModel):
    currency: str
    default_period: PeriodPreference
    theme: Theme
    date_format: DateFormat
    number_format: NumberFormat
    timezone: str
    onboarding_dismissed: bool


class Profile(ResponseModel):
    id: UUID
    email: str | None
    display_name: str | None
    created_at: datetime
    preferences: Preferences


class PreferencesUpdate(RequestModel):
    currency: Literal["INR"] | None = None
    default_period: PeriodPreference | None = None
    theme: Theme | None = None
    date_format: DateFormat | None = None
    number_format: NumberFormat | None = None
    timezone: Annotated[str, StringConstraints(min_length=1, max_length=64)] | None = None
    onboarding_dismissed: bool | None = None


class ProfileUpdate(RequestModel):
    display_name: Annotated[str, StringConstraints(strip_whitespace=True, max_length=80)] | None = None
    preferences: PreferencesUpdate | None = None


class Onboarding(ResponseModel):
    has_account: bool
    has_income: bool
    has_expense: bool
    has_budget: bool
    demo_loaded: bool
    dismissed: bool


__all__ = ["Field"]
