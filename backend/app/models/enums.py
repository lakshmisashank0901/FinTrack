from enum import StrEnum


class AccountType(StrEnum):
    cash = "cash"
    savings = "savings"
    current = "current"
    credit_card = "credit_card"
    wallet = "wallet"
    other = "other"


LIABILITY_ACCOUNT_TYPES = {AccountType.credit_card}


class TransactionType(StrEnum):
    income = "income"
    expense = "expense"
    refund = "refund"
    transfer = "transfer"


class PaymentMethod(StrEnum):
    upi = "upi"
    cash = "cash"
    debit_card = "debit_card"
    credit_card = "credit_card"
    bank_transfer = "bank_transfer"
    net_banking = "net_banking"
    other = "other"


PAYMENT_METHOD_LABELS = {
    PaymentMethod.upi: "UPI",
    PaymentMethod.cash: "Cash",
    PaymentMethod.debit_card: "Debit Card",
    PaymentMethod.credit_card: "Credit Card",
    PaymentMethod.bank_transfer: "Bank Transfer",
    PaymentMethod.net_banking: "Net Banking",
    PaymentMethod.other: "Other",
}


class CategoryKind(StrEnum):
    expense = "expense"
    income = "income"


# Which category kind a transaction of each type may use.
CATEGORY_KIND_FOR_TYPE = {
    TransactionType.income: CategoryKind.income,
    TransactionType.expense: CategoryKind.expense,
    TransactionType.refund: CategoryKind.expense,
}


class Frequency(StrEnum):
    weekly = "weekly"
    monthly = "monthly"
    quarterly = "quarterly"
    yearly = "yearly"


class ContributionKind(StrEnum):
    contribution = "contribution"
    withdrawal = "withdrawal"


class Period(StrEnum):
    this_week = "this_week"
    this_month = "this_month"
    last_month = "last_month"
    last_3_months = "last_3_months"
    this_year = "this_year"
    custom = "custom"


class Interval(StrEnum):
    day = "day"
    week = "week"
    month = "month"


class BudgetState(StrEnum):
    on_track = "on_track"
    approaching = "approaching"
    exceeded = "exceeded"
