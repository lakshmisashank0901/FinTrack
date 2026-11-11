-- FinTrack initial schema
-- ---------------------------------------------------------------------------
-- Money is stored as BIGINT minor units (paise for INR). Never floats.
-- Every user-owned table carries user_id, is protected by Row Level Security,
-- and child rows reference parents through composite (id, user_id) foreign
-- keys so a row can never point at another user's account or category.
-- Account balances are DERIVED (opening_balance + ledger activity) through
-- the account_balances view, so edits and deletes can never double-apply.
-- ---------------------------------------------------------------------------


-- Enums ----------------------------------------------------------------------
create type public.account_type as enum ('cash', 'savings', 'current', 'credit_card', 'wallet', 'other');
create type public.transaction_type as enum ('income', 'expense', 'refund', 'transfer');
create type public.payment_method as enum ('upi', 'cash', 'debit_card', 'credit_card', 'bank_transfer', 'net_banking', 'other');
create type public.category_kind as enum ('expense', 'income');
create type public.recurring_frequency as enum ('weekly', 'monthly', 'quarterly', 'yearly');
create type public.contribution_kind as enum ('contribution', 'withdrawal');

-- updated_at trigger ---------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- profiles -------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text check (char_length(display_name) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- user_preferences -------------------------------------------------------------
create table public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  currency char(3) not null default 'INR' check (currency in ('INR')),
  default_period text not null default 'this_month'
    check (default_period in ('this_week', 'this_month', 'last_month', 'last_3_months', 'this_year')),
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  date_format text not null default 'DD MMM YYYY'
    check (date_format in ('DD MMM YYYY', 'DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD')),
  number_format text not null default 'en-IN' check (number_format in ('en-IN', 'en-US')),
  timezone text not null default 'Asia/Kolkata' check (char_length(timezone) between 1 and 64),
  onboarding_dismissed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- accounts -------------------------------------------------------------------
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  type public.account_type not null,
  -- Signed: positive = money held; negative = money owed (e.g. credit card dues).
  opening_balance bigint not null default 0
    check (opening_balance between -100000000000000 and 100000000000000),
  currency char(3) not null default 'INR' check (currency in ('INR')),
  is_archived boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create unique index accounts_user_name_key on public.accounts (user_id, lower(name));
create index accounts_user_idx on public.accounts (user_id);

-- categories -----------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  kind public.category_kind not null,
  color text not null default '#64748b' check (color ~ '^#[0-9a-fA-F]{6}$'),
  icon text not null default 'circle' check (char_length(icon) <= 40),
  is_archived boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create unique index categories_user_kind_name_key on public.categories (user_id, kind, lower(name));

-- recurring_payments ---------------------------------------------------------
create table public.recurring_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  type public.transaction_type not null check (type in ('income', 'expense')),
  amount bigint not null check (amount > 0 and amount <= 100000000000000),
  category_id uuid,
  account_id uuid not null,
  payment_method public.payment_method not null default 'other',
  frequency public.recurring_frequency not null,
  next_due_date date not null,
  is_active boolean not null default true,
  notes text check (char_length(notes) <= 500),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (account_id, user_id) references public.accounts (id, user_id) on delete cascade,
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete set null (category_id)
);
create index recurring_user_due_idx on public.recurring_payments (user_id, next_due_date);

