"""A tiny stand-in for Supabase Auth (GoTrue) — LOCAL DEVELOPMENT ONLY.

Implements just the endpoints the FinTrack frontend uses (sign up, password
sign-in, refresh, get/update user, logout, recover) so the full stack can run
without a Supabase project. Users live in auth.users of the local database;
passwords are kept as salted PBKDF2 hashes in backend/.localdb/auth_users.json.
Never deploy this. Started automatically by scripts/local_api.py.
"""
import hashlib
import json
import secrets
import time
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import jwt
import psycopg
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

ACCESS_TTL = 3600


def create_auth_app(admin_dsn: str, secret: str, issuer: str, store: Path) -> FastAPI:
    app = FastAPI(title="Local auth (dev only)", docs_url=None, redoc_url=None, openapi_url=None)
    app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
    refresh_tokens: dict[str, str] = {}

    def load() -> dict[str, Any]:
        return json.loads(store.read_text()) if store.exists() else {}

    def save(users: dict[str, Any]) -> None:
        store.write_text(json.dumps(users))

    def hash_pw(password: str, salt: str) -> str:
        return hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 200_000).hex()

    def user_json(u: dict[str, Any]) -> dict[str, Any]:
        return {"id": u["id"], "aud": "authenticated", "role": "authenticated", "email": u["email"],
                "email_confirmed_at": u["created_at"], "app_metadata": {"provider": "email", "providers": ["email"]},
                "user_metadata": u.get("metadata", {}), "identities": [], "created_at": u["created_at"],
                "updated_at": u["created_at"]}

    def session(u: dict[str, Any]) -> dict[str, Any]:
        now = int(time.time())
        token = jwt.encode({"sub": u["id"], "email": u["email"], "aud": "authenticated", "role": "authenticated",
                            "iss": issuer, "iat": now, "exp": now + ACCESS_TTL, "session_id": str(uuid.uuid4()),
                            "user_metadata": u.get("metadata", {})}, secret, algorithm="HS256")
        refresh = secrets.token_urlsafe(24)
        refresh_tokens[refresh] = u["email"]
        return {"access_token": token, "token_type": "bearer", "expires_in": ACCESS_TTL,
                "expires_at": now + ACCESS_TTL, "refresh_token": refresh, "user": user_json(u)}

    def error(status: int, code: str, msg: str) -> JSONResponse:
        return JSONResponse({"code": status, "error_code": code, "msg": msg}, status_code=status)

    def current(request: Request) -> dict[str, Any] | None:
        auth = request.headers.get("authorization", "")
        try:
            claims = jwt.decode(auth.removeprefix("Bearer "), secret, algorithms=["HS256"], audience="authenticated")
        except jwt.PyJWTError:
            return None
        return load().get(claims.get("email", ""))

    @app.post("/auth/v1/signup")
    async def signup(request: Request) -> Response:
        body = await request.json()
        email, password = str(body.get("email", "")).lower().strip(), str(body.get("password", ""))
        if "@" not in email or len(password) < 6:
            return error(422, "validation_failed", "Invalid email or password (min 6 characters).")
        users = load()
        if email in users:
            return error(422, "user_already_exists", "User already registered")
        salt = secrets.token_hex(8)
        u = {"id": str(uuid.uuid4()), "email": email, "salt": salt, "hash": hash_pw(password, salt),
             "metadata": body.get("data") or {}, "created_at": datetime.now(UTC).isoformat()}
        with psycopg.connect(admin_dsn, autocommit=True) as conn:
            conn.execute("insert into auth.users (id, email, raw_user_meta_data) values (%s, %s, %s)",
                         (u["id"], email, json.dumps(u["metadata"])))
        users[email] = u
        save(users)
        return JSONResponse(session(u))

    @app.post("/auth/v1/token")
    async def token(request: Request) -> Response:
        body = await request.json()
        grant = request.query_params.get("grant_type")
        users = load()
        if grant == "password":
            u = users.get(str(body.get("email", "")).lower().strip())
            if not u or hash_pw(str(body.get("password", "")), u["salt"]) != u["hash"]:
                return error(400, "invalid_credentials", "Invalid login credentials")
            return JSONResponse(session(u))
        if grant == "refresh_token":
            email = refresh_tokens.pop(str(body.get("refresh_token", "")), None)
            if not email or email not in users:
                return error(400, "refresh_token_not_found", "Invalid Refresh Token")
            return JSONResponse(session(users[email]))
        return error(400, "unsupported_grant_type", "Unsupported grant type")

    @app.get("/auth/v1/user")
    async def get_user(request: Request) -> Response:
        u = current(request)
        return JSONResponse(user_json(u)) if u else error(401, "bad_jwt", "invalid JWT")

    @app.put("/auth/v1/user")
    async def update_user(request: Request) -> Response:
        u = current(request)
        if not u:
            return error(401, "bad_jwt", "invalid JWT")
        body = await request.json()
        users = load()
        if body.get("password"):
            u["salt"] = secrets.token_hex(8)
            u["hash"] = hash_pw(str(body["password"]), u["salt"])
        users[u["email"]] = u
        save(users)
        return JSONResponse(user_json(u))

    @app.post("/auth/v1/logout")
    async def logout() -> Response:
        return Response(status_code=204)

    @app.post("/auth/v1/recover")
    async def recover() -> Response:
        print("[local auth] Password recovery requested — no email is sent in local mode.")
        return JSONResponse({})

    return app
