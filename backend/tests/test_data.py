import copy


def _seed(user):
    bank = user.account("Bank", opening_balance=50_000_00)
    card = user.account("Card", "credit_card", -500_00)
    food = user.category("Food & Dining")
    custom = user.post("/api/categories", {"name": "Pets", "kind": "expense", "color": "#112233",
                                           "icon": "dog"}).json()
    user.tx("expense", 1_234_56, bank["id"], "2026-10-02", category_id=food["id"], tags=["Work", "work"],
            occurred_time="13:45", notes="team lunch")
    user.tx("expense", 99_00, card["id"], "2026-10-03", category_id=custom["id"])
    user.tx("transfer", 500_00, bank["id"], "2026-10-04", to_account_id=card["id"])
    user.post("/api/budgets", {"name": "Food", "category_id": food["id"], "amount": 5_000_00})
    g = user.post("/api/savings-goals", {"name": "Goal", "target_amount": 10_000_00}).json()
    user.post(f"/api/savings-goals/{g['id']}/contributions", {"kind": "contribution", "amount": 1_000_00,
                                                              "contributed_on": "2026-10-01"})
    rec = user.post("/api/recurring-payments", {"name": "Rent", "type": "expense", "amount": 100,
                                                "account_id": bank["id"], "frequency": "monthly",
                                                "next_due_date": "2026-10-05"}).json()
    user.post(f"/api/recurring-payments/{rec['id']}/record")
    user.patch("/api/profile", {"display_name": "Asha", "preferences": {"theme": "dark"}})
    return bank


def test_tags_are_normalised(user):
    bank = user.account("Bank")
    assert user.tx("expense", 1, bank["id"], tags=["Work", "work", "  Trip "])["tags"] == ["work", "trip"]


def test_export_restore_roundtrip(user, other_user):
    _seed(user)
    backup = user.get("/api/data/export")
    assert backup.status_code == 200 and "attachment" in backup.headers["content-disposition"]
    data = backup.json()
    assert data["format"] == "fintrack-backup" and len(data["transactions"]) == 4

    r = other_user.post("/api/data/restore", data)
    assert r.status_code == 200, r.text
    assert r.json()["restored"]["transactions"] == 4
    mine = user.get("/api/accounts").json()
    theirs = other_user.get("/api/accounts").json()
    assert mine["totals"] == theirs["totals"]
    assert {a["name"]: a["current_balance"] for a in mine["items"]} == \
           {a["name"]: a["current_balance"] for a in theirs["items"]}
    assert other_user.get("/api/profile").json()["display_name"] == "Asha"
    assert other_user.get("/api/budgets").json()["categories"][0]["spent"] == 1_234_56
    assert other_user.get("/api/savings-goals").json()["totals"]["saved"] == 1_000_00
    # Fresh ids: the original user's records are untouched and distinct.
    assert {a["id"] for a in mine["items"]}.isdisjoint({a["id"] for a in theirs["items"]})
    # Restore replaces, it doesn't append.
    other_user.post("/api/data/restore", data)
    assert other_user.get("/api/transactions").json()["total"] == 4


def test_invalid_backup_is_rejected_without_changes(user):
    _seed(user)
    good = user.get("/api/data/export").json()
    before = user.get("/api/transactions").json()["total"]

    cases = []
    bad = copy.deepcopy(good)
    bad["transactions"][0]["account_id"] = "00000000-0000-0000-0000-000000000000"
    cases.append(bad)
    bad = copy.deepcopy(good)
    bad["transactions"][0]["amount"] = -5
    cases.append(bad)
    bad = copy.deepcopy(good)
    bad["format"] = "something-else"
    cases.append(bad)
    bad = copy.deepcopy(good)
    bad["transactions"].append(copy.deepcopy(bad["transactions"][0]))  # duplicate id
    cases.append(bad)
    bad = copy.deepcopy(good)
    bad["savings_contributions"][0]["kind"] = "withdrawal"  # withdraw more than saved
    cases.append(bad)
    bad = copy.deepcopy(good)
    bad["accounts"][0]["user_id"] = "00000000-0000-0000-0000-000000000000"  # unknown field
    cases.append(bad)

    for case in cases:
        r = user.post("/api/data/restore", case)
        assert r.status_code == 422, r.text
        assert r.json()["error"]["details"]
    assert user.get("/api/transactions").json()["total"] == before


def test_reset_requires_confirmation(user):
    _seed(user)
    assert user.post("/api/data/reset", {"confirm": "yes"}).status_code == 422
    assert user.get("/api/transactions").json()["total"] == 4
    assert user.post("/api/data/reset", {"confirm": "RESET"}).status_code == 200
    assert user.get("/api/transactions").json()["total"] == 0
    assert user.get("/api/accounts").json()["items"] == []
    assert len(user.get("/api/categories").json()) == 19  # defaults restored
    assert user.get("/api/profile").json()["display_name"] == "Asha"  # profile kept


def test_demo_mode_is_labelled_and_removable(user, frozen_today):
    bank = user.account("Real bank", opening_balance=1_000_00)
    real_tx = user.tx("expense", 100, bank["id"], "2026-10-01")
    assert user.get("/api/demo").json() == {"loaded": False}
    assert user.post("/api/demo").status_code == 201
    assert user.post("/api/demo").status_code == 409
    txs = user.get("/api/transactions", params={"page_size": 100}).json()
    assert txs["total"] > 50
    assert all(t["is_demo"] for t in txs["items"] if t["id"] != real_tx["id"])
    assert user.get("/api/onboarding").json()["demo_loaded"] is True
    assert user.get("/api/analytics/insights", params={"period": "this_month"}).json()["items"]
    assert user.delete("/api/demo").json() == {"loaded": False}
    remaining = user.get("/api/transactions").json()
    assert [t["id"] for t in remaining["items"]] == [real_tx["id"]]
    assert [a["name"] for a in user.get("/api/accounts").json()["items"]] == ["Real bank"]
    assert user.get("/api/savings-goals").json()["items"] == []
    assert user.get("/api/recurring-payments").json()["items"] == []


def test_onboarding_and_profile(user):
    o = user.get("/api/onboarding").json()
    assert o == {"has_account": False, "has_income": False, "has_expense": False, "has_budget": False,
                 "demo_loaded": False, "dismissed": False}
    bank = user.account("Bank")
    user.tx("income", 1, bank["id"])
    o = user.get("/api/onboarding").json()
    assert o["has_account"] and o["has_income"] and not o["has_expense"]
    r = user.patch("/api/profile", {"preferences": {"onboarding_dismissed": True, "timezone": "Europe/London",
                                                    "date_format": "DD/MM/YYYY"}})
    assert r.status_code == 200 and r.json()["preferences"]["timezone"] == "Europe/London"
    assert user.patch("/api/profile", {"preferences": {"timezone": "Mars/Olympus"}}).status_code == 400
    assert user.patch("/api/profile", {"preferences": {"currency": "USD"}}).status_code == 422
    assert user.get("/api/profile").json()["email"] == user.email
