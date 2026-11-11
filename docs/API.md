# FinTrack REST API contract

Base URL: `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`). Interactive docs: `/docs` (Swagger) and `/redoc`; schema at `/openapi.json`.

## Conventions

- **Auth**: every `/api/*` route requires `Authorization: Bearer <supabase access token>`. Missing/invalid/expired → `401`. The user id always comes from the verified token, never from a request body.
- **Money**: every amount is an **integer in minor units (paise)**. `₹1,250.50` ⇒ `125050`. Balances are signed (negative = owed, e.g. credit-card dues). Transaction amounts are always `> 0`; direction comes from `type`.
- **Dates**: `YYYY-MM-DD` (user-local calendar date). Times: `HH:MM`. Timestamps: ISO-8601 UTC. Months: `YYYY-MM`.
- **IDs**: UUID strings.
- **Errors**: `{"error": {"code": "<snake_case>", "message": "<human readable>", "details": [...]?}}` with status `400` (bad request), `401`, `403`, `404`, `409` (conflict), `422` (validation; `details` lists `{loc, msg}`), `500`.
- **Pagination**: `?page=1&page_size=25` (max 100) → `{"items": [...], "total": n, "page": 1, "page_size": 25}`.
- **Enums**
  - `account_type`: `cash | savings | current | credit_card | wallet | other` (`credit_card` is a liability)
  - `transaction_type`: `income | expense | refund | transfer`
  - `payment_method`: `upi | cash | debit_card | credit_card | bank_transfer | net_banking | other`
  - `category_kind`: `expense | income`
  - `frequency`: `weekly | monthly | quarterly | yearly`
  - `period`: `this_week | this_month | last_month | last_3_months | this_year | custom`
  - `interval`: `day | week | month`

## Accounting rules (authoritative, implemented in the backend)

| type | balance effect | counted as |
|---|---|---|
| income | `+amount` on `account_id` | income |
| expense | `−amount` on `account_id` | spending |
| refund | `+amount` on `account_id` | **reduces** spending (in its category / payment method) |
| transfer | `−amount` on `account_id`, `+amount` on `to_account_id` | neither income nor spending |

- `net_spending = expenses − refunds` (this is what "Expenses" means in every summary, chart and budget).
- `net_cash_flow = income − net_spending`.
- `savings_rate = net_cash_flow / income × 100` (null when income is 0).
- `current_balance = opening_balance + Σ effects` (derived on read; editing/deleting a transaction can never double-apply).
- **Net worth** = Σ balances of non-archived accounts = `assets − liabilities`, where assets = Σ positive balances of non-credit-card accounts and liabilities = Σ owed on credit cards (shown as a positive number).
- Savings-goal contributions are earmarks only: they create no transactions and are never spending.

## Health

- `GET /health` → `{"status": "ok"}` (no auth)
- `GET /health/ready` → `{"status": "ok", "database": "ok"}` or `503`

## Profile & preferences

`GET /api/profile` →
```json
{"id": "uuid", "email": "a@b.com", "display_name": "Asha", "created_at": "...",
 "preferences": {"currency": "INR", "default_period": "this_month", "theme": "system",
   "date_format": "DD MMM YYYY", "number_format": "en-IN", "timezone": "Asia/Kolkata",
   "onboarding_dismissed": false}}
```
`PATCH /api/profile` body (all optional): `{"display_name": "Asha", "preferences": {"default_period": "last_month", "theme": "dark", "date_format": "DD/MM/YYYY", "number_format": "en-IN", "timezone": "Asia/Kolkata", "onboarding_dismissed": true}}` → same shape as GET. `currency` only accepts `INR`.

`date_format` ∈ `DD MMM YYYY | DD/MM/YYYY | MM/DD/YYYY | YYYY-MM-DD`; `number_format` ∈ `en-IN | en-US`.

`GET /api/onboarding` → `{"has_account": true, "has_income": false, "has_expense": false, "has_budget": false, "demo_loaded": false, "dismissed": false}`

## Accounts

Account:
```json
{"id": "uuid", "name": "HDFC Savings", "type": "savings", "opening_balance": 5000000,
 "current_balance": 6250000, "currency": "INR", "is_liability": false, "is_archived": false,
 "is_demo": false, "transaction_count": 12, "created_at": "...", "updated_at": "..."}
```
- `GET /api/accounts?include_archived=false` → `{"items": [Account], "totals": {"assets": 0, "liabilities": 0, "net_worth": 0}}` (totals exclude archived)
- `POST /api/accounts` `{"name", "type", "opening_balance": 0, "currency": "INR"}` → `201 Account`. For credit cards send the outstanding dues as a **negative** opening balance.
- `PATCH /api/accounts/{id}` `{"name"?, "type"?, "opening_balance"?, "is_archived"?}` → `Account`
- `DELETE /api/accounts/{id}` → `204`; `409 account_in_use` if it has transactions (archive instead).

