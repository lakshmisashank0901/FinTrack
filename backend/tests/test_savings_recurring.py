from datetime import date

import pytest


def test_savings_goal_contributions_and_withdrawals(user, frozen_today):
    bank = user.account("Bank", opening_balance=100_000_00)
    g = user.post("/api/savings-goals", {"name": "Laptop", "target_amount": 1_20_000_00,
                                         "target_date": "2027-04-24"}).json()
    assert g["saved_amount"] == 0 and g["progress_percent"] == 0 and g["monthly_needed"] == 1_20_000_00 // 7 + 1
    url = f"/api/savings-goals/{g['id']}/contributions"
    g = user.post(url, {"kind": "contribution", "amount": 30_000_00, "contributed_on": "2026-10-01"}).json()
    g = user.post(url, {"kind": "withdrawal", "amount": 5_000_00, "contributed_on": "2026-10-10"}).json()
    assert g["saved_amount"] == 25_000_00 and g["remaining_amount"] == 95_000_00
    assert g["progress_percent"] == round(25_000 / 1_20_000 * 100, 1)
    assert [c["kind"] for c in g["recent_contributions"]] == ["withdrawal", "contribution"]
    r = user.post(url, {"kind": "withdrawal", "amount": 25_000_01, "contributed_on": "2026-10-11"})
    assert r.status_code == 400 and r.json()["error"]["code"] == "insufficient_savings"
    # Earmarks never touch accounts or spending.
    assert user.balance(bank["id"]) == 100_000_00
    assert user.get("/api/analytics/summary", params={"period": "this_month"}).json()["expenses"]["current"] == 0
    # Deleting the contribution would leave the withdrawal unbacked.
    contribution = g["recent_contributions"][1]
    assert user.delete(f"{url}/{contribution['id']}").status_code == 400
    totals = user.get("/api/savings-goals").json()["totals"]
    assert totals == {"target": 1_20_000_00, "saved": 25_000_00}


def test_goal_update_archive_delete(user, frozen_today):
    g = user.post("/api/savings-goals", {"name": "Trip", "target_amount": 100}).json()
    assert g["monthly_needed"] is None
    g = user.patch(f"/api/savings-goals/{g['id']}", {"is_archived": True, "target_amount": 200}).json()
    assert g["is_archived"] and g["target_amount"] == 200
    assert user.get("/api/savings-goals").json()["items"] == []
    assert len(user.get("/api/savings-goals", params={"include_archived": True}).json()["items"]) == 1
    assert user.delete(f"/api/savings-goals/{g['id']}").status_code == 204
    assert user.post("/api/savings-goals", {"name": "x", "target_amount": -1}).status_code == 422


@pytest.fixture
def rent(user, frozen_today):
    bank = user.account("Bank", opening_balance=100_000_00)
    housing = user.category("Housing & Rent")
    r = user.post("/api/recurring-payments", {"name": "Rent", "type": "expense", "amount": 25_000_00,
                                              "category_id": housing["id"], "account_id": bank["id"],
                                              "payment_method": "net_banking", "frequency": "monthly",
                                              "next_due_date": "2026-10-31"})
    assert r.status_code == 201, r.text
    return {"bank": bank, "payment": r.json()}


def test_recurring_list_and_estimates(user, rent):
    user.post("/api/recurring-payments", {"name": "Gym", "type": "expense", "amount": 1_200_00,
                                          "account_id": rent["bank"]["id"], "frequency": "quarterly",
                                          "next_due_date": "2026-10-20"})
    user.post("/api/recurring-payments", {"name": "Salary", "type": "income", "amount": 90_000_00,
                                          "account_id": rent["bank"]["id"], "frequency": "monthly",
                                          "next_due_date": "2026-11-01"})
    body = user.get("/api/recurring-payments").json()
    s = body["summary"]
    assert s["monthly_expense_estimate"] == 25_000_00 + 400_00
    assert s["monthly_income_estimate"] == 90_000_00 and s["active_count"] == 3
    assert [u["name"] for u in s["upcoming"]] == ["Gym", "Rent", "Salary"]
    gym = next(i for i in body["items"] if i["name"] == "Gym")
    assert gym["is_overdue"] and gym["days_until_due"] == -4
    # Scheduled items are not transactions.
    assert user.get("/api/transactions").json()["total"] == 0


def test_record_payment_creates_one_transaction_and_advances(user, rent):
    pid = rent["payment"]["id"]
    r = user.post(f"/api/recurring-payments/{pid}/record")
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["transaction"]["amount"] == 25_000_00 and body["transaction"]["occurred_on"] == "2026-10-31"
    assert body["transaction"]["recurring_payment_id"] == pid
    assert body["payment"]["next_due_date"] == "2026-11-30"
    assert user.balance(rent["bank"]["id"]) == 75_000_00
    # Rewind the schedule: recording the same occurrence again must fail.
    user.patch(f"/api/recurring-payments/{pid}", {"next_due_date": "2026-10-31"})
    r = user.post(f"/api/recurring-payments/{pid}/record")
    assert r.status_code == 409 and r.json()["error"]["code"] == "already_recorded"
    assert user.get("/api/transactions").json()["total"] == 1
    # Override amount and date for the next one.
    user.patch(f"/api/recurring-payments/{pid}", {"next_due_date": "2026-11-30"})
    r = user.post(f"/api/recurring-payments/{pid}/record", {"amount": 26_000_00, "occurred_on": "2026-11-29"})
    assert r.json()["transaction"]["amount"] == 26_000_00


def test_record_is_atomic_when_it_fails(user, rent):
    pid = rent["payment"]["id"]
    user.patch(f"/api/accounts/{rent['bank']['id']}", {"is_archived": True})
    r = user.post(f"/api/recurring-payments/{pid}/record")
    assert r.status_code == 400
    assert user.get(f"/api/recurring-payments/{pid}").json()["next_due_date"] == "2026-10-31"
    assert user.get("/api/transactions").json()["total"] == 0


def test_skip_toggle_delete(user, rent):
    pid = rent["payment"]["id"]
    assert user.post(f"/api/recurring-payments/{pid}/skip").json()["next_due_date"] == "2026-11-30"
    p = user.patch(f"/api/recurring-payments/{pid}", {"is_active": False}).json()
    assert not p["is_active"] and not p["is_overdue"]
    assert user.post(f"/api/recurring-payments/{pid}/record").status_code == 400
    assert user.get("/api/recurring-payments").json()["summary"]["monthly_expense_estimate"] == 0
    assert user.delete(f"/api/recurring-payments/{pid}").status_code == 204


def test_recurring_validation(user, rent):
    salary = user.category("Salary", "income")
    base = {"name": "x", "type": "expense", "amount": 100, "account_id": rent["bank"]["id"],
            "frequency": "monthly", "next_due_date": "2026-11-01"}
    assert user.post("/api/recurring-payments", {**base, "category_id": salary["id"]}).status_code == 400
    assert user.post("/api/recurring-payments", {**base, "type": "transfer"}).status_code == 422
    assert user.post("/api/recurring-payments", {**base, "frequency": "daily"}).status_code == 422
    assert date.fromisoformat(rent["payment"]["next_due_date"])
