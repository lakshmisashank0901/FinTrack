"""Run FinTrack's backend locally with no Supabase project — DEVELOPMENT ONLY.

    .venv/bin/python scripts/local_api.py

- API on http://localhost:8000 (docs at /docs), against an embedded PostgreSQL
  in backend/.localdb with the real migrations and RLS.
- A minimal Supabase Auth stand-in on http://localhost:54321 (see local_auth.py),
  so the frontend can sign up / log in with
  NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 and any non-empty anon key.
- Prints a token for a built-in dev user to paste into Swagger's "Authorize".
Tokens are signed with a fixed local HS256 secret: never expose this setup.
"""
import os
import sys
import threading
import time
import uuid
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import jwt
import pgserver
import psycopg
import uvicorn

BACKEND = Path(__file__).resolve().parents[1]
ROOT = BACKEND.parent
DATA_DIR = BACKEND / ".localdb"
SECRET = "local-development-secret-not-for-production!"  # noqa: S105 - local dev only
SUPABASE_URL = "http://localhost:54321"
DEV_USER = uuid.UUID("00000000-0000-4000-8000-000000000001")


def main() -> None:
    server = pgserver.get_server(DATA_DIR, cleanup_mode=None)
    socket_dir = parse_qs(urlparse(server.get_uri()).query)["host"][0]
    admin = f"postgresql://postgres@/postgres?host={socket_dir}"
    with psycopg.connect(admin, autocommit=True) as conn:
        if not conn.execute("select to_regclass('public.transactions')").fetchone()[0]:
            conn.execute((BACKEND / "tests" / "sql" / "supabase_shim.sql").read_text())
            for migration in sorted((ROOT / "supabase" / "migrations").glob("*.sql")):
                conn.execute(migration.read_text())
            conn.execute("alter role fintrack_api with login password 'local'")
            print("Database initialised.")
        conn.execute("insert into auth.users (id, email) values (%s, 'dev@fintrack.local') on conflict do nothing",
                     (DEV_USER,))

    now = int(time.time())
    token = jwt.encode({"sub": str(DEV_USER), "email": "dev@fintrack.local", "aud": "authenticated",
                        "role": "authenticated", "iss": f"{SUPABASE_URL}/auth/v1", "iat": now,
                        "exp": now + 7 * 24 * 3600}, SECRET, algorithm="HS256")
    os.environ.update(ENVIRONMENT="development", SUPABASE_URL=SUPABASE_URL, SUPABASE_JWT_SECRET=SECRET,
                      DATABASE_URL=f"postgresql://fintrack_api:local@/postgres?host={socket_dir}",
                      CORS_ORIGINS=os.environ.get("CORS_ORIGINS", "http://localhost:3000"))
    print(f"\nDev access token (valid 7 days):\n\n{token}\n\nSwagger UI: http://localhost:8000/docs\n")
    sys.path.insert(0, str(BACKEND))
    sys.path.insert(0, str(BACKEND / "scripts"))
    from local_auth import create_auth_app

    auth_app = create_auth_app(admin, SECRET, f"{SUPABASE_URL}/auth/v1", DATA_DIR / "auth_users.json")
    auth_server = uvicorn.Server(uvicorn.Config(auth_app, host="127.0.0.1", port=54321, log_level="warning"))
    threading.Thread(target=auth_server.run, daemon=True).start()
    print("Local auth stand-in: http://localhost:54321  (dev only)\n")
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, access_log=False)  # app logs sanitized access lines


if __name__ == "__main__":
    main()
