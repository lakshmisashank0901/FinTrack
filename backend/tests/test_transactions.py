import csv
import io
import uuid

import pytest


@pytest.fixture
def bank(user):
    return user.account("HDFC", opening_balance=100_000_00)


def test_income_expense_refund_balance_effects(user, bank):
    food = user.category("Food & Dining")
    user.tx("income", 50_000_00, bank["id"], category_id=user.category("Salary", "income")["id"])
    user.tx("expense", 1_250_50, bank["id"], category_id=food["id"])
    user.tx("refund", 250_50, bank["id"], category_id=food["id"])
    assert user.balance(bank["id"]) == 100_000_00 + 50_000_00 - 1_250_50 + 250_50


def test_transfer_moves_money_between_accounts_without_counting(user, bank):
    wallet = user.account("Wallet", "cash", 0)
    user.tx("transfer", 5_000_00, bank["id"], to_account_id=wallet["id"], payment_method="other")
    assert user.balance(bank["id"]) == 95_000_00
    assert user.balance(wallet["id"]) == 5_000_00
    totals = user.get("/api/transactions").json()["totals"]
    assert totals["income"] == 0 and totals["expenses"] == 0 and totals["net_cash_flow"] == 0
    assert user.get("/api/accounts").json()["totals"]["net_worth"] == 100_000_00


def test_credit_card_is_a_liability(user, bank):
    card = user.account("Card", "credit_card", -2_000_00)
    user.tx("expense", 1_000_00, card["id"])
    assert user.balance(card["id"]) == -3_000_00
    totals = user.get("/api/accounts").json()["totals"]
    assert totals == {"assets": 100_000_00, "liabilities": 3_000_00, "net_worth": 97_000_00}
    # Paying the card bill is a transfer: net worth unchanged, liability shrinks.
    user.tx("transfer", 3_000_00, bank["id"], to_account_id=card["id"])
    totals = user.get("/api/accounts").json()["totals"]
    assert totals == {"assets": 97_000_00, "liabilities": 0, "net_worth": 97_000_00}


@pytest.mark.parametrize("bad", [
    {"to_account_id": None},           # transfer without destination
    {"same": True},                    # transfer to itself
])
def test_invalid_transfers_rejected(user, bank, bad):
    body = {"type": "transfer", "amount": 100, "description": "t", "account_id": bank["id"],
            "occurred_on": "2026-10-01", "to_account_id": bank["id"] if bad.get("same") else None}
    r = user.post("/api/transactions", body)
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "invalid_transfer"


def test_transfer_cannot_have_category_and_expense_cannot_have_destination(user, bank):
    wallet = user.account("Wallet", "cash")
    food = user.category("Food & Dining")
    r = user.post("/api/transactions", {"type": "transfer", "amount": 100, "description": "t",
                                        "account_id": bank["id"], "to_account_id": wallet["id"],
                                        "category_id": food["id"], "occurred_on": "2026-10-01"})
    assert r.status_code == 201 and r.json()["category_id"] is None  # category dropped for transfers
    r = user.post("/api/transactions", {"type": "expense", "amount": 100, "description": "t",
                                        "account_id": bank["id"], "to_account_id": wallet["id"],
                                        "occurred_on": "2026-10-01"})
    assert r.status_code == 400


def test_category_kind_must_match_type(user, bank):
    salary = user.category("Salary", "income")
    r = user.post("/api/transactions", {"type": "expense", "amount": 100, "description": "x",
                                        "account_id": bank["id"], "category_id": salary["id"],
                                        "occurred_on": "2026-10-01"})
    assert r.status_code == 400 and r.json()["error"]["code"] == "invalid_category"


@pytest.mark.parametrize("amount", [0, -100, 10.5, "100", 10**15, None])
def test_invalid_amounts_rejected(user, bank, amount):
    r = user.post("/api/transactions", {"type": "expense", "amount": amount, "description": "x",
                                        "account_id": bank["id"], "occurred_on": "2026-10-01"})
    assert r.status_code == 422


@pytest.mark.parametrize("field,value", [("description", ""), ("description", "x" * 141),
                                         ("occurred_on", "2026-13-01"), ("occurred_on", "1900-01-01"),
                                         ("type", "gift"), ("payment_method", "bitcoin"), ("tags", ["a"] * 11)])