-- transactions ---------------------------------------------------------------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type public.transaction_type not null,
  amount bigint not null check (amount > 0 and amount <= 100000000000000),
  description text not null check (char_length(btrim(description)) between 1 and 140),
  category_id uuid,
  account_id uuid not null,
  to_account_id uuid,
  occurred_on date not null,               -- the user's local calendar date
  occurred_time time,                      -- optional local time of day
  payment_method public.payment_method,
  notes text check (char_length(notes) <= 1000),
  tags text[] not null default '{}' check (cardinality(tags) <= 10),
  is_demo boolean not null default false,
  recurring_payment_id uuid,
  recurring_occurrence date,
  client_request_id uuid,                  -- idempotency key supplied by the client
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (account_id, user_id) references public.accounts (id, user_id) on delete restrict,
  foreign key (to_account_id, user_id) references public.accounts (id, user_id) on delete restrict,
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete set null (category_id),
  foreign key (recurring_payment_id, user_id) references public.recurring_payments (id, user_id)
    on delete set null (recurring_payment_id),
  -- A transfer always has exactly one source and one distinct destination, and no category.
  constraint transfer_shape check (
    (type = 'transfer' and to_account_id is not null and to_account_id <> account_id and category_id is null)
    or (type <> 'transfer' and to_account_id is null)
  )
);
create unique index transactions_idempotency_key on public.transactions (user_id, client_request_id)
  where client_request_id is not null;
create unique index transactions_recurring_occurrence_key on public.transactions (recurring_payment_id, recurring_occurrence)
  where recurring_payment_id is not null;
create index transactions_user_date_idx on public.transactions (user_id, occurred_on desc, created_at desc);
create index transactions_user_category_idx on public.transactions (user_id, category_id);
create index transactions_account_idx on public.transactions (account_id);
create index transactions_to_account_idx on public.transactions (to_account_id) where to_account_id is not null;

-- budgets --------------------------------------------------------------------
-- A budget is a monthly limit, active from start_month onwards.
-- category_id IS NULL means the overall (all-categories) budget.
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  category_id uuid,
  amount bigint not null check (amount > 0 and amount <= 100000000000000),
  alert_threshold smallint not null default 80 check (alert_threshold between 1 and 100),
  start_month date not null default date_trunc('month', now())::date
    check (start_month = date_trunc('month', start_month)::date),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete cascade
);
-- One overall budget and at most one budget per category per user.
create unique index budgets_user_category_key on public.budgets (user_id, category_id) nulls not distinct;

-- savings_goals --------------------------------------------------------------
create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  target_amount bigint not null check (target_amount > 0 and target_amount <= 100000000000000),
  target_date date,
  description text check (char_length(description) <= 500),
  color text not null default '#16a34a' check (color ~ '^#[0-9a-fA-F]{6}$'),
  is_archived boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index savings_goals_user_idx on public.savings_goals (user_id);

-- savings_contributions ------------------------------------------------------
-- Goal tracking (earmarking). Contributions do NOT create transactions and are
-- never counted as expenses; moving money between your own accounts is not spending.
create table public.savings_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_id uuid not null,
  kind public.contribution_kind not null,
  amount bigint not null check (amount > 0 and amount <= 100000000000000),
  contributed_on date not null,
  note text check (char_length(note) <= 200),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (goal_id, user_id) references public.savings_goals (id, user_id) on delete cascade
);
create index savings_contributions_goal_idx on public.savings_contributions (goal_id, contributed_on desc);

-- updated_at triggers ----------------------------------------------------------
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger user_preferences_updated_at before update on public.user_preferences for each row execute function public.set_updated_at();
create trigger accounts_updated_at before update on public.accounts for each row execute function public.set_updated_at();
create trigger categories_updated_at before update on public.categories for each row execute function public.set_updated_at();
create trigger transactions_updated_at before update on public.transactions for each row execute function public.set_updated_at();
create trigger budgets_updated_at before update on public.budgets for each row execute function public.set_updated_at();
create trigger savings_goals_updated_at before update on public.savings_goals for each row execute function public.set_updated_at();
create trigger recurring_payments_updated_at before update on public.recurring_payments for each row execute function public.set_updated_at();

-- Derived balances -----------------------------------------------------------
-- security_invoker makes the view obey the caller's RLS policies.
create view public.account_balances with (security_invoker = true) as
select
  a.id as account_id,
  a.user_id,
  a.opening_balance + coalesce(sum(l.delta), 0)::bigint as current_balance,
  count(distinct l.transaction_id)::int as transaction_count