## Categories

Category: `{"id", "name", "kind": "expense", "color": "#f97316", "icon": "utensils", "is_archived": false, "is_demo": false, "transaction_count": 3}`
- `GET /api/categories?kind=expense&include_archived=false` → `[Category]`
- `POST /api/categories` `{"name", "kind", "color"?, "icon"?}` → `201`; `409 duplicate_category`
- `PATCH /api/categories/{id}` `{"name"?, "color"?, "icon"?, "is_archived"?}` → `Category`
- `DELETE /api/categories/{id}` → `204` (transactions keep existing, become uncategorised; category budgets are removed)

Icons are lucide icon names in kebab-case (e.g. `utensils`, `shopping-basket`, `car`, `shopping-bag`, `home`, `zap`, `clapperboard`, `heart-pulse`, `graduation-cap`, `plane`, `repeat`, `sparkles`, `trending-up`, `circle`, `briefcase`, `laptop`, `landmark`, `gift`).

## Transactions

Transaction:
```json
{"id": "uuid", "type": "expense", "amount": 45000, "description": "Lunch",
 "category_id": "uuid|null", "category": {"id", "name", "color", "icon"} | null,
 "account_id": "uuid", "account_name": "HDFC Savings",
 "to_account_id": "uuid|null", "to_account_name": "string|null",
 "occurred_on": "2026-10-24", "occurred_time": "13:30|null",
 "payment_method": "upi|null", "notes": "string|null", "tags": ["work"],
 "is_demo": false, "recurring_payment_id": "uuid|null",
 "created_at": "...", "updated_at": "..."}
```

`GET /api/transactions` query (all optional): `search` (description/notes, case-insensitive), `start_date`, `end_date`, `category_id` (repeatable, or `uncategorized` for none), `type` (repeatable), `account_id` (matches source **or** destination), `payment_method` (repeatable), `sort=date|amount` (default `date`), `order=desc|asc`, `page`, `page_size`.
→
```json
{"items": [Transaction], "total": 132, "page": 1, "page_size": 25,
 "totals": {"income": 0, "expenses": 0, "refunds": 0, "net_spending": 0, "net_cash_flow": 0, "count": 132}}
```
Totals cover **all rows matching the filters**, not just the page.

- `GET /api/transactions/export` same filters (no paging) → `text/csv` download (`fintrack-transactions-YYYY-MM-DD.csv`). Columns: `date,time,type,description,category,account,to_account,payment_method,amount,notes,tags` with `amount` in rupees (`1250.50`).
- `GET /api/transactions/{id}` → Transaction
- `POST /api/transactions` →  `201 Transaction`
  ```json
  {"type": "expense", "amount": 45000, "description": "Lunch", "category_id": "uuid|null",
   "account_id": "uuid", "to_account_id": null, "occurred_on": "2026-10-24", "occurred_time": "13:30",
   "payment_method": "upi", "notes": null, "tags": [], "client_request_id": "uuid"}
  ```
  Rules: transfers require `to_account_id ≠ account_id` and no category; non-transfers must not have `to_account_id`. income needs an income category (or none), expense/refund an expense category (or none). Archived accounts are rejected. `client_request_id` is an idempotency key: re-sending the same key returns the originally created transaction (`200`) instead of a duplicate.
- `PATCH /api/transactions/{id}` any subset of the POST fields (except `client_request_id`) → Transaction. Shape rules are re-validated against the merged result.
- `DELETE /api/transactions/{id}` → `204`

## Budgets

BudgetStatus:
```json
{"id": "uuid", "name": "Food", "category_id": "uuid|null", "category": {...}|null,
 "amount": 1500000, "alert_threshold": 80, "start_month": "2026-10", "is_demo": false,
 "spent": 1250000, "remaining": 250000, "percent_used": 83.3,
 "status": "on_track|approaching|exceeded", "created_at": "...", "updated_at": "..."}
```
`category_id: null` = the overall (all spending) budget. Status: `exceeded` if spent > amount, `approaching` if percent_used ≥ alert_threshold, else `on_track`. Spent = net spending (expenses − refunds, floored at 0) in the month.

- `GET /api/budgets?month=YYYY-MM` (default current month) → budgets active in that month (`start_month ≤ month`):
  ```json
  {"month": "2026-10", "overall": BudgetStatus|null, "categories": [BudgetStatus],
   "summary": {"total_spent": 0, "category_budgeted": 0, "category_spent": 0, "unbudgeted_spent": 0}}
  ```
  To avoid double counting, the overall budget's `spent` is all net spending; category budgets are listed separately and `summary.category_budgeted` is never added to the overall limit.
