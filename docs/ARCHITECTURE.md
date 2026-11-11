# FinTrack architecture

```
┌──────────────────────┐   email + password    ┌──────────────────────┐
│  Next.js (frontend)  │ ────────────────────▶ │    Supabase Auth     │
│  App Router, React   │ ◀──── access token ── │  (JWT, refresh)      │
└─────────┬────────────┘                       └──────────┬───────────┘
          │ REST + Authorization: Bearer <access token>   │ signing keys (JWKS)
          ▼                                               ▼
┌──────────────────────┐   verify signature, exp, aud, iss, role
│   FastAPI (backend)  │ ─────────────────────────────────────────────▶
│ routes → services →  │
│ repositories (SQL)   │   one DB transaction per request:
└─────────┬────────────┘     SET LOCAL ROLE authenticated
          │                  set_config('request.jwt.claims', <verified claims>)
          ▼
┌──────────────────────────────────────────────┐
│ Supabase Postgres  — RLS on every user table │
│   policy: user_id = auth.uid()               │
└──────────────────────────────────────────────┘
```

## Responsibilities

| Layer | Owns | Never does |
|---|---|---|
| Next.js | UI, forms (Zod), session handling with `@supabase/ssr`, calling the API | Financial calculations, direct table access, holding a service-role key |
| FastAPI | Token verification, validation (Pydantic), accounting rules, aggregation, DB transactions | Trusting a user id from the request body |
| Postgres | Constraints, composite ownership FKs, RLS, derived balances view | — |

The frontend talks to Supabase **only for authentication**. All financial reads and writes go through FastAPI, which is the single authority for calculations, so dashboard figures, budgets, charts and exports always agree.

## Authentication flow

1. **Sign up / log in** – the browser calls Supabase Auth (`signUp`, `signInWithPassword`) with the public anon/publishable key. Supabase sets session cookies via `@supabase/ssr`.
2. **New user bootstrap** – the `on_auth_user_created` trigger creates the `profiles` and `user_preferences` rows and seeds the default categories. The API also self-heals missing rows on `GET /api/profile`.
3. **Route protection** – `frontend/proxy.ts` (Next 16's middleware) refreshes the session on each navigation and redirects anonymous visitors to `/login`.
4. **API calls** – `lib/api.ts` reads the current access token from the Supabase session and sends `Authorization: Bearer <token>`. On `401` it refreshes once and retries; if that fails it signs out and redirects to `/login`.
5. **Verification** – `app/core/security.py` verifies the JWT:
   - asymmetric keys (`ES256`/`RS256`) through `<SUPABASE_URL>/auth/v1/.well-known/jwks.json` (cached), or the legacy `HS256` shared secret if `SUPABASE_JWT_SECRET` is set;
   - `exp`, `aud = authenticated`, `iss = <SUPABASE_URL>/auth/v1`, `role = authenticated`, `sub` is a UUID. `alg: none` and unknown algorithms are refused.
6. **Database identity** – `app/core/database.py` opens a transaction, runs `SET LOCAL ROLE authenticated` and stores the verified claims in `request.jwt.claims`, so `auth.uid()` in RLS policies is the token's subject. Repositories *also* filter by `user_id` (defence in depth).
7. **Password reset** – `resetPasswordForEmail` sends a link to `/reset-password`, where the recovery session lets the user call `updateUser({ password })`.

## Least privilege

- The API logs in as `fintrack_api` (migration `20261024000002`), a `NOINHERIT` role with **no table privileges of its own**. It can only act by switching to `authenticated`, which is bound by RLS. A query that forgets to switch role fails with *permission denied* (covered by tests).
- `anon` has no privileges on any FinTrack table.
- The service-role key is not used anywhere.
- Request bodies forbid unknown fields, so a smuggled `user_id` is a `422`.
- Child rows reference parents with composite `(id, user_id)` foreign keys: a transaction physically cannot point at another user's account or category.

## Accounting model

- **Money**: `BIGINT` paise everywhere (database, API, calculations). The UI converts to rupees only for display/input.
- **Transaction types**: `income` (+), `expense` (−), `refund` (+, reduces spending), `transfer` (− source, + destination, never income/spending). A transfer is a single row with both `account_id` and `to_account_id` and one amount, so it is balanced by construction; a check constraint enforces distinct accounts and no category.
- **Balances are derived**: `account_balances` view = `opening_balance + Σ effects`. Editing or deleting a transaction can therefore never double-apply or leave a balance stale; there is no stored balance to reconcile.
- **Net spending** = expenses − refunds. **Net cash flow** = income − net spending. **Savings rate** = net cash flow ÷ income (undefined when income is 0).
- **Net worth / Total balance** = assets − liabilities over non-archived accounts. Credit cards are liabilities: a card balance of −₹3,000 is shown as "₹3,000 owed", never as cash.
- **Budgets** are monthly limits active from `start_month`. The overall budget measures all net spending; category budgets measure their own category. They are shown side by side and never summed into each other.
- **Savings goals** are earmarks with contributions/withdrawals. They do not move money or create transactions, so they never inflate expenses.
- **Recurring payments** are schedules, not transactions. "Mark as paid" records the due occurrence as a real transaction (the user confirms it happened — FinTrack never executes payments) and advances the schedule. A unique index on `(recurring_payment_id, recurring_occurrence)` prevents recording an occurrence twice.
- **Idempotency**: the add-transaction form sends a `client_request_id`; a unique partial index makes retries and double-clicks return the original row instead of a duplicate.
- **Dates**: `occurred_on` is the user's local calendar date (plus optional local time), so reports never shift across midnight. "Today" for period presets uses the user's timezone preference (default `Asia/Kolkata`).
- **Atomicity**: every request runs inside one database transaction; multi-write operations (recording a recurring payment, restore, reset, demo load/remove) either fully apply or not at all.

## Backend layout

```
backend/app/
  main.py                 app factory, CORS, error handlers, routers
  core/                   config, security (JWT), database (pool + RLS session), errors, logging
  api/dependencies.py     get_current_user, per-request DB transaction
  api/routes/             thin HTTP handlers per resource
  schemas/                Pydantic request/response models (backup format included)
  services/               business rules: accounts, transactions, budgets, analytics, savings, recurring, data, demo
  repositories/           SQL for accounts, categories, transactions, budgets, recurring, analytics aggregates
  models/enums.py         domain enums and accounting tables
  utils/                  dates/periods/buckets, INR formatting
```

## Logging

The access log records request id, method, path, status and latency. Query strings, bodies and headers are never logged (they may contain amounts, search terms or tokens). Unhandled errors log the exception type only; full tracebacks are emitted only when `ENVIRONMENT=development`.
