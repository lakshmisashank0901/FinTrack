from collections import defaultdict
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from app.core.database import Db
from app.core.errors import ValidationFailed
from app.models.enums import CATEGORY_KIND_FOR_TYPE, ContributionKind, TransactionType
from app.repositories import categories as categories_repo
from app.schemas.backup import Backup
from app.services.profile import PREF_COLUMNS
from app.utils.dates import format_month, is_valid_timezone, parse_month

USER_TABLES_IN_DELETE_ORDER = ("transactions", "recurring_payments", "budgets", "savings_contributions",
                               "savings_goals", "accounts", "categories")


def export_backup(db: Db) -> dict[str, Any]:
    u = {"u": db.user_id}

    def rows(sql: str) -> list[dict[str, Any]]:
        return db.all(sql, u)

    prefs = db.one(f"select {', '.join(PREF_COLUMNS)} from public.user_preferences where user_id = %(u)s", u) or {}
    budgets = rows("""select id, name, category_id, amount, alert_threshold, start_month
                        from public.budgets where user_id = %(u)s order by created_at""")
    for b in budgets:
        b["start_month"] = format_month(b["start_month"])
    transactions = rows("""select id, type, amount, description, category_id, account_id, to_account_id, occurred_on,
                                  to_char(occurred_time, 'HH24:MI') as occurred_time, payment_method, notes, tags,
                                  recurring_payment_id, recurring_occurrence
                             from public.transactions where user_id = %(u)s order by occurred_on, created_at""")
    for t in transactions:
        if t["occurred_time"] is None:
            del t["occurred_time"]
    return {
        "format": "fintrack-backup",
        "version": 1,
        "exported_at": datetime.now(UTC),
        "profile": db.one("select display_name from public.profiles where id = %(u)s", u) or {},
        "preferences": prefs,
        "accounts": rows("""select id, name, type, opening_balance, currency, is_archived, created_at
                              from public.accounts where user_id = %(u)s order by created_at"""),
        "categories": rows("""select id, name, kind, color, icon, is_archived
                                from public.categories where user_id = %(u)s order by kind, name"""),
        "transactions": transactions,
        "budgets": budgets,
        "savings_goals": rows("""select id, name, target_amount, target_date, description, color, is_archived
                                   from public.savings_goals where user_id = %(u)s order by created_at"""),
        "savings_contributions": rows("""select id, goal_id, kind, amount, contributed_on, note
                                           from public.savings_contributions where user_id = %(u)s
                                          order by contributed_on, created_at"""),
        "recurring_payments": rows("""select id, name, type, amount, category_id, account_id, payment_method,
                                             frequency, next_due_date, is_active, notes
                                        from public.recurring_payments where user_id = %(u)s order by created_at"""),
    }


def validate_references(backup: Backup) -> list[dict[str, Any]]:
    """Cross-record checks that a schema alone cannot express."""
    errors: list[dict[str, Any]] = []

    def err(loc: list[Any], msg: str) -> None:
        if len(errors) < 50:
            errors.append({"loc": loc, "msg": msg})

    def unique(name: str, items: list[Any]) -> None:
        seen: set[UUID] = set()
        for i, item in enumerate(items):
            if item.id in seen:
                err([name, i, "id"], "duplicate id")
            seen.add(item.id)

    for name in ("accounts", "categories", "transactions", "budgets", "savings_goals", "savings_contributions",
                 "recurring_payments"):
        unique(name, getattr(backup, name))

    accounts = {a.id for a in backup.accounts}
    names: set[str] = set()
    for i, a in enumerate(backup.accounts):
        if a.name.lower() in names:
            err(["accounts", i, "name"], "duplicate account name")
        names.add(a.name.lower())
    categories = {c.id: c.kind for c in backup.categories}
    cat_names: set[tuple[str, str]] = set()
    for i, c in enumerate(backup.categories):
        key = (c.kind.value, c.name.lower())
        if key in cat_names:
            err(["categories", i, "name"], "duplicate category name")
        cat_names.add(key)
    goals = {g.id for g in backup.savings_goals}
    recurring = {r.id for r in backup.recurring_payments}

    def check_category(loc: list[Any], category_id: UUID | None, ttype: str) -> None:
        if category_id is None:
            return
        if category_id not in categories:
            err(loc, "unknown category_id")
        elif categories[category_id] != CATEGORY_KIND_FOR_TYPE[TransactionType(ttype)]:
            err(loc, f"category kind does not match a {ttype}")

    for i, t in enumerate(backup.transactions):
        if t.account_id not in accounts:
            err(["transactions", i, "account_id"], "unknown account_id")
        if t.to_account_id and t.to_account_id not in accounts:
            err(["transactions", i, "to_account_id"], "unknown to_account_id")
        if t.type != TransactionType.transfer:
            check_category(["transactions", i, "category_id"], t.category_id, t.type)
        if t.recurring_payment_id and t.recurring_payment_id not in recurring:
            err(["transactions", i, "recurring_payment_id"], "unknown recurring_payment_id")
    occurrences: set[tuple[UUID, Any]] = set()
    for i, t in enumerate(backup.transactions):
        if t.recurring_payment_id and t.recurring_occurrence:
            key = (t.recurring_payment_id, t.recurring_occurrence)
            if key in occurrences:
                err(["transactions", i, "recurring_occurrence"], "duplicate recurring occurrence")
            occurrences.add(key)

    budget_scopes: set[UUID | None] = set()
    for i, b in enumerate(backup.budgets):
        if b.category_id is not None and categories.get(b.category_id) != "expense":
            err(["budgets", i, "category_id"], "budget category must be an existing expense category")
        if b.category_id in budget_scopes:
            err(["budgets", i, "category_id"], "duplicate budget for this scope")
        budget_scopes.add(b.category_id)

    for i, r in enumerate(backup.recurring_payments):
        if r.account_id not in accounts:
            err(["recurring_payments", i, "account_id"], "unknown account_id")
        check_category(["recurring_payments", i, "category_id"], r.category_id, r.type)

    tz = backup.preferences.timezone
    if tz is not None and not is_valid_timezone(tz):
        err(["preferences", "timezone"], "unknown timezone")

    balance: dict[UUID, int] = defaultdict(int)
    for i, c in enumerate(sorted(backup.savings_contributions, key=lambda c: c.contributed_on)):
        if c.goal_id not in goals:
            err(["savings_contributions", i, "goal_id"], "unknown goal_id")
        balance[c.goal_id] += c.amount if c.kind == ContributionKind.contribution else -c.amount
    for goal_id, saved in balance.items():
        if saved < 0:
            err(["savings_contributions"], f"withdrawals exceed contributions for goal {goal_id}")
    return errors


