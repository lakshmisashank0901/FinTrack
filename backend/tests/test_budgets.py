import pytest


@pytest.fixture
def setup(user, frozen_today):
    bank = user.account("Bank", opening_balance=1_000_000_00)
    food, shop = user.category("Food & Dining"), user.category("Shopping")
    return {"bank": bank, "food": food, "shop": shop}


def test_budget_spending_status_and_refunds(user, setup):
    s = setup
    overall = user.post("/api/budgets", {"name": "All", "amount": 10_000_00})
    assert overall.status_code == 201 and overall.json()["start_month"] == "2026-10"
    food = user.post("/api/budgets", {"name": "Food", "category_id": s["food"]["id"], "amount": 1_000_00,
                                      "alert_threshold": 75}).json()
    user.tx("expense", 700_00, s["bank"]["id"], "2026-10-03", category_id=s["food"]["id"])
    user.tx("expense", 200_00, s["bank"]["id"], "2026-10-04", category_id=s["food"]["id"])
    user.tx("expense", 3_000_00, s["bank"]["id"], "2026-10-05", category_id=s["shop"]["id"])
    user.tx("expense", 9_999_00, s["bank"]["id"], "2026-09-05", category_id=s["food"]["id"])  # other month
    user.tx("income", 50_000_00, s["bank"]["id"], "2026-10-01")
    wallet = user.account("Wallet", "cash")
    user.tx("transfer", 5_000_00, s["bank"]["id"], "2026-10-02", to_account_id=wallet["id"])  # not spending

    month = user.get("/api/budgets", params={"month": "2026-10"}).json()
    f = month["categories"][0]
    assert f["id"] == food["id"] and f["spent"] == 900_00 and f["remaining"] == 100_00
    assert f["percent_used"] == 90.0 and f["status"] == "approaching"
    assert month["overall"]["spent"] == 3_900_00 and month["overall"]["status"] == "on_track"
    assert month["summary"] == {"total_spent": 3_900_00, "category_budgeted": 1_000_00,
                                "category_spent": 900_00, "unbudgeted_spent": 3_000_00}

    user.tx("expense", 200_00, s["bank"]["id"], "2026-10-06", category_id=s["food"]["id"])
    assert user.get("/api/budgets").json()["categories"][0]["status"] == "exceeded"
    user.tx("refund", 300_00, s["bank"]["id"], "2026-10-07", category_id=s["food"]["id"])
    f = user.get("/api/budgets").json()["categories"][0]
    assert f["spent"] == 800_00 and f["status"] == "approaching"


def test_budget_not_active_before_start_month(user, setup):
    user.post("/api/budgets", {"name": "All", "amount": 100, "start_month": "2026-10"})
    assert user.get("/api/budgets", params={"month": "2026-09"}).json()["overall"] is None


def test_duplicate_and_invalid_budgets(user, setup):
    assert user.post("/api/budgets", {"name": "A", "amount": 100}).status_code == 201
    r = user.post("/api/budgets", {"name": "B", "amount": 100})
    assert r.status_code == 409 and r.json()["error"]["code"] == "duplicate_budget"
    salary = user.category("Salary", "income")
    assert user.post("/api/budgets", {"name": "C", "amount": 100, "category_id": salary["id"]}).status_code == 400
    assert user.post("/api/budgets", {"name": "D", "amount": 0}).status_code == 422
    assert user.post("/api/budgets", {"name": "E", "amount": 1, "alert_threshold": 150}).status_code == 422
    assert user.post("/api/budgets", {"name": "F", "amount": 1, "start_month": "2026-13"}).status_code == 422


def test_update_delete_and_history(user, setup):
    b = user.post("/api/budgets", {"name": "Food", "category_id": setup["food"]["id"], "amount": 1_000_00,
                                   "start_month": "2026-09"}).json()
    user.tx("expense", 1_500_00, setup["bank"]["id"], "2026-09-10", category_id=setup["food"]["id"])
    user.tx("expense", 400_00, setup["bank"]["id"], "2026-10-10", category_id=setup["food"]["id"])
    user.tx("expense", 999_00, setup["bank"]["id"], "2026-10-10", category_id=setup["shop"]["id"])
    history = user.get("/api/budgets/history", params={"months": 3}).json()["items"]
    assert [h["month"] for h in history] == ["2026-08", "2026-09", "2026-10"]
    assert history[0]["status"] == "none"
    assert history[1] == {"month": "2026-09", "budgeted": 1_000_00, "spent": 1_500_00, "status": "exceeded"}
    assert history[2] == {"month": "2026-10", "budgeted": 1_000_00, "spent": 400_00, "status": "on_track"}

    r = user.patch(f"/api/budgets/{b['id']}", {"amount": 450_00})
    assert r.json()["status"] == "approaching"
    assert user.delete(f"/api/budgets/{b['id']}").status_code == 204
    assert user.get("/api/budgets").json()["categories"] == []


def test_deleting_category_removes_its_budget_and_uncategorises_transactions(user, setup):
    cat = user.post("/api/categories", {"name": "Pets", "kind": "expense", "color": "#123456", "icon": "dog"}).json()
    user.post("/api/budgets", {"name": "Pets", "category_id": cat["id"], "amount": 100})
    tx = user.tx("expense", 50, setup["bank"]["id"], "2026-10-10", category_id=cat["id"])
    assert user.delete(f"/api/categories/{cat['id']}").status_code == 204
    assert user.get(f"/api/transactions/{tx['id']}").json()["category"] is None
    assert user.get("/api/budgets").json()["categories"] == []
    dup = user.post("/api/categories", {"name": "food & dining", "kind": "expense"})
    assert dup.status_code == 409
