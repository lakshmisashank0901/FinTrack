"""Integration-test harness.

Starts an embedded PostgreSQL 16 (pgserver), installs a minimal Supabase shim
(auth schema, auth.uid(), roles) plus the real migrations, then runs the API
as the unprivileged `fintrack_api` role, so Row Level Security is exercised
exactly as in production.
"""
import os
import tempfile
import time
import uuid
from datetime import date
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import jwt
import pgserver
import psycopg
import pytest

ROOT = Path(__file__).resolve().parents[2]
JWT_SECRET = "test-secret-with-at-least-32-characters!!"
SUPABASE_URL = "http://localhost:54321"

_server = pgserver.get_server(tempfile.mkdtemp(prefix="fintrack-pg-"), cleanup_mode="stop")
ADMIN_URI = _server.get_uri()
_socket_dir = parse_qs(urlparse(ADMIN_URI).query)["host"][0]

with psycopg.connect(ADMIN_URI, autocommit=True) as _conn:
    _conn.execute("drop database if exists fintrack_test")
    _conn.execute("create database fintrack_test")
ADMIN_URI = f"postgresql://postgres@/fintrack_test?host={_socket_dir}"
with psycopg.connect(ADMIN_URI, autocommit=True) as _conn:
    _conn.execute((Path(__file__).parent / "sql" / "supabase_shim.sql").read_text())
    for migration in sorted((ROOT / "supabase" / "migrations").glob("*.sql")):
        _conn.execute(migration.read_text())
    _conn.execute("alter role fintrack_api with login password 'test'")
    _conn.execute("grant connect on database fintrack_test to fintrack_api")

API_URI = f"postgresql://fintrack_api:test@/fintrack_test?host={_socket_dir}"
os.environ.update(
    ENVIRONMENT="test",
    DATABASE_URL=API_URI,
    SUPABASE_URL=SUPABASE_URL,
    SUPABASE_JWT_SECRET=JWT_SECRET,
    CORS_ORIGINS="http://localhost:3000",
    LOG_LEVEL="WARNING",
)

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


def make_token(user_id: str, email: str = "user@example.com", secret: object = JWT_SECRET,
               algorithm: str = "HS256", **overrides: object) -> str:
    now = int(time.time())
    claims = {"sub": user_id, "email": email, "aud": "authenticated", "role": "authenticated",
              "iss": f"{SUPABASE_URL}/auth/v1", "iat": now, "exp": now + 3600, **overrides}
    return jwt.encode({k: v for k, v in claims.items() if v is not None}, secret, algorithm=algorithm)


class User:
    def __init__(self, client: TestClient, user_id: str, email: str) -> None:
        self.id = user_id
        self.email = email
        self.client = client
        self.headers = {"Authorization": f"Bearer {make_token(user_id, email)}"}

    def get(self, url: str, **kw):
        return self.client.get(url, headers=self.headers, **kw)

    def post(self, url: str, json=None, **kw):
        return self.client.post(url, json=json, headers=self.headers, **kw)

    def patch(self, url: str, json=None, **kw):
        return self.client.patch(url, json=json, headers=self.headers, **kw)

    def delete(self, url: str, **kw):
        return self.client.delete(url, headers=self.headers, **kw)

    # Convenience builders -------------------------------------------------
    def account(self, name: str = "Bank", type: str = "savings", opening_balance: int = 0) -> dict:
        r = self.post("/api/accounts", {"name": name, "type": type, "opening_balance": opening_balance})
        assert r.status_code == 201, r.text
        return r.json()

    def category(self, name: str, kind: str = "expense") -> dict:
        cats = self.get("/api/categories", params={"kind": kind}).json()
        return next(c for c in cats if c["name"] == name)

    def tx(self, type: str, amount: int, account_id: str, on: str | date = "2026-10-10", **extra) -> dict:
        body = {"type": type, "amount": amount, "description": extra.pop("description", f"{type} {amount}"),
                "account_id": account_id, "occurred_on": str(on), **extra}
        r = self.post("/api/transactions", body)
        assert r.status_code == 201, r.text
        return r.json()

    def balance(self, account_id: str) -> int:
        return self.get(f"/api/accounts/{account_id}").json()["current_balance"]


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def admin_conn():
    with psycopg.connect(ADMIN_URI, autocommit=True) as conn:
        yield conn


def _create_user(client: TestClient) -> User:
    user_id = str(uuid.uuid4())
    email = f"{user_id[:8]}@example.com"
    with psycopg.connect(ADMIN_URI, autocommit=True) as conn:
        conn.execute("insert into auth.users (id, email) values (%s, %s)", (user_id, email))
    return User(client, user_id, email)


@pytest.fixture
def user(client) -> User:
    return _create_user(client)


@pytest.fixture
def other_user(client) -> User:
    return _create_user(client)


@pytest.fixture
def frozen_today(monkeypatch):
    """Pin the users' "today" so period presets are deterministic."""
    def _freeze(d: date) -> None:
        monkeypatch.setattr("app.services.clock.user_today", lambda db: d)
    _freeze(date(2026, 10, 24))
    return _freeze
