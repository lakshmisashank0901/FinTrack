from datetime import date, timedelta
from typing import Any
from uuid import UUID

from app.core.database import Db
from app.models.enums import PAYMENT_METHOD_LABELS, BudgetState, Interval, PaymentMethod, Period
from app.repositories import accounts as accounts_repo
from app.repositories import analytics as repo
from app.services import budgets as budgets_service
from app.services import clock
from app.services import recurring as recurring_service
from app.services.accounts import compute_totals
from app.utils.dates import (
    DateRange,
    add_months,
    bucket_label,
    buckets,
    default_interval,
    format_month,
    month_end,
    month_start,
    resolve_range,
)
from app.utils.money import change_percent, format_inr, percent


def user_default_period(db: Db) -> Period:
    value = db.scalar("select default_period from public.user_preferences where user_id = %s", (db.user_id,))
    return Period(value or Period.this_month)


def get_range(db: Db, period: Period | None, start: date | None, end: date | None) -> DateRange:
    if period is None and not (start and end):
        period = user_default_period(db)
    return resolve_range(period or Period.custom, clock.user_today(db), start, end)


def savings_rate(income: int, net_spending: int) -> float | None:
    if income <= 0:
        return None
    return round((income - net_spending) / income * 100, 1)


def _breakdown_items(rows: list[dict[str, Any]]) -> tuple[int, list[dict[str, Any]]]:
    items = [r for r in rows if r["amount"] > 0]
    total = sum(r["amount"] for r in items)
    return total, [{**r, "percent": percent(r["amount"], total) or 0.0} for r in items]


def summary(db: Db, r: DateRange, category_id: UUID | None) -> dict[str, Any]:
    current = repo.flow_totals(db, r.start, r.end, category_id)
    has_previous = repo.has_data_before(db, r.start)
    previous = repo.flow_totals(db, r.previous_start, r.previous_end, category_id) if has_previous else None
    # Income / cash flow / savings rate always span all categories.
    current_all = current if category_id is None else repo.flow_totals(db, r.start, r.end)
    previous_all = previous if (category_id is None or previous is None) else repo.flow_totals(
        db, r.previous_start, r.previous_end)

    net_spending = current["expenses"] - current["refunds"]
    net_spending_all = current_all["expenses"] - current_all["refunds"]
    prev_spending = previous["expenses"] - previous["refunds"] if previous else None
    prev_spending_all = previous_all["expenses"] - previous_all["refunds"] if previous_all else None

    accounts = accounts_repo.list_accounts(db, include_archived=False)
    totals = compute_totals(accounts)
    _, categories = _breakdown_items(repo.spending_by_category(db, r.start, r.end, category_id))
    top = categories[0] if categories else None
    largest = repo.largest_expense(db, r.start, r.end, category_id)

    rate = savings_rate(current_all["income"], net_spending_all)
    prev_rate = savings_rate(previous_all["income"], prev_spending_all) if previous_all else None  # type: ignore[arg-type]

    month = month_start(r.end)
    budget_month = budgets_service.month_status(db, month)
    utilization = None
    if budget_month["overall"] or budget_month["categories"]:
        if budget_month["overall"]:
            budgeted, spent = budget_month["overall"]["amount"], budget_month["overall"]["spent"]
        else:
            budgeted = budget_month["summary"]["category_budgeted"]
            spent = budget_month["summary"]["category_spent"]
        utilization = {"month": format_month(month), "budgeted": budgeted, "spent": spent,
                       "percent": percent(spent, budgeted) or 0.0}

    return {
        "range": r.as_dict(),
        "balance": {
            **totals,
            "period_change": repo.net_change(db, r.start, r.end),
            "accounts": [{"id": a["id"], "name": a["name"], "type": a["type"], "balance": a["current_balance"],
                          "is_liability": a["is_liability"]} for a in accounts],
        },
        "income": {"current": current_all["income"], "previous": previous_all["income"] if previous_all else None,
                   "change_percent": change_percent(current_all["income"],
                                                    previous_all["income"] if previous_all else None)},
        "expenses": {"current": net_spending, "previous": prev_spending,
                     "change_percent": change_percent(net_spending, prev_spending)},
        "refunds": {"current": current["refunds"]},
        "net_cash_flow": {"current": current_all["income"] - net_spending_all,
                          "previous": (previous_all["income"] - prev_spending_all) if previous_all else None},
        "savings_rate": {"current": rate, "previous": prev_rate,
                         "change_points": round(rate - prev_rate, 1) if rate is not None and prev_rate is not None
                         else None},
        "average_daily_spending": max(0, net_spending) // r.days,
        "largest_expense": largest,
        "top_category": ({"category_id": top["category_id"], "name": top["name"], "color": top["color"],
                          "amount": top["amount"], "percent": top["percent"]} if top else None),
        "transaction_count": current["count"],
        "has_previous_data": has_previous,
        "budget_utilization": utilization,
    }