def delete_all(db: Db) -> None:
    for table in USER_TABLES_IN_DELETE_ORDER:
        db.execute(f"delete from public.{table} where user_id = %s", (db.user_id,))


def reset(db: Db) -> None:
    delete_all(db)
    categories_repo.seed_defaults(db)


def restore(db: Db, backup: Backup) -> dict[str, int]:
    errors = validate_references(backup)
    if errors:
        raise ValidationFailed("The backup file failed validation. Nothing was changed.",
                               code="invalid_backup", details=errors)
    u = db.user_id
    delete_all(db)  # same DB transaction as the inserts: all-or-nothing

    def insert(table: str, columns: list[str], values: list[Any]) -> Any:
        return db.scalar(
            f"insert into public.{table} (user_id, {', '.join(columns)}) "
            f"values (%s, {', '.join(['%s'] * len(columns))}) returning id",
            (u, *values),
        )

    ids: dict[UUID, Any] = {}
    for c in backup.categories:
        ids[c.id] = insert("categories", ["name", "kind", "color", "icon", "is_archived"],
                           [c.name, c.kind, c.color, c.icon, c.is_archived])
    for a in backup.accounts:
        ids[a.id] = insert("accounts", ["name", "type", "opening_balance", "currency", "is_archived"],
                           [a.name, a.type, a.opening_balance, a.currency, a.is_archived])
    for r in backup.recurring_payments:
        ids[r.id] = insert("recurring_payments",
                           ["name", "type", "amount", "category_id", "account_id", "payment_method", "frequency",
                            "next_due_date", "is_active", "notes"],
                           [r.name, r.type, r.amount, ids.get(r.category_id), ids[r.account_id], r.payment_method,
                            r.frequency, r.next_due_date, r.is_active, r.notes])
    with db.conn.cursor() as cur:
        cur.executemany(
            """insert into public.transactions (user_id, type, amount, description, category_id, account_id,
                   to_account_id, occurred_on, occurred_time, payment_method, notes, tags, recurring_payment_id,
                   recurring_occurrence)
               values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            [(u, t.type, t.amount, t.description, ids.get(t.category_id), ids[t.account_id],
              ids.get(t.to_account_id), t.occurred_on, t.occurred_time, t.payment_method, t.notes, t.tags,
              ids.get(t.recurring_payment_id),
              t.recurring_occurrence if t.recurring_payment_id else None) for t in backup.transactions],
        )
    for b in backup.budgets:
        insert("budgets", ["name", "category_id", "amount", "alert_threshold", "start_month"],
               [b.name, ids.get(b.category_id), b.amount, b.alert_threshold, parse_month(b.start_month)])
    for g in backup.savings_goals:
        ids[g.id] = insert("savings_goals", ["name", "target_amount", "target_date", "description", "color",
                                             "is_archived"],
                           [g.name, g.target_amount, g.target_date, g.description, g.color, g.is_archived])
    for c in backup.savings_contributions:
        insert("savings_contributions", ["goal_id", "kind", "amount", "contributed_on", "note"],
               [ids[c.goal_id], c.kind, c.amount, c.contributed_on, c.note])

    if backup.profile.display_name is not None:
        db.execute("update public.profiles set display_name = %s where id = %s", (backup.profile.display_name or None, u))
    prefs = {k: v for k, v in backup.preferences.model_dump(exclude_unset=True).items() if v is not None}
    if prefs:
        db.execute(f"update public.user_preferences set {', '.join(f'{k} = %s' for k in prefs)} where user_id = %s",
                   (*prefs.values(), u))
    return {name: len(getattr(backup, name)) for name in
            ("accounts", "categories", "transactions", "budgets", "savings_goals", "savings_contributions",
             "recurring_payments")}
