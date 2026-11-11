"""Backup file format (version 1). Validated strictly before restore writes anything."""
from datetime import date, datetime, time
from typing import Annotated, Literal
from uuid import UUID

from pydantic import Field, StringConstraints, model_validator

from app.models.enums import AccountType, CategoryKind, ContributionKind, Frequency, PaymentMethod, TransactionType
from app.schemas.accounts import AccountName
from app.schemas.budgets import BudgetName, Threshold
from app.schemas.categories import CategoryName, IconName
from app.schemas.common import HexColor, Money, MonthStr, RequestModel, SafeDate, SignedMoney
from app.schemas.profile import PreferencesUpdate
from app.schemas.recurring import RecurringName, RecurringNotes
from app.schemas.savings import GoalDescription, GoalName, Note
from app.schemas.transactions import Description, Notes, Tag

MAX_ROWS = 100_000


class BackupModel(RequestModel):
    pass


class BackupAccount(BackupModel):
    id: UUID
    name: AccountName
    type: AccountType
    opening_balance: SignedMoney
    currency: Literal["INR"] = "INR"
    is_archived: bool = False
    created_at: datetime | None = None


class BackupCategory(BackupModel):
    id: UUID
    name: CategoryName
    kind: CategoryKind
    color: HexColor
    icon: IconName
    is_archived: bool = False


class BackupTransaction(BackupModel):
    id: UUID
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
    recurring_payment_id: UUID | None = None
    recurring_occurrence: date | None = None

    @model_validator(mode="after")
    def _shape(self) -> "BackupTransaction":
        if self.type == TransactionType.transfer:
            if not self.to_account_id or self.to_account_id == self.account_id:
                raise ValueError("transfer needs a distinct to_account_id")
            if self.category_id:
                raise ValueError("transfer cannot have a category")
        elif self.to_account_id:
            raise ValueError("only transfers can have to_account_id")
        return self


class BackupBudget(BackupModel):
    id: UUID
    name: BudgetName
    category_id: UUID | None = None
    amount: Money
    alert_threshold: Threshold = 80
    start_month: MonthStr


class BackupGoal(BackupModel):
    id: UUID
    name: GoalName
    target_amount: Money
    target_date: SafeDate | None = None
    description: GoalDescription | None = None
    color: HexColor = "#16a34a"
    is_archived: bool = False


class BackupContribution(BackupModel):
    id: UUID
    goal_id: UUID
    kind: ContributionKind
    amount: Money
    contributed_on: SafeDate
    note: Note | None = None


class BackupRecurring(BackupModel):
    id: UUID
    name: RecurringName
    type: Literal["income", "expense"]
    amount: Money
    category_id: UUID | None = None
    account_id: UUID
    payment_method: PaymentMethod = PaymentMethod.other
    frequency: Frequency
    next_due_date: SafeDate
    is_active: bool = True
    notes: RecurringNotes | None = None


class BackupProfile(BackupModel):
    display_name: Annotated[str, StringConstraints(strip_whitespace=True, max_length=80)] | None = None


class Backup(BackupModel):
    format: Literal["fintrack-backup"]
    version: Literal[1]
    exported_at: datetime | None = None
    profile: BackupProfile = BackupProfile()
    preferences: PreferencesUpdate = PreferencesUpdate()
    accounts: Annotated[list[BackupAccount], Field(max_length=1_000)] = []
    categories: Annotated[list[BackupCategory], Field(max_length=1_000)] = []
    transactions: Annotated[list[BackupTransaction], Field(max_length=MAX_ROWS)] = []
    budgets: Annotated[list[BackupBudget], Field(max_length=1_000)] = []
    savings_goals: Annotated[list[BackupGoal], Field(max_length=1_000)] = []
    savings_contributions: Annotated[list[BackupContribution], Field(max_length=MAX_ROWS)] = []
    recurring_payments: Annotated[list[BackupRecurring], Field(max_length=1_000)] = []


class ResetRequest(RequestModel):
    confirm: Literal["RESET"]