def _points(r_start: date, r_end: date, interval: Interval, rows: dict[date, dict[str, int]],
            keys: tuple[str, ...]) -> list[dict[str, Any]]:
    multi_year = r_start.year != r_end.year
    out = []
    for bucket in buckets(r_start, r_end, interval):
        values = rows.get(bucket, {})
        out.append({"bucket_start": bucket, "label": bucket_label(bucket, interval, multi_year),
                    **{k: values.get(k, 0) for k in keys}})
    return out


def cash_flow(db: Db, r: DateRange, interval: Interval | None, months: int | None) -> dict[str, Any]:
    if months:
        today = clock.user_today(db)
        start = add_months(month_start(today), -(months - 1))
        r = DateRange(Period.custom, start, today, add_months(start, -months), start - timedelta(days=1))
        interval = Interval.month
    interval = interval or default_interval(r)
    rows = {row["bucket"]: {"income": row["income"], "expenses": row["expenses"]}
            for row in repo.flow_by_bucket(db, r.start, r.end, interval)}
    points = _points(r.start, r.end, interval, rows, ("income", "expenses"))
    for p in points:
        p["net"] = p["income"] - p["expenses"]
    return {"range": r.as_dict(), "interval": interval.value, "points": points}


def spending_trend(db: Db, r: DateRange, interval: Interval | None, category_id: UUID | None) -> dict[str, Any]:
    interval = interval or default_interval(r)
    rows = {row["bucket"]: {"amount": row["expenses"]}
            for row in repo.flow_by_bucket(db, r.start, r.end, interval, category_id)}
    points = _points(r.start, r.end, interval, rows, ("amount",))
    total = sum(p["amount"] for p in points)
    return {"range": r.as_dict(), "interval": interval.value, "total": total,
            "average_daily": max(0, total) // r.days, "points": points}


def expense_breakdown(db: Db, r: DateRange, category_id: UUID | None) -> dict[str, Any]:
    total, items = _breakdown_items(repo.spending_by_category(db, r.start, r.end, category_id))
    return {"range": r.as_dict(), "total": total, "items": items}


def top_categories(db: Db, r: DateRange, category_id: UUID | None, limit: int) -> dict[str, Any]:
    _, items = _breakdown_items(repo.spending_by_category(db, r.start, r.end, category_id))
    return {"range": r.as_dict(), "items": items[:limit]}


def payment_methods(db: Db, r: DateRange, category_id: UUID | None) -> dict[str, Any]:
    rows = [row for row in repo.spending_by_payment_method(db, r.start, r.end, category_id) if row["amount"] > 0]
    total = sum(row["amount"] for row in rows)
    items = [{"method": row["method"], "label": PAYMENT_METHOD_LABELS[PaymentMethod(row["method"])],
              "amount": row["amount"], "percent": percent(row["amount"], total) or 0.0,
              "transaction_count": row["transaction_count"]} for row in rows]
    return {"range": r.as_dict(), "total": total, "items": items}


def budget_performance(db: Db, month: str | None) -> dict[str, Any]:
    data = budgets_service.month_status(db, budgets_service.resolve_month(db, month))
    items = [{"budget_id": b["id"], "category_id": b["category_id"], "name": b["category"]["name"] if b["category"]
              else b["name"], "color": b["category"]["color"] if b["category"] else "#64748b",
              "budgeted": b["amount"], "spent": b["spent"], "remaining": b["remaining"],
              "percent_used": b["percent_used"], "status": b["status"]} for b in data["categories"]]
    return {"month": data["month"], "overall": data["overall"], "items": items}


def savings_trend(db: Db, months: int) -> dict[str, Any]:
    today = clock.user_today(db)
    start = add_months(month_start(today), -(months - 1))
    rows = {row["bucket"]: row for row in repo.flow_by_bucket(db, start, month_end(today), Interval.month)}
    items = []
    for i in range(months):
        month = add_months(start, i)
        row = rows.get(month, {"income": 0, "expenses": 0})
        items.append({"month": format_month(month), "label": month.strftime("%b %Y"),
                      "income": row["income"], "expenses": row["expenses"],
                      "net_cash_flow": row["income"] - row["expenses"],
                      "savings_rate": savings_rate(row["income"], row["expenses"])})
    return {"items": items}


PERIOD_PHRASES = {
    Period.this_week: "this week", Period.this_month: "this month", Period.last_month: "last month",
    Period.last_3_months: "over the last 3 months", Period.this_year: "this year", Period.custom: "in this period",
}
COMPARISON_PHRASES = {
    Period.this_week: "the same days last week", Period.this_month: "the same days last month",
    Period.last_month: "the month before", Period.last_3_months: "the previous 3 months",
    Period.this_year: "the same period last year", Period.custom: "the previous period",
}


def insights(db: Db, r: DateRange) -> dict[str, Any]:
    """Plain-language observations, each emitted only when the data supports it."""
    s = summary(db, r, None)
    when, versus = PERIOD_PHRASES[r.period], COMPARISON_PHRASES[r.period]
    items: list[dict[str, str]] = []

    if s["top_category"]:
        top = s["top_category"]
        items.append({"id": "top_category", "tone": "neutral", "title": "Top spending category",
                      "message": f"Your highest spending category {when} is {top['name']} "
                                 f"({format_inr(top['amount'])}, {top['percent']:g}% of spending)."})

    exp = s["expenses"]
    if exp["change_percent"] is not None and exp["previous"] and abs(exp["change_percent"]) >= 1:
        down = exp["change_percent"] < 0
        items.append({"id": "spending_change", "tone": "positive" if down else "negative",
                      "title": "Spending is down" if down else "Spending is up",
                      "message": f"Your expenses {'decreased' if down else 'increased'} by "
                                 f"{abs(exp['change_percent']):g}% compared with {versus} "
                                 f"({format_inr(exp['current'])} vs {format_inr(exp['previous'])})."})

    rate = s["savings_rate"]
    if rate["change_points"] is not None and abs(rate["change_points"]) >= 1:
        up = rate["change_points"] > 0
        items.append({"id": "savings_rate_change", "tone": "positive" if up else "negative",
                      "title": "Savings rate " + ("improved" if up else "dropped"),
                      "message": f"Your savings rate {'increased' if up else 'decreased'} to {rate['current']:g}% "
                                 f"from {rate['previous']:g}% compared with {versus}."})

    if s["income"]["current"] > 0 and s["net_cash_flow"]["current"] < 0:
        items.append({"id": "negative_cash_flow", "tone": "warning", "title": "Spending exceeds income",
                      "message": f"You spent {format_inr(-s['net_cash_flow']['current'])} more than you earned {when}."})

    budget_month = budgets_service.month_status(db, month_start(clock.user_today(db)))
    candidates = ([budget_month["overall"]] if budget_month["overall"] else []) + budget_month["categories"]
    for b in sorted(candidates, key=lambda b: -b["percent_used"]):
        if b["status"] == BudgetState.on_track:
            continue
        label = b["category"]["name"] if b["category"] else "overall"
        if b["status"] == BudgetState.exceeded:
            msg = (f"You have exceeded your {label} budget by {format_inr(b['spent'] - b['amount'])} "
                   f"({b['percent_used']:g}% used).")
        else:
            msg = f"You have used {b['percent_used']:g}% of your {label} budget this month."
        items.append({"id": f"budget_{b['id']}", "tone": "warning", "title": "Budget alert", "message": msg})
        if len([i for i in items if i["id"].startswith("budget_")]) >= 3:
            break

    if s["average_daily_spending"] > 0:
        items.append({"id": "average_daily", "tone": "neutral", "title": "Daily average",
                      "message": f"Your average daily spending {when} is "
                                 f"{format_inr(round(s['average_daily_spending'], -2))}."})

    soon = [u for u in recurring_service.list_payments(db)["summary"]["upcoming"]
            if u["type"] == "expense" and 0 <= u["days_until_due"] <= 7]
    if soon:
        total = sum(u["amount"] for u in soon)
        n = len(soon)
        items.append({"id": "upcoming_recurring", "tone": "neutral", "title": "Upcoming payments",
                      "message": f"{n} recurring payment{'s' if n != 1 else ''} totalling {format_inr(total)} "
                                 f"{'are' if n != 1 else 'is'} due in the next 7 days."})
    return {"range": r.as_dict(), "items": items}
