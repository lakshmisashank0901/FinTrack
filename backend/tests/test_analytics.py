from datetime import date

import pytest


@pytest.fixture
def data(user, frozen_today):
    bank = user.account("Bank", opening_balance=10_000_00)
    card = user.account("Card", "credit_card", -1_000_00)
    food, shop, rent = user.category("Food & Dining"), user.category("Shopping"), user.category("Housing & Rent")
    salary = user.category("Salary", "income")
    # September (previous period)
    user.tx("income", 50_000_00, bank["id"], "2026-09-01", category_id=salary["id"])
    user.tx("expense", 20_000_00, bank["id"], "2026-09-03", category_id=rent["id"], payment_method="net_banking")
    user.tx("expense", 5_000_00, bank["id"], "2026-09-10", category_id=food["id"], payment_method="upi")
    # October (current, today = 24 Oct)
    user.tx("income", 60_000_00, bank["id"], "2026-10-01", category_id=salary["id"])
    user.tx("expense", 20_000_00, bank["id"], "2026-10-03", category_id=rent["id"], payment_method="net_banking")
    user.tx("expense", 3_000_00, bank["id"], "2026-10-05", category_id=food["id"], payment_method="upi")
    user.tx("expense", 4_000_00, card["id"], "2026-10-12", category_id=shop["id"], payment_method="credit_card")
    user.tx("refund", 1_000_00, card["id"], "2026-10-15", category_id=shop["id"], payment_method="credit_card")
    user.tx("transfer", 2_000_00, bank["id"], "2026-10-20", to_account_id=card["id"])
    user.tx("expense", 99_00, bank["id"], "2026-10-25")  # after "today" still inside October — excluded from MTD
    return {"bank": bank, "card": card, "food": food, "shop": shop, "rent": rent}


def test_summary(user, data):
    s = user.get("/api/analytics/summary", params={"period": "this_month"}).json()
    assert s["range"]["start_date"] == "2026-10-01" and s["range"]["end_date"] == "2026-10-24"
    assert s["income"] == {"current": 60_000_00, "previous": 50_000_00, "change_percent": 20.0}
    assert s["expenses"]["current"] == 26_000_00  # 20000 + 3000 + 4000 − 1000 refund
    assert s["expenses"]["previous"] == 25_000_00 and s["expenses"]["change_percent"] == 4.0
    assert s["refunds"]["current"] == 1_000_00
    assert s["net_cash_flow"] == {"current": 34_000_00, "previous": 25_000_00}
    assert s["savings_rate"]["current"] == round(34_000 / 60_000 * 100, 1)
    assert s["savings_rate"]["previous"] == 50.0
    assert s["average_daily_spending"] == 26_000_00 // 24
    assert s["largest_expense"]["amount"] == 20_000_00
    assert s["top_category"]["name"] == "Housing & Rent"
    assert s["has_previous_data"] is True
    # Net worth: bank 10000+50000−25000+60000−23000−2000−99 ; card −1000−4000+1000+2000
    bank = 10_000_00 + 50_000_00 - 25_000_00 + 60_000_00 - 23_000_00 - 2_000_00 - 99_00
    card = -1_000_00 - 4_000_00 + 1_000_00 + 2_000_00
    assert s["balance"]["assets"] == bank and s["balance"]["liabilities"] == -card
    assert s["balance"]["net_worth"] == bank + card
    assert s["balance"]["period_change"] == 34_000_00
    assert s["budget_utilization"] is None


def test_summary_category_filter_only_affects_spending(user, data):
    s = user.get("/api/analytics/summary", params={"period": "this_month",
                                                   "category_id": data["shop"]["id"]}).json()
    assert s["expenses"]["current"] == 3_000_00
    assert s["income"]["current"] == 60_000_00
    assert s["net_cash_flow"]["current"] == 34_000_00


def test_no_invented_comparisons_without_history(user, frozen_today):
    bank = user.account("Bank")
    user.tx("income", 1_000_00, bank["id"], "2026-10-02")
    user.tx("expense", 500_00, bank["id"], "2026-10-03")
    s = user.get("/api/analytics/summary", params={"period": "this_month"}).json()
    assert s["has_previous_data"] is False
    assert s["income"]["previous"] is None and s["income"]["change_percent"] is None
    assert s["expenses"]["change_percent"] is None and s["savings_rate"]["change_points"] is None
    ids = {i["id"] for i in user.get("/api/analytics/insights", params={"period": "this_month"}).json()["items"]}
    assert "spending_change" not in ids and "savings_rate_change" not in ids
    assert "top_category" in ids  # Uncategorised is still a fact


def test_empty_account_has_no_insights_or_breakdown(user, frozen_today):
    assert user.get("/api/analytics/insights").json()["items"] == []
    b = user.get("/api/analytics/expense-breakdown").json()
    assert b["total"] == 0 and b["items"] == []
    s = user.get("/api/analytics/summary").json()
    assert s["savings_rate"]["current"] is None and s["largest_expense"] is None and s["top_category"] is None


def test_default_period_comes_from_preferences(user, data):
    user.patch("/api/profile", {"preferences": {"default_period": "last_month"}})
    s = user.get("/api/analytics/summary").json()
    assert s["range"]["period"] == "last_month" and s["income"]["current"] == 50_000_00


