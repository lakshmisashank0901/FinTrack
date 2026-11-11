from app.core.config import Settings
from app.core.limits import DEFAULT_MAX_BODY


def _settings(**kw):
    return Settings(_env_file=None, database_url="postgresql://x@/x", supabase_url="https://x.supabase.co", **kw)


def test_docs_default_off_in_production():
    assert _settings(environment="production").enable_docs is False
    assert _settings(environment="development").enable_docs is True
    assert _settings(environment="production", enable_docs=True).enable_docs is True


def test_oversized_body_rejected(user):
    r = user.client.post("/api/accounts", content=b"x" * (DEFAULT_MAX_BODY + 1),
                         headers={**user.headers, "content-type": "application/json"})
    assert r.status_code == 413
    assert r.json()["error"]["code"] == "payload_too_large"


def test_unsafe_request_id_replaced(client):
    assert client.get("/health", headers={"x-request-id": "ok-123"}).headers["x-request-id"] == "ok-123"
    assert client.get("/health", headers={"x-request-id": "a" * 200}).headers["x-request-id"] != "a" * 200
