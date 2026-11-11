"""The user's "today", in their preferred timezone (Asia/Kolkata by default)."""
from datetime import date

from app.core.database import Db
from app.utils.dates import today_in


def user_timezone(db: Db) -> str:
    return db.scalar("select timezone from public.user_preferences where user_id = %s", (db.user_id,)) or "Asia/Kolkata"


def user_today(db: Db) -> date:
    return today_in(user_timezone(db))
