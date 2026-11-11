from typing import Any

from app.core.database import Db
from app.core.errors import AppError, NotFoundError
from app.core.security import AuthUser
from app.repositories import categories as categories_repo
from app.schemas.profile import ProfileUpdate
from app.utils.dates import is_valid_timezone

PREF_COLUMNS = ("currency", "default_period", "theme", "date_format", "number_format", "timezone",
                "onboarding_dismissed")


def ensure_bootstrap(db: Db, user: AuthUser) -> None:
    """Self-heal accounts created before the signup trigger existed."""
    created = db.scalar(
        "insert into public.profiles (id, email) values (%s, %s) on conflict (id) do nothing returning id",
        (db.user_id, user.email),
    )
    db.execute("insert into public.user_preferences (user_id) values (%s) on conflict (user_id) do nothing",
               (db.user_id,))
    if created and not db.scalar("select exists(select 1 from public.categories where user_id = %s)", (db.user_id,)):
        categories_repo.seed_defaults(db)


def get_profile(db: Db, user: AuthUser) -> dict[str, Any]:
    ensure_bootstrap(db, user)
    row = db.one(
        f"""select p.id, coalesce(p.email, %s) as email, p.display_name, p.created_at,
                   {", ".join("up." + c for c in PREF_COLUMNS)}
              from public.profiles p join public.user_preferences up on up.user_id = p.id
             where p.id = %s""",
        (user.email, db.user_id),
    )
    if not row:
        raise NotFoundError("Profile not found.")
    return {"id": row["id"], "email": row["email"], "display_name": row["display_name"],
            "created_at": row["created_at"], "preferences": {c: row[c] for c in PREF_COLUMNS}}


def update_profile(db: Db, user: AuthUser, payload: ProfileUpdate) -> dict[str, Any]:
    ensure_bootstrap(db, user)
    fields = payload.model_dump(exclude_unset=True)
    if "display_name" in fields:
        db.execute("update public.profiles set display_name = %s where id = %s",
                   (fields["display_name"] or None, db.user_id))
    prefs = {k: v for k, v in (fields.get("preferences") or {}).items() if v is not None}
    if "timezone" in prefs and not is_valid_timezone(prefs["timezone"]):
        raise AppError("Unknown timezone.", code="invalid_timezone")
    if prefs:
        columns = ", ".join(f"{column} = %s" for column in prefs)
        db.execute(f"update public.user_preferences set {columns} where user_id = %s", (*prefs.values(), db.user_id))
    return get_profile(db, user)


def onboarding(db: Db) -> dict[str, Any]:
    row = db.one(
        """select exists(select 1 from public.accounts where user_id = %(u)s and not is_demo) as has_account,
                  exists(select 1 from public.transactions where user_id = %(u)s and type = 'income' and not is_demo)
                    as has_income,
                  exists(select 1 from public.transactions where user_id = %(u)s and type = 'expense' and not is_demo)
                    as has_expense,
                  exists(select 1 from public.budgets where user_id = %(u)s and not is_demo) as has_budget,
                  exists(select 1 from public.accounts where user_id = %(u)s and is_demo) as demo_loaded,
                  coalesce((select onboarding_dismissed from public.user_preferences where user_id = %(u)s), false)
                    as dismissed""",
        {"u": db.user_id},
    )
    assert row is not None
    return row