def test_invalid_fields_rejected(user, bank, field, value):
    body = {"type": "expense", "amount": 100, "description": "x", "account_id": bank["id"],
            "occurred_on": "2026-10-01", field: value}
    assert user.post("/api/transactions", body).status_code == 422


def test_edit_updates_balance_without_double_counting(user, bank):
    tx = user.tx("expense", 1_000_00, bank["id"])
    for amount in (2_000_00, 3_000_00, 3_000_00):
        r = user.patch(f"/api/transactions/{tx['id']}", {"amount": amount})
        assert r.status_code == 200
    assert user.balance(bank["id"]) == 97_000_00
    # Change type expense -> income: the effect flips, applied once.
    user.patch(f"/api/transactions/{tx['id']}", {"type": "income"})
    assert user.balance(bank["id"]) == 103_000_00


def test_edit_moving_to_another_account(user, bank):
    wallet = user.account("Wallet", "cash", 10_000)
    tx = user.tx("expense", 5_000, bank["id"])
    user.patch(f"/api/transactions/{tx['id']}", {"account_id": wallet["id"]})
    assert user.balance(bank["id"]) == 100_000_00
    assert user.balance(wallet["id"]) == 5_000


def test_edit_transfer_to_expense_drops_destination(user, bank):
    wallet = user.account("Wallet", "cash")
    tx = user.tx("transfer", 500, bank["id"], to_account_id=wallet["id"])
    r = user.patch(f"/api/transactions/{tx['id']}", {"type": "expense"})
    assert r.status_code == 200 and r.json()["to_account_id"] is None
    assert user.balance(wallet["id"]) == 0


def test_invalid_edit_is_rejected_and_leaves_data_unchanged(user, bank):
    tx = user.tx("expense", 500, bank["id"])
    r = user.patch(f"/api/transactions/{tx['id']}", {"type": "transfer"})  # no destination
    assert r.status_code == 400
    assert user.get(f"/api/transactions/{tx['id']}").json()["type"] == "expense"
    assert user.patch(f"/api/transactions/{tx['id']}", {"amount": None}).status_code == 400


def test_delete_restores_balance(user, bank):
    tx = user.tx("expense", 5_000, bank["id"])
    assert user.delete(f"/api/transactions/{tx['id']}").status_code == 204
    assert user.balance(bank["id"]) == 100_000_00
    assert user.get(f"/api/transactions/{tx['id']}").status_code == 404
    assert user.delete(f"/api/transactions/{tx['id']}").status_code == 404


def test_idempotency_key_prevents_duplicates(user, bank):
    key = str(uuid.uuid4())
    body = {"type": "expense", "amount": 999, "description": "Coffee", "account_id": bank["id"],
            "occurred_on": "2026-10-01", "client_request_id": key}
    first = user.post("/api/transactions", body)
    second = user.post("/api/transactions", body)
    assert first.status_code == 201 and second.status_code == 200
    assert first.json()["id"] == second.json()["id"]
    assert user.get("/api/transactions").json()["total"] == 1
    assert user.balance(bank["id"]) == 100_000_00 - 999


def test_archived_account_rejects_new_transactions(user, bank):
    user.patch(f"/api/accounts/{bank['id']}", {"is_archived": True})
    r = user.post("/api/transactions", {"type": "expense", "amount": 1, "description": "x",
                                        "account_id": bank["id"], "occurred_on": "2026-10-01"})
    assert r.status_code == 400 and r.json()["error"]["code"] == "account_archived"


def test_account_with_transactions_cannot_be_deleted(user, bank):
    user.tx("expense", 1, bank["id"])
    r = user.delete(f"/api/accounts/{bank['id']}")
    assert r.status_code == 409 and r.json()["error"]["code"] == "account_in_use"
    empty = user.account("Empty")
    assert user.delete(f"/api/accounts/{empty['id']}").status_code == 204