- `GET /api/budgets/history?months=6` → `{"items": [{"month": "2026-05", "budgeted": 0, "spent": 0, "status": "on_track|approaching|exceeded|none"}]}` (oldest first). `budgeted` = overall budget if one is active in that month, else sum of active category budgets; `spent` matches the same scope.
- `POST /api/budgets` `{"name", "category_id": null, "amount", "alert_threshold": 80, "start_month": "2026-10"}` → `201 BudgetStatus` (current month); `409 duplicate_budget`.
- `PATCH /api/budgets/{id}` `{"name"?, "amount"?, "alert_threshold"?, "start_month"?}` → BudgetStatus
- `DELETE /api/budgets/{id}` → `204`

## Savings goals

```json
SavingsGoal {"id", "name", "target_amount": 10000000, "saved_amount": 2500000,
  "remaining_amount": 7500000, "progress_percent": 25.0, "target_date": "2027-06-30|null",
  "description": "string|null", "color": "#16a34a", "is_archived": false, "is_demo": false,
  "monthly_needed": 937500|null, "recent_contributions": [Contribution (max 5)],
  "created_at", "updated_at"}
Contribution {"id", "goal_id", "kind": "contribution|withdrawal", "amount", "contributed_on": "2026-10-24", "note": "string|null", "created_at"}
```
`monthly_needed` = remaining ÷ months left until target_date (null if no date, done, or past due).

- `GET /api/savings-goals?include_archived=false` → `{"items": [SavingsGoal], "totals": {"target": 0, "saved": 0}}`
- `POST /api/savings-goals` `{"name", "target_amount", "target_date"?, "description"?, "color"?}` → `201`
- `PATCH /api/savings-goals/{id}` same fields + `is_archived` → SavingsGoal
- `DELETE /api/savings-goals/{id}` → `204`
- `GET /api/savings-goals/{id}/contributions` → `[Contribution]` (newest first)
- `POST /api/savings-goals/{id}/contributions` `{"kind", "amount", "contributed_on", "note"?}` → `201 SavingsGoal`; withdrawal larger than saved → `400 insufficient_savings`
- `DELETE /api/savings-goals/{id}/contributions/{contribution_id}` → `SavingsGoal` (`400` if it would make saved negative)

## Recurring payments

```json
RecurringPayment {"id", "name", "type": "expense|income", "amount", "category_id", "category": {...}|null,
  "account_id", "account_name", "payment_method", "frequency", "next_due_date": "2026-11-01",
  "is_active": true, "notes", "is_demo", "monthly_equivalent": 49900,
  "days_until_due": 8, "is_overdue": false, "created_at", "updated_at"}
```
`monthly_equivalent`: weekly × 52/12, monthly × 1, quarterly ÷ 3, yearly ÷ 12 (rounded).

- `GET /api/recurring-payments` →
  ```json
  {"items": [RecurringPayment],
   "summary": {"monthly_expense_estimate": 0, "monthly_income_estimate": 0, "active_count": 0,
     "upcoming": [{"payment_id", "name", "type", "amount", "due_date", "days_until_due"}]}}
  ```
  `upcoming` = active items' occurrences due in the next 30 days (and overdue ones), soonest first.
- `POST /api/recurring-payments` `{"name", "type", "amount", "category_id"?, "account_id", "payment_method", "frequency", "next_due_date", "is_active": true, "notes"?}` → `201`
- `PATCH /api/recurring-payments/{id}` any subset → RecurringPayment
- `DELETE /api/recurring-payments/{id}` → `204` (already-recorded transactions are kept)
- `POST /api/recurring-payments/{id}/record` `{"occurred_on"?: date (default next_due_date), "amount"?: override}` → `201 {"transaction": Transaction, "payment": RecurringPayment}`. Records the **current due occurrence** as a real transaction (the user confirms it was paid — FinTrack never moves money) and advances `next_due_date`. Recording the same occurrence twice → `409 already_recorded`.
- `POST /api/recurring-payments/{id}/skip` → RecurringPayment with `next_due_date` advanced, no transaction.

## Analytics

Common query params: `period` (default user preference), `start_date` + `end_date` (required when `period=custom`), `category_id` (optional, restricts spending-based figures to one category).
All responses include
```json
"range": {"period": "this_month", "start_date": "2026-10-01", "end_date": "2026-10-24",
          "previous_start_date": "2026-09-01", "previous_end_date": "2026-09-24", "days": 24}
```
"this_*" periods run up to today (user timezone); the previous range is the same elapsed span one period earlier (Oct 1–24 vs Sep 1–24). `last_month` is the previous full calendar month (compared with the month before it). `last_3_months` is the current month to date plus the two full months before it (Aug 1 – Oct 24, compared with May 1 – Jul 24). Custom ranges compare to the equal-length window immediately before.