def test_cash_flow_buckets(user, data):
    year = user.get("/api/analytics/cash-flow", params={"period": "this_year", "interval": "month"}).json()
    assert len(year["points"]) == 10  # Jan..Oct, not one aggregated point
    oct_point = year["points"][-1]
    assert oct_point["label"] == "Oct" and oct_point["income"] == 60_000_00 and oct_point["expenses"] == 26_000_00
    assert oct_point["net"] == 34_000_00
    month = user.get("/api/analytics/cash-flow", params={"period": "this_month"}).json()
    assert month["interval"] == "day" and len(month["points"]) == 24
    assert month["points"][0]["income"] == 60_000_00
    last12 = user.get("/api/analytics/cash-flow", params={"months": 12}).json()
    assert len(last12["points"]) == 12 and last12["points"][0]["bucket_start"] == "2025-11-01"
    q = user.get("/api/analytics/cash-flow", params={"period": "last_3_months"}).json()
    assert q["interval"] == "week"


def test_custom_range_validation(user, data):
    assert user.get("/api/analytics/summary", params={"period": "custom"}).status_code == 400
    assert user.get("/api/analytics/summary", params={"period": "bogus"}).status_code == 422
    r = user.get("/api/analytics/summary", params={"start_date": "2026-09-01", "end_date": "2026-09-30"}).json()
    assert r["range"]["period"] == "custom" and r["income"]["current"] == 50_000_00


def test_breakdown_payment_methods_top_categories(user, data):
    b = user.get("/api/analytics/expense-breakdown", params={"period": "this_month"}).json()
    assert b["total"] == 26_000_00
    names = [(i["name"], i["amount"]) for i in b["items"]]
    assert names == [("Housing & Rent", 20_000_00), ("Food & Dining", 3_000_00), ("Shopping", 3_000_00)]
    assert round(sum(i["percent"] for i in b["items"])) == 100
    pm = user.get("/api/analytics/payment-methods", params={"period": "this_month"}).json()
    assert {i["method"]: i["amount"] for i in pm["items"]} == {"net_banking": 20_000_00, "upi": 3_000_00,
                                                               "credit_card": 3_000_00}
    assert pm["items"][0]["label"] == "Net Banking"
    top = user.get("/api/analytics/top-categories", params={"period": "this_month", "limit": 1}).json()
    assert [i["name"] for i in top["items"]] == ["Housing & Rent"]


def test_spending_trend(user, data):
    t = user.get("/api/analytics/spending-trend", params={"period": "this_month", "interval": "week"}).json()
    assert t["total"] == 26_000_00 and t["average_daily"] == 26_000_00 // 24
    assert all(date.fromisoformat(p["bucket_start"]).weekday() == 0 for p in t["points"])
    d = user.get("/api/analytics/spending-trend", params={"period": "this_month", "interval": "day"}).json()
    assert d["points"][2]["amount"] == 20_000_00 and d["points"][14]["amount"] == -1_000_00


def test_savings_trend_and_budget_performance(user, data):
    trend = user.get("/api/analytics/savings-trend", params={"months": 3}).json()["items"]
    assert [i["month"] for i in trend] == ["2026-08", "2026-09", "2026-10"]
    assert trend[0]["savings_rate"] is None
    assert trend[1]["net_cash_flow"] == 25_000_00 and trend[1]["savings_rate"] == 50.0
    assert trend[2]["expenses"] == 26_099_00  # whole month incl. the 25th
    user.post("/api/budgets", {"name": "Food", "category_id": data["food"]["id"], "amount": 3_500_00})
    perf = user.get("/api/analytics/budget-performance").json()
    assert perf["items"][0]["budgeted"] == 3_500_00 and perf["items"][0]["spent"] == 3_000_00
    s = user.get("/api/analytics/summary", params={"period": "this_month"}).json()
    assert s["budget_utilization"] == {"month": "2026-10", "budgeted": 3_500_00, "spent": 3_000_00, "percent": 85.7}


def test_insights_are_data_backed(user, data):
    user.post("/api/budgets", {"name": "Food", "category_id": data["food"]["id"], "amount": 3_500_00})
    items = {i["id"]: i for i in user.get("/api/analytics/insights", params={"period": "this_month"}).json()["items"]}
    assert "Housing & Rent" in items["top_category"]["message"]
    assert items["spending_change"]["message"].startswith("Your expenses increased by 4%")
    assert "savings_rate_change" in items
    budget_msgs = [v["message"] for k, v in items.items() if k.startswith("budget_")]
    assert budget_msgs == ["You have used 85.7% of your Food & Dining budget this month."]
    assert "₹1,083" in items["average_daily"]["message"]


def test_charts_reflect_changes(user, data):
    def food_amount():
        b = user.get("/api/analytics/expense-breakdown", params={"period": "this_month"}).json()
        return next(i["amount"] for i in b["items"] if i["name"] == "Food & Dining")
    assert food_amount() == 3_000_00
    tx = user.tx("expense", 1_000_00, data["bank"]["id"], "2026-10-21", category_id=data["food"]["id"])
    assert food_amount() == 4_000_00
    user.patch(f"/api/transactions/{tx['id']}", {"amount": 2_500_00})
    assert food_amount() == 5_500_00
    user.delete(f"/api/transactions/{tx['id']}")
    assert food_amount() == 3_000_00
