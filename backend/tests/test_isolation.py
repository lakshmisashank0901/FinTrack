"""Cross-user access prevention, at the API layer and in the database itself."""
import json

import psycopg
import pytest

from tests.conftest import API_URI


@pytest.fixture
def victim(user):
    bank = user.account("Victim bank", opening_balance=100_000)
    food = user.category("Food & Dining")
    tx = user.tx("expense", 5_000, bank["id"], category_id=food["id"])
    budget = user.post("/api/budgets", {"name": "Food", "category_id": food["id"], "amount": 10_000}).json()
    goal = user.post("/api/savings-goals", {"name": "Goal", "target_amount": 50_000}).json()
    rec = user.post("/api/recurring-payments", {"name": "Rent", "type": "expense", "amount": 1_000,
                                                "account_id": bank["id"], "frequency": "monthly",
                                                "next_due_date": "2026-11-01"}).json()
    return {"bank": bank, "food": food, "tx": tx, "budget": budget, "goal": goal, "rec": rec}


def test_cannot_read_modify_or_delete_another_users_records(victim, other_user):
    v = victim
    for url in (f"/api/transactions/{v['tx']['id']}", f"/api/accounts/{v['bank']['id']}",
                f"/api/savings-goals/{v['goal']['id']}", f"/api/recurring-payments/{v['rec']['id']}"):
        assert other_user.get(url).status_code == 404
        assert other_user.delete(url).status_code == 404
    assert other_user.patch(f"/api/transactions/{v['tx']['id']}", {"amount": 1}).status_code == 404
    assert other_user.patch(f"/api/accounts/{v['bank']['id']}", {"name": "Mine"}).status_code == 404
    assert other_user.patch(f"/api/budgets/{v['budget']['id']}", {"amount": 1}).status_code == 404
    assert other_user.delete(f"/api/budgets/{v['budget']['id']}").status_code == 404
    assert other_user.patch(f"/api/categories/{v['food']['id']}", {"name": "x"}).status_code == 404
    assert other_user.post(f"/api/savings-goals/{v['goal']['id']}/contributions",
                           {"kind": "contribution", "amount": 1, "contributed_on": "2026-10-01"}).status_code == 404
    assert other_user.post(f"/api/recurring-payments/{v['rec']['id']}/record").status_code == 404


def test_cannot_reference_another_users_account_or_category(victim, other_user):
    mine = other_user.account("Mine")
    r = other_user.post("/api/transactions", {"type": "expense", "amount": 100, "description": "x",
                                              "account_id": victim["bank"]["id"], "occurred_on": "2026-10-01"})
    assert r.status_code == 400
    r = other_user.post("/api/transactions", {"type": "transfer", "amount": 100, "description": "steal",
                                              "account_id": mine["id"], "to_account_id": victim["bank"]["id"],
                                              "occurred_on": "2026-10-01"})
    assert r.status_code == 400
    r = other_user.post("/api/transactions", {"type": "expense", "amount": 100, "description": "x",
                                              "account_id": mine["id"], "category_id": victim["food"]["id"],
                                              "occurred_on": "2026-10-01"})
    assert r.status_code == 400
    assert other_user.post("/api/budgets", {"name": "x", "category_id": victim["food"]["id"],
                                            "amount": 1}).status_code == 400
    # The victim's balance is untouched.
    assert victim["bank"]["current_balance"] == 100_000


def test_lists_and_analytics_are_scoped(victim, other_user):
    assert other_user.get("/api/transactions").json()["total"] == 0
    assert other_user.get("/api/accounts").json()["items"] == []
    summary = other_user.get("/api/analytics/summary", params={"period": "this_year"}).json()
    assert summary["expenses"]["current"] == 0 and summary["balance"]["net_worth"] == 0
    assert other_user.get("/api/data/export").json()["transactions"] == []
    assert other_user.get("/api/transactions/export").text.strip().count("\n") == 0


def _as_user(user_id: str):
    conn = psycopg.connect(API_URI)
    conn.execute("set role authenticated")
    conn.execute("select set_config('request.jwt.claims', %s, false), set_config('request.jwt.claim.sub', %s, false)",
                 (json.dumps({"sub": user_id, "role": "authenticated"}), user_id))
    return conn


def test_row_level_security_blocks_direct_access(victim, user, other_user):
    with _as_user(other_user.id) as conn:
        for table in ("transactions", "accounts", "budgets", "savings_goals", "recurring_payments", "categories",
                      "profiles", "user_preferences", "account_balances"):
            assert conn.execute(f"select count(*) from public.{table} where "
                                f"{'id' if table == 'profiles' else 'user_id'} = %s",
                                (user.id,)).fetchone()[0] == 0
        # Even a crafted UPDATE/DELETE without user filter touches nothing of the victim's.
        assert conn.execute("update public.transactions set amount = 1 where id = %s",
                            (victim["tx"]["id"],)).rowcount == 0
        assert conn.execute("delete from public.accounts where id = %s", (victim["bank"]["id"],)).rowcount == 0
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            conn.execute("insert into public.accounts (user_id, name, type) values (%s, 'x', 'cash')", (user.id,))


def test_api_role_has_no_privileges_without_switching_role():
    with psycopg.connect(API_URI) as conn:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            conn.execute("select count(*) from public.transactions")


def test_anon_role_has_no_table_access(admin_conn):
    admin_conn.execute("begin")
    admin_conn.execute("set local role anon")
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        admin_conn.execute("select count(*) from public.transactions")
    admin_conn.execute("rollback")
