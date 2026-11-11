import time
import uuid

import pytest

from tests.conftest import make_token


@pytest.mark.parametrize("headers", [
    {},
    {"Authorization": "Bearer"},
    {"Authorization": "Bearer not-a-jwt"},
    {"Authorization": "Basic dXNlcjpwYXNz"},
])
def test_missing_or_malformed_token_is_rejected(client, headers):
    r = client.get("/api/accounts", headers=headers)
    assert r.status_code == 401
    assert r.json()["error"]["code"] in {"unauthorized", "token_expired"}


@pytest.mark.parametrize("overrides", [
    {"exp": int(time.time()) - 120},          # expired
    {"aud": "anon"},                          # wrong audience
    {"iss": "https://evil.example/auth/v1"},  # wrong issuer
    {"role": "anon"},                         # anonymous role
    {"sub": "not-a-uuid"},
    {"exp": None},                            # missing expiry
])
def test_invalid_claims_are_rejected(client, user, overrides):
    token = make_token(user.id, **overrides)
    assert client.get("/api/accounts", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_wrong_signature_is_rejected(client, user):
    token = make_token(user.id, secret="another-secret-of-sufficient-length!!")
    assert client.get("/api/accounts", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_alg_none_is_rejected(client, user):
    import jwt
    token = jwt.encode({"sub": user.id, "aud": "authenticated", "role": "authenticated"}, None, algorithm="none")
    assert client.get("/api/accounts", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_expired_token_has_specific_code(client, user):
    token = make_token(user.id, exp=int(time.time()) - 120)
    r = client.get("/api/accounts", headers={"Authorization": f"Bearer {token}"})
    assert r.json()["error"]["code"] == "token_expired"
    assert r.headers["www-authenticate"] == "Bearer"


def test_valid_token_is_accepted(user):
    assert user.get("/api/accounts").status_code == 200


def test_user_id_in_body_is_rejected(user, other_user):
    r = user.post("/api/accounts", {"name": "Sneaky", "type": "cash", "user_id": other_user.id})
    assert r.status_code == 422


def test_cors_only_allows_configured_origin(client):
    ok = client.options("/api/accounts", headers={"Origin": "http://localhost:3000",
                                                   "Access-Control-Request-Method": "GET"})
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:3000"
    bad = client.options("/api/accounts", headers={"Origin": "https://evil.example",
                                                    "Access-Control-Request-Method": "GET"})
    assert "access-control-allow-origin" not in bad.headers


def test_token_for_unknown_user_sees_nothing(client):
    token = make_token(str(uuid.uuid4()))
    r = client.get("/api/transactions", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200 and r.json()["total"] == 0


def test_asymmetric_es256_token_verified_via_jwks(client, user, monkeypatch):
    from cryptography.hazmat.primitives.asymmetric import ec

    private_key = ec.generate_private_key(ec.SECP256R1())

    class FakeJwks:
        def __init__(self, key):
            self.key = key

        def get_signing_key_from_jwt(self, token):
            return FakeJwks(self.key)

    monkeypatch.setattr("app.core.security._jwks_client", lambda url: FakeJwks(private_key.public_key()))
    good = make_token(user.id, secret=private_key, algorithm="ES256")
    assert client.get("/api/accounts", headers={"Authorization": f"Bearer {good}"}).status_code == 200
    forged = make_token(user.id, secret=ec.generate_private_key(ec.SECP256R1()), algorithm="ES256")
    assert client.get("/api/accounts", headers={"Authorization": f"Bearer {forged}"}).status_code == 401
