# FinTrack

**Track smarter. Spend better. Save more.**

FinTrack is a personal finance and expense tracker: accounts, income, expenses, refunds and transfers, monthly budgets, savings goals, recurring payments, and an analytics suite. Every figure comes from the backend, computed from your own records.

| | |
|---|---|
| Frontend | Next.js 16 (App Router, TypeScript), Tailwind CSS 4, Recharts 3, Lucide, Zod, TanStack Query |
| Backend | FastAPI, Pydantic 2, psycopg 3 (pooled), PyJWT |
| Data & auth | Supabase Postgres (RLS) + Supabase Auth |

```
FinTrack/
├── frontend/              Next.js app            → see frontend/.env.example
├── backend/               FastAPI app + tests    → see backend/.env.example
├── supabase/migrations/   SQL schema, RLS policies, API role
└── docs/
    ├── API.md             REST contract (request/response shapes)
    └── ARCHITECTURE.md    auth flow, security model, accounting rules
```

---

## 1. Prerequisites

- Node.js 20+ (tested with 25) and npm
- Python 3.12 (3.10–3.13 work for the API; the embedded test database needs ≤ 3.12)
- A Supabase project (free tier is fine): <https://supabase.com/dashboard>
- Optional: [`uv`](https://docs.astral.sh/uv/) for fast Python installs; the [Supabase CLI](https://supabase.com/docs/guides/cli) for pushing migrations

## 2. Supabase setup (needs your credentials)

1. **Create a project** and note, from *Project Settings → API*: the **Project URL** and the **anon / publishable key**. You will **not** need the service-role key; don't put it anywhere in this project.
2. **Run the migrations**, either:
   - CLI: `supabase link --project-ref <ref>` then `supabase db push` (from the repo root), or
   - Dashboard: paste `supabase/migrations/20261024000001_initial_schema.sql`, then `…000002_api_role.sql`, into the *SQL Editor* and run them in order.
3. **Enable the API login role.** In the SQL editor, using a strong generated password:
   ```sql
   alter role fintrack_api with login password '<strong-password>';
   ```
4. **Auth settings** (*Authentication → URL Configuration*): set *Site URL* to `http://localhost:3000` and add redirect URLs `http://localhost:3000/auth/callback` and `http://localhost:3000/reset-password`. Email + password sign-in is on by default. For local testing you may turn off *Confirm email*; keep it on in production.
5. **Database connection string** (*Connect → Connection string*): use the pooler URL and replace the user with `fintrack_api.<project-ref>`:
   ```
   postgresql://fintrack_api.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
   ```

> Projects created since 2025 sign tokens with asymmetric keys; the API verifies them via `<SUPABASE_URL>/auth/v1/.well-known/jwks.json`, so no secret is required. Only if your project still uses the legacy shared JWT secret, set `SUPABASE_JWT_SECRET`.

## 3. Backend

```bash
cd backend
python3.12 -m venv .venv && source .venv/bin/activate     # or: uv venv --python 3.12 .venv
pip install -r requirements-dev.txt                        # or: uv pip install -r requirements-dev.txt
cp .env.example .env                                       # fill in DATABASE_URL, SUPABASE_URL, CORS_ORIGINS
uvicorn app.main:app --reload --no-access-log --port 8000
```

- API docs: <http://localhost:8000/docs> (Swagger) · <http://localhost:8000/redoc> · contract in [`docs/API.md`](docs/API.md)
- Health: `GET /health` (liveness), `GET /health/ready` (checks the database)

### Try it without Supabase (local mode, dev only)

`python scripts/local_api.py` starts everything the frontend needs, on your machine:

- the API on `:8000`, against an embedded PostgreSQL (`backend/.localdb/`) with the real migrations and RLS;
- a minimal stand-in for Supabase Auth on `:54321` (sign up / log in / refresh only — no emails are sent);
- a printed dev token for Swagger's *Authorize* button.

Then point the frontend at it in `frontend/.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=local-dev-anon-key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Delete `backend/.localdb/` to start fresh. Never expose local mode: its tokens use a fixed, public secret.

### Tests

```bash
cd backend && source .venv/bin/activate
pytest            # 111 tests; starts its own embedded PostgreSQL, no Docker or Supabase needed
ruff check app tests scripts
```

The suite applies the real migrations and runs the API as the unprivileged `fintrack_api` role, so Row Level Security is exercised for real. It covers auth (expired/forged/`alg:none`/wrong audience/ES256 via JWKS), cross-user access (API and direct SQL), transaction CRUD, refunds, transfers, credit-card liabilities, balance consistency after edits/deletes, idempotency, filters/sorting/pagination/totals, CSV export (incl. formula-injection escaping), period resolution, chart buckets, analytics and insights, budgets (thresholds, refunds, history), savings goals, recurring payments (no double-recording, atomic failure), backup export/restore validation, reset and demo mode.

## 4. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local     # NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_API_URL
npm run dev                    # http://localhost:3000
```

Checks: `npm run lint` · `npm run typecheck` · `npx vitest run` (41 tests: INR formatting, form schemas, API client auth/refresh/error handling, summary cards, charts, transaction form) · `npm run build`

Only public values go in the frontend env (`NEXT_PUBLIC_*`). The anon key is safe to expose because RLS protects every table; financial data is only reachable through the API anyway.

## 5. First run

1. Sign up at <http://localhost:3000/signup> and log in.
2. The dashboard shows a getting-started checklist: add an account with its opening balance, record your first income and expense, and create a budget.
3. Or click **Explore demo data**: it adds a clearly labelled sample dataset (every row flagged `is_demo`, shown with a *Demo* badge). Remove it any time from the banner or *Settings → Data*; your real records are untouched. Demo data is never inserted unless you ask for it.

## 6. Production

**Builds**

```bash
cd frontend && npm ci && npm run build && npm start      # Node server on :3000
docker build -t fintrack-api backend                    # or: uvicorn app.main:app --workers 2 --no-access-log
```

**Configuration**

| Variable | Where | Production value |
|---|---|---|
| `ENVIRONMENT` | backend | `production` (hides tracebacks in logs) |
| `DATABASE_URL` | backend | pooler URL for `fintrack_api` (secret) |
| `SUPABASE_URL` | backend | `https://<ref>.supabase.co` |
| `CORS_ORIGINS` | backend | your exact frontend origin(s), comma-separated |
| `ENABLE_DOCS` | backend | `true` or `false` |
| `NEXT_PUBLIC_API_URL` | frontend | public URL of the API (HTTPS) |
| `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` | frontend | from Supabase |

**Recommendations**

- Frontend on Vercel (or any Node host); API as a container on Fly.io, Render, Railway or Cloud Run, in a region close to your Supabase database.
- Serve both over HTTPS; set `CORS_ORIGINS` to the production frontend only.
- Update Supabase *Site URL* and redirect URLs to the production domain; enable email confirmation and consider leaked-password protection and CAPTCHA.
- Point uptime monitoring at `/health/ready`.
- Keep the `fintrack_api` password in your host's secret store; rotate with `alter role … password`.
- Use Supabase point-in-time recovery or scheduled backups; users can also download their own JSON backup from Settings.

## 7. How the numbers are defined

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#accounting-model) for details. In short: amounts are stored as integer paise; balances are derived from opening balance + activity (never stored, so they can't drift); spending = expenses − refunds; transfers are neither income nor spending; credit cards are liabilities; **Total balance** on the dashboard is net worth (assets − liabilities); savings goals are earmarks and never count as expenses.
