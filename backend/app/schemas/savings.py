from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import StringConstraints

from app.models.enums import ContributionKind
from app.schemas.common import HexColor, Money, RequestModel, ResponseModel, SafeDate

GoalName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]
GoalDescription = Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)]
Note = Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)]


class Contribution(ResponseModel):
    id: UUID
    goal_id: UUID
    kind: ContributionKind
    amount: int
    contributed_on: SafeDate
    note: str | None
    created_at: datetime


class SavingsGoal(ResponseModel):
    id: UUID
    name: str
    target_amount: int
    saved_amount: int
    remaining_amount: int
    progress_percent: float
    target_date: SafeDate | None
    description: str | None
    color: str
    is_archived: bool
    is_demo: bool
    monthly_needed: int | None
    recent_contributions: list[Contribution]
    created_at: datetime
    updated_at: datetime


class SavingsTotals(ResponseModel):
    target: int
    saved: int


class SavingsGoalList(ResponseModel):
    items: list[SavingsGoal]
    totals: SavingsTotals


class GoalCreate(RequestModel):
    name: GoalName
    target_amount: Money
    target_date: SafeDate | None = None
    description: GoalDescription | None = None
    color: HexColor = "#16a34a"


class GoalUpdate(RequestModel):
    name: GoalName | None = None
    target_amount: Money | None = None
    target_date: SafeDate | None = None
    description: GoalDescription | None = None
    color: HexColor | None = None
    is_archived: bool | None = None


class ContributionCreate(RequestModel):
    kind: ContributionKind
    amount: Money
    contributed_on: SafeDate
    note: Note | None = None