@pytest.fixture
def ledger(user, bank):
    food, shop = user.category("Food & Dining"), user.category("Shopping")
    salary = user.category("Salary", "income")
    wallet = user.account("Wallet", "cash")
    user.tx("income", 80_000_00, bank["id"], "2026-09-01", category_id=salary["id"], description="Salary Sep")
    user.tx("expense", 500_00, bank["id"], "2026-09-05", category_id=food["id"], description="Pizza night",
            payment_method="upi")
    user.tx("expense", 2_000_00, bank["id"], "2026-10-02", category_id=shop["id"], description="Shoes",
            payment_method="credit_card", notes="birthday gift")
    user.tx("refund", 300_00, bank["id"], "2026-10-04", category_id=shop["id"], description="Shoes partial refund")
    user.tx("expense", 120_00, wallet["id"], "2026-10-06", category_id=food["id"], description="Tea",
            payment_method="cash")
    user.tx("transfer", 1_000_00, bank["id"], "2026-10-07", to_account_id=wallet["id"], description="ATM")
    return {"food": food, "shop": shop, "wallet": wallet, "bank": bank}


def test_filters_and_totals(user, ledger):
    r = user.get("/api/transactions", params={"start_date": "2026-10-01", "end_date": "2026-10-31"}).json()
    assert r["total"] == 4
    assert r["totals"] == {"income": 0, "expenses": 2_120_00, "refunds": 300_00, "net_spending": 1_820_00,
                           "net_cash_flow": -1_820_00, "count": 4}
    r = user.get("/api/transactions", params={"category_id": ledger["shop"]["id"]}).json()
    assert r["total"] == 2 and r["totals"]["net_spending"] == 1_700_00
    r = user.get("/api/transactions", params=[("type", "income"), ("type", "refund")]).json()
    assert {t["type"] for t in r["items"]} == {"income", "refund"}
    r = user.get("/api/transactions", params={"account_id": ledger["wallet"]["id"]}).json()
    assert r["total"] == 2  # matches source or destination
    r = user.get("/api/transactions", params={"payment_method": "cash"}).json()
    assert [t["description"] for t in r["items"]] == ["Tea"]
    r = user.get("/api/transactions", params={"search": "GIFT"}).json()  # searches notes too
    assert [t["description"] for t in r["items"]] == ["Shoes"]
    r = user.get("/api/transactions", params={"search": "100%"}).json()
    assert r["total"] == 0  # LIKE wildcards are escaped
    r = user.get("/api/transactions", params={"category_id": "uncategorized"}).json()
    assert [t["type"] for t in r["items"]] == ["transfer"]


def test_sorting_and_pagination(user, ledger):
    r = user.get("/api/transactions", params={"sort": "amount", "order": "desc", "page_size": 2}).json()
    assert [t["amount"] for t in r["items"]] == [80_000_00, 2_000_00]
    assert r["total"] == 6 and r["page_size"] == 2
    p3 = user.get("/api/transactions", params={"sort": "amount", "order": "desc", "page_size": 2, "page": 3}).json()
    assert [t["amount"] for t in p3["items"]] == [300_00, 120_00]
    assert p3["totals"]["count"] == 6  # totals cover all pages
    dates = [t["occurred_on"] for t in user.get("/api/transactions", params={"order": "asc"}).json()["items"]]
    assert dates == sorted(dates)
    assert user.get("/api/transactions", params={"page_size": 101}).status_code == 422
    assert user.get("/api/transactions", params={"page": 0}).status_code == 422
    assert user.get("/api/transactions", params={"start_date": "2026-10-10",
                                                 "end_date": "2026-10-01"}).status_code == 400


def test_csv_export_respects_filters_and_neutralises_formulas(user, ledger):
    user.tx("expense", 1_00, ledger["bank"]["id"], "2026-10-08", description="=HYPERLINK(\"x\")")
    r = user.get("/api/transactions/export", params={"start_date": "2026-10-01"})
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/csv")
    assert "attachment" in r.headers["content-disposition"]
    rows = list(csv.DictReader(io.StringIO(r.text.lstrip("﻿"))))
    assert len(rows) == 5
    by_desc = {row["description"]: row for row in rows}
    assert by_desc["Shoes"]["amount"] == "2000.00" and by_desc["Shoes"]["payment_method"] == "Credit Card"
    assert by_desc["ATM"]["to_account"] == "Wallet"
    assert "'=HYPERLINK(\"x\")" in by_desc