from public.accounts a
left join (
  select t.account_id, t.id as transaction_id,
         case when t.type in ('income', 'refund') then t.amount else -t.amount end as delta
    from public.transactions t
  union all
  select t.to_account_id, t.id, t.amount
    from public.transactions t
   where t.type = 'transfer'
) l on l.account_id = a.id
group by a.id;

-- Default categories ---------------------------------------------------------
create or replace function public.seed_default_categories(p_user_id uuid)
returns void
language sql
set search_path = ''
as $$
  insert into public.categories (user_id, name, kind, color, icon)
  values
    (p_user_id, 'Food & Dining',   'expense', '#f97316', 'utensils'),
    (p_user_id, 'Groceries',       'expense', '#84cc16', 'shopping-basket'),
    (p_user_id, 'Transportation',  'expense', '#0ea5e9', 'car'),
    (p_user_id, 'Shopping',        'expense', '#ec4899', 'shopping-bag'),
    (p_user_id, 'Housing & Rent',  'expense', '#8b5cf6', 'home'),
    (p_user_id, 'Utilities',       'expense', '#eab308', 'zap'),
    (p_user_id, 'Entertainment',   'expense', '#f43f5e', 'clapperboard'),
    (p_user_id, 'Healthcare',      'expense', '#14b8a6', 'heart-pulse'),
    (p_user_id, 'Education',       'expense', '#6366f1', 'graduation-cap'),
    (p_user_id, 'Travel',          'expense', '#06b6d4', 'plane'),
    (p_user_id, 'Subscriptions',   'expense', '#a855f7', 'repeat'),
    (p_user_id, 'Personal Care',   'expense', '#d946ef', 'sparkles'),
    (p_user_id, 'Investments',     'expense', '#22c55e', 'trending-up'),
    (p_user_id, 'Other',           'expense', '#64748b', 'circle'),
    (p_user_id, 'Salary',          'income',  '#16a34a', 'briefcase'),
    (p_user_id, 'Freelance',       'income',  '#0d9488', 'laptop'),
    (p_user_id, 'Interest',        'income',  '#2563eb', 'landmark'),
    (p_user_id, 'Gifts',           'income',  '#db2777', 'gift'),
    (p_user_id, 'Other Income',    'income',  '#64748b', 'circle')
  on conflict do nothing;
$$;

-- New-user bootstrap: profile, preferences and default categories.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, nullif(left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 80), ''))
  on conflict (id) do nothing;
  insert into public.user_preferences (user_id) values (new.id) on conflict (user_id) do nothing;
  perform public.seed_default_categories(new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row Level Security ---------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.savings_goals enable row level security;
alter table public.savings_contributions enable row level security;
alter table public.recurring_payments enable row level security;

create policy "profiles: owner select" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "profiles: owner insert" on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy "profiles: owner update" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "preferences: owner select" on public.user_preferences for select to authenticated using (user_id = (select auth.uid()));
create policy "preferences: owner insert" on public.user_preferences for insert to authenticated with check (user_id = (select auth.uid()));
create policy "preferences: owner update" on public.user_preferences for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

do $$
declare
  t text;
begin
  foreach t in array array['accounts', 'categories', 'transactions', 'budgets', 'savings_goals',
                           'savings_contributions', 'recurring_payments']
  loop
    execute format('create policy "%1$s: owner all" on public.%1$I for all to authenticated
                    using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end;
$$;

-- Privileges (least privilege) -----------------------------------------------
-- anon gets nothing. authenticated gets DML only, always filtered by RLS.
revoke all on all tables in schema public from anon;
revoke all on function public.seed_default_categories(uuid) from public, anon;
revoke all on function public.handle_new_user() from public, anon, authenticated;
grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.accounts, public.categories, public.transactions, public.budgets,
  public.savings_goals, public.savings_contributions, public.recurring_payments
  to authenticated;
grant select, insert, update on public.profiles, public.user_preferences to authenticated;
grant select on public.account_balances to authenticated;
grant execute on function public.seed_default_categories(uuid) to authenticated;