`category_id` filters **spending** figures only (expenses, refunds, average daily spending, largest expense, breakdowns, spending trend, payment methods). Income, net cash flow and savings rate are always computed across all categories so they stay meaningful.

- `GET /api/analytics/summary` →
  ```json
  {"range": {...},
   "balance": {"net_worth": 0, "assets": 0, "liabilities": 0, "period_change": 0,
               "accounts": [{"id", "name", "type", "balance", "is_liability"}]},
   "income": {"current": 0, "previous": 0, "change_percent": 12.5|null},
   "expenses": {"current": 0, "previous": 0, "change_percent": null},
   "refunds": {"current": 0},
   "net_cash_flow": {"current": 0, "previous": 0},
   "savings_rate": {"current": 31.2|null, "previous": 20.0|null, "change_points": 11.2|null},
   "average_daily_spending": 0,
   "largest_expense": {"id", "description", "amount", "occurred_on", "category_name"}|null,
   "top_category": {"category_id", "name", "color", "amount", "percent"}|null,
   "transaction_count": 0,
   "has_previous_data": false,
   "budget_utilization": {"month": "2026-10", "budgeted": 0, "spent": 0, "percent": 0.0}|null}
  ```
  `previous`/`change_percent` are `null` when there is no data before the range (`has_previous_data=false`) — never invented. `change_percent` is also null when previous is 0. `period_change` = net change of net worth from transactions dated inside the range.
- `GET /api/analytics/cash-flow?interval=day|week|month&months=6|12` → `{"range", "interval", "points": [{"bucket_start": "2026-10-01", "label": "1 Oct", "income": 0, "expenses": 0, "net": 0}]}`. `months=N` overrides the period with the last N calendar months (monthly buckets). Default interval: ≤31 days → day, ≤92 days → week, otherwise month. Every bucket in the range is present (zeros filled). Weeks start Monday.
- `GET /api/analytics/expense-breakdown` → `{"range", "total": 0, "items": [{"category_id": "uuid|null", "name", "color", "icon", "amount", "percent", "transaction_count"}]}` (net of refunds; categories with net ≤ 0 omitted; sorted desc; uncategorised = `category_id: null`, name `Uncategorised`)
- `GET /api/analytics/spending-trend?interval=day|week|month` → `{"range", "interval", "total": 0, "average_daily": 0, "points": [{"bucket_start", "label", "amount"}]}`
- `GET /api/analytics/budget-performance?month=YYYY-MM` → `{"month", "overall": BudgetStatus|null, "items": [{"budget_id", "category_id", "name", "color", "budgeted", "spent", "remaining", "percent_used", "status"}]}`
- `GET /api/analytics/payment-methods` → `{"range", "total", "items": [{"method": "upi", "label": "UPI", "amount", "percent", "transaction_count"}]}` (method `null` → `other`)
- `GET /api/analytics/top-categories?limit=7` → `{"range", "items": [same as expense-breakdown items]}`
- `GET /api/analytics/savings-trend?months=12` → `{"items": [{"month": "2026-10", "label": "Oct 2026", "income", "expenses", "net_cash_flow", "savings_rate": 31.2|null}]}` — monthly net cash flow (not cumulative balances).
- `GET /api/analytics/insights` → `{"range", "items": [{"id": "top_category", "tone": "positive|negative|neutral|warning", "title", "message"}]}` — only data-backed statements.

## Data management

- `GET /api/data/export` → JSON backup download:
  `{"format": "fintrack-backup", "version": 1, "exported_at", "profile": {"display_name"}, "preferences": {...}, "accounts": [...], "categories": [...], "transactions": [...], "budgets": [...], "savings_goals": [...], "savings_contributions": [...], "recurring_payments": [...]}` (ids are kept so references resolve; amounts in paise)
- `POST /api/data/restore` body = a backup object → validated fully (schema, enums, amounts, cross-references, transfer shape) **before** anything is written; then in one DB transaction the user's data is replaced (new ids are generated). → `{"restored": {"accounts": 2, "categories": 19, "transactions": 120, "budgets": 3, "savings_goals": 2, "savings_contributions": 5, "recurring_payments": 4}}`. Invalid → `422` with details, nothing changed.
- `POST /api/data/reset` `{"confirm": "RESET"}` → `{"status": "ok"}`; deletes all financial data and restores default categories (profile & preferences kept).

## Demo mode

- `GET /api/demo` → `{"loaded": false}`
- `POST /api/demo` → `201 {"loaded": true}` — inserts a clearly flagged sample dataset (`is_demo: true` on every row: 3 accounts, ~4 months of transactions, budgets, goals, recurring items). `409` if already loaded.
- `DELETE /api/demo` → `{"loaded": false}` — removes every `is_demo` row (and only those).
