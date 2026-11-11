# FinTrack frontend

Next.js 16 (App Router, TypeScript) · Tailwind CSS 4 · Recharts 3 · TanStack Query · Supabase Auth.

## Setup

```bash
cp .env.example .env.local   # fill in Supabase URL + anon/publishable key, API URL
npm install
npm run dev                  # http://localhost:3000
```

Only `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_API_URL` are used.
Never put a service-role key here. Missing values show a configuration screen instead of crashing.

In Supabase → Authentication → URL configuration, add `http://localhost:3000/auth/callback` (and your production
equivalent) to the redirect allow-list so email confirmation and password-reset links work.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test -- --run` | Vitest (unit + component tests) |

## Structure

- `app/(auth)` – login, signup, forgot-password; `app/reset-password`; `app/auth/callback` (code exchange)
- `app/(app)` – authenticated pages sharing the sidebar shell: dashboard, transactions, accounts, budgets, analytics, savings, recurring, settings
- `proxy.ts` – refreshes the Supabase session cookie and redirects signed-out users away from app routes
- `lib/api.ts` – the single typed REST client for the FastAPI backend (adds the bearer token, retries once after refreshing an expired session, normalises errors)
- `lib/format.ts` – INR formatting (Indian grouping) and integer paise ↔ rupee conversion
- `lib/validations` – Zod schemas for every form
- `hooks/queries.ts` – React Query hooks; `hooks/use-finance-mutation.ts` invalidates all financial queries after writes
- `components/charts` – reusable Recharts wrappers with loading, error, empty and data-table states

All money is handled as integer paise. Every total, balance, budget figure and chart series comes from the backend.
