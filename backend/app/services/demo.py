"""Explicitly-labelled sample data. Every row created here has is_demo = true and
can be removed with remove_demo() without touching the user's real records."""
import random
from datetime import date, timedelta
from typing import Any

from app.core.database import Db
from app.core.errors import ConflictError
from app.models.enums import ContributionKind, Frequency
from app.repositories import accounts as accounts_repo
from app.repositories import budgets as budgets_repo
from app.repositories import categories as categories_repo
from app.repositories import transactions as transactions_repo
from app.schemas.recurring import RecurringCreate
from app.schemas.savings import ContributionCreate, GoalCreate
from app.services import clock, recurring, savings
from app.utils.dates import add_months, month_start

RUPEE = 100


def is_loaded(db: Db) -> bool:
    return bool(db.scalar("select exists(select 1 from public.accounts where user_id = %s and is_demo)", (db.user_id,)))


def _category_ids(db: Db) -> dict[tuple[str, str], Any]:
    if not db.scalar("select exists(select 1 from public.categories where user_id = %s)", (db.user_id,)):
        categories_repo.seed_defaults(db)
    rows = db.all("select id, name, kind from public.categories where user_id = %s", (db.user_id,))
    return {(r["kind"], r["name"]): r["id"] for r in rows}


def load_demo(db: Db) -> None:
    if is_loaded(db):
        raise ConflictError("Demo data is already loaded.", code="demo_loaded")
    today = clock.user_today(db)
    rng = random.Random(f"{db.user_id}-{today.isoformat()}")
    cats = _category_ids(db)

    def cat(name: str, kind: str = "expense") -> Any:
        return cats.get((kind, name))

    bank = accounts_repo.insert_account(db, {"name": "Demo · HDFC Savings", "type": "savings",
                                             "opening_balance": 85_000 * RUPEE, "is_demo": True})
    wallet = accounts_repo.insert_account(db, {"name": "Demo · Cash Wallet", "type": "cash",
                                               "opening_balance": 3_000 * RUPEE, "is_demo": True})
    card = accounts_repo.insert_account(db, {"name": "Demo · ICICI Credit Card", "type": "credit_card",
                                             "opening_balance": -4_500 * RUPEE, "is_demo": True})

    def tx(ttype: str, rupees: float, description: str, day: date, account: Any, category: Any = None,
           method: str | None = "upi", to_account: Any = None) -> None:
        if day > today:
            return
        transactions_repo.insert_transaction(db, {
            "type": ttype, "amount": int(round(rupees * RUPEE)), "description": description, "category_id": category,
            "account_id": account, "to_account_id": to_account, "occurred_on": day, "payment_method": method,
            "tags": ["demo"], "is_demo": True,
        })

    start = add_months(month_start(today), -3)
    for m in range(4):
        first = add_months(start, m)
        tx("income", 95_000, "Salary — Acme Pvt Ltd", first, bank, cat("Salary", "income"), "bank_transfer")
        tx("expense", 28_000, "Apartment rent", first + timedelta(days=2), bank, cat("Housing & Rent"), "net_banking")
        tx("expense", rng.randint(1_400, 2_300), "Electricity bill", first + timedelta(days=6), bank,
           cat("Utilities"), "upi")
        tx("expense", 799, "Broadband", first + timedelta(days=4), bank, cat("Utilities"), "upi")
        tx("expense", 649, "Netflix", first + timedelta(days=9), card, cat("Subscriptions"), "credit_card")
        tx("expense", 119, "Spotify", first + timedelta(days=11), card, cat("Subscriptions"), "credit_card")
        tx("transfer", 5_000, "ATM withdrawal", first + timedelta(days=5), bank, None, "other", wallet)
        tx("transfer", rng.randint(4_500, 6_000), "Credit card bill payment", first + timedelta(days=17), bank,
           None, "net_banking", card)
        if m % 2 == 1:
            tx("income", rng.randint(8_000, 15_000), "Freelance design project", first + timedelta(days=19), bank,
               cat("Freelance", "income"), "bank_transfer")
        for week in range(5):
            day = first + timedelta(days=week * 7 + rng.randint(0, 2))
            if day.month != first.month:
                continue
            tx("expense", rng.randint(1_600, 2_800), "BigBasket groceries", day, bank, cat("Groceries"), "upi")
            tx("expense", rng.randint(250, 900), rng.choice(["Swiggy", "Zomato", "Café Coffee Day", "Lunch with team"]),
               day + timedelta(days=1), bank, cat("Food & Dining"), "upi")
            tx("expense", rng.randint(150, 600), rng.choice(["Uber", "Ola", "Metro card recharge", "Petrol"]),
               day + timedelta(days=2), wallet if week % 2 else bank, cat("Transportation"),
               "cash" if week % 2 else "upi")
            if rng.random() < 0.55:
                tx("expense", rng.randint(400, 3_500), rng.choice(["Amazon order", "Myntra", "Decathlon"]),
                   day + timedelta(days=3), card, cat("Shopping"), "credit_card")
            if rng.random() < 0.35:
                tx("expense", rng.randint(300, 1_200), rng.choice(["Movie tickets", "Concert", "Bowling"]),
                   day + timedelta(days=4), card, cat("Entertainment"), "credit_card")
        tx("expense", rng.randint(500, 1_800), "Pharmacy", first + timedelta(days=13), wallet, cat("Healthcare"), "cash")
        tx("expense", 5_000, "Monthly SIP — index fund", first + timedelta(days=7), bank, cat("Investments"),
           "net_banking")
    tx("refund", 1_299, "Amazon return refund", add_months(start, 2) + timedelta(days=21), card, cat("Shopping"),
       "credit_card")

    current = month_start(today)
    for name, category, amount in [("Monthly spending", None, 70_000), ("Food & Dining", cat("Food & Dining"), 4_000),
                                   ("Groceries", cat("Groceries"), 10_000), ("Shopping", cat("Shopping"), 5_000)]:
        if not budgets_repo.exists_for_category(db, category):
            budgets_repo.insert_budget(db, {"name": name, "category_id": category, "amount": amount * RUPEE,
                                            "start_month": add_months(current, -3), "is_demo": True})

    emergency = savings.create_goal(db, GoalCreate(name="Emergency Fund", target_amount=300_000 * RUPEE,
                                                   target_date=add_months(today, 14), color="#16a34a",
                                                   description="Six months of essential expenses."), is_demo=True)
    laptop = savings.create_goal(db, GoalCreate(name="New Laptop", target_amount=120_000 * RUPEE,
                                                target_date=add_months(today, 5), color="#6366f1"), is_demo=True)
    for m in range(4):
        day = min(add_months(start, m) + timedelta(days=2), today)
        savings.add_contribution(db, emergency["id"], ContributionCreate(
            kind=ContributionKind.contribution, amount=15_000 * RUPEE, contributed_on=day), is_demo=True)
        savings.add_contribution(db, laptop["id"], ContributionCreate(
            kind=ContributionKind.contribution, amount=8_000 * RUPEE, contributed_on=day), is_demo=True)

    next_month = add_months(current, 1)
    for item in [
        RecurringCreate(name="Apartment rent", type="expense", amount=28_000 * RUPEE, category_id=cat("Housing & Rent"),
                        account_id=bank, payment_method="net_banking", frequency=Frequency.monthly,
                        next_due_date=next_month + timedelta(days=2)),
        RecurringCreate(name="Netflix", type="expense", amount=649 * RUPEE, category_id=cat("Subscriptions"),
                        account_id=card, payment_method="credit_card", frequency=Frequency.monthly,
                        next_due_date=current + timedelta(days=9) if today.day < 10 else next_month + timedelta(days=9)),
        RecurringCreate(name="Broadband", type="expense", amount=799 * RUPEE, category_id=cat("Utilities"),
                        account_id=bank, payment_method="upi", frequency=Frequency.monthly,
                        next_due_date=next_month + timedelta(days=4)),
        RecurringCreate(name="Health insurance", type="expense", amount=18_500 * RUPEE, category_id=cat("Healthcare"),
                        account_id=bank, payment_method="net_banking", frequency=Frequency.yearly,
                        next_due_date=add_months(today, 4)),
        RecurringCreate(name="Salary", type="income", amount=95_000 * RUPEE, category_id=cat("Salary", "income"),
                        account_id=bank, payment_method="bank_transfer", frequency=Frequency.monthly,
                        next_due_date=next_month),
    ]:
        recurring.create_payment(db, item, is_demo=True)


def remove_demo(db: Db) -> None:
    u = db.user_id
    demo_accounts = "(select id from public.accounts where user_id = %(u)s and is_demo)"
    # Anything recorded against a demo account goes with it.
    db.execute(f"""delete from public.transactions where user_id = %(u)s and
                   (is_demo or account_id in {demo_accounts} or to_account_id in {demo_accounts})""", {"u": u})
    db.execute("delete from public.recurring_payments where user_id = %(u)s and is_demo", {"u": u})
    db.execute("delete from public.budgets where user_id = %(u)s and is_demo", {"u": u})
    db.execute("delete from public.savings_contributions where user_id = %(u)s and is_demo", {"u": u})
    db.execute("delete from public.savings_goals where user_id = %(u)s and is_demo", {"u": u})
    db.execute("delete from public.accounts where user_id = %(u)s and is_demo", {"u": u})
    db.execute("delete from public.categories where user_id = %(u)s and is_demo", {"u": u})
