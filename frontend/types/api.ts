// Types mirroring docs/API.md. All money fields are integer paise.

export type Paise = number;
export type ISODate = string; // YYYY-MM-DD
export type Month = string; // YYYY-MM

export type AccountType = "cash" | "savings" | "current" | "credit_card" | "wallet" | "other";
export type TransactionType = "income" | "expense" | "refund" | "transfer";
export type PaymentMethod =
  | "upi"
  | "cash"
  | "debit_card"
  | "credit_card"
  | "bank_transfer"
  | "net_banking"
  | "other";
export type CategoryKind = "expense" | "income";
export type Frequency = "weekly" | "monthly" | "quarterly" | "yearly";
export type Period = "this_week" | "this_month" | "last_month" | "last_3_months" | "this_year" | "custom";
export type PresetPeriod = Exclude<Period, "custom">;
export type Interval = "day" | "week" | "month";
export type BudgetState = "on_track" | "approaching" | "exceeded";
export type Theme = "light" | "dark" | "system";
export type DateFormat = "DD MMM YYYY" | "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
export type NumberFormat = "en-IN" | "en-US";

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface Preferences {
  currency: "INR";
  default_period: PresetPeriod;
  theme: Theme;
  date_format: DateFormat;
  number_format: NumberFormat;
  timezone: string;
  onboarding_dismissed: boolean;
}

export interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
  preferences: Preferences;
}

export interface ProfileUpdate {
  display_name?: string | null;
  preferences?: Partial<Omit<Preferences, "currency">>;
}

export interface Onboarding {
  has_account: boolean;
  has_income: boolean;
  has_expense: boolean;
  has_budget: boolean;
  demo_loaded: boolean;
  dismissed: boolean;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  opening_balance: Paise;
  current_balance: Paise;
  currency: "INR";
  is_liability: boolean;
  is_archived: boolean;
  is_demo: boolean;
  transaction_count: number;
  created_at: string;
  updated_at: string;
}

export interface AccountTotals {
  assets: Paise;
  liabilities: Paise;
  net_worth: Paise;
}

export interface AccountList {
  items: Account[];
  totals: AccountTotals;
}

export interface AccountInput {
  name: string;
  type: AccountType;
  opening_balance: Paise;
  currency?: "INR";
}

export interface Category {
  id: string;
  name: string;
  kind: CategoryKind;
  color: string;
  icon: string;
  is_archived: boolean;
  is_demo: boolean;
  transaction_count?: number;
}

export interface CategoryRef {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export interface CategoryInput {
  name: string;
  kind: CategoryKind;
  color?: string;
  icon?: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: Paise;
  description: string;
  category_id: string | null;
  category: CategoryRef | null;
  account_id: string;
  account_name: string;
  to_account_id: string | null;
  to_account_name: string | null;
  occurred_on: ISODate;
  occurred_time: string | null;
  payment_method: PaymentMethod | null;
  notes: string | null;
  tags: string[];
  is_demo: boolean;
  recurring_payment_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransactionInput {
  type: TransactionType;
  amount: Paise;
  description: string;
  category_id: string | null;
  account_id: string;
  to_account_id: string | null;
  occurred_on: ISODate;
  occurred_time: string | null;
  payment_method: PaymentMethod | null;
  notes: string | null;
  tags: string[];
  client_request_id?: string;
}

export interface TransactionTotals {
  income: Paise;
  expenses: Paise;
  refunds: Paise;
  net_spending: Paise;
  net_cash_flow: Paise;
  count: number;
}

export interface TransactionList extends Paginated<Transaction> {
  totals: TransactionTotals;
}

export interface TransactionFilters {
  search?: string;
  start_date?: string;
  end_date?: string;
  category_id?: string[];
  type?: TransactionType[];
  account_id?: string;
  payment_method?: PaymentMethod[];
  sort?: "date" | "amount";
  order?: "asc" | "desc";
  page?: number;
  page_size?: number;
}

export interface BudgetStatus {
  id: string;
  name: string;
  category_id: string | null;
  category: CategoryRef | null;
  amount: Paise;
  alert_threshold: number;
  start_month: Month;
  is_demo: boolean;
  spent: Paise;
  remaining: Paise;
  percent_used: number;
  status: BudgetState;
  created_at: string;
  updated_at: string;
}

export interface BudgetList {
  month: Month;
  overall: BudgetStatus | null;
  categories: BudgetStatus[];
  summary: {
    total_spent: Paise;
    category_budgeted: Paise;
    category_spent: Paise;
    unbudgeted_spent: Paise;
  };
}

export interface BudgetHistory {
  items: { month: Month; budgeted: Paise; spent: Paise; status: BudgetState | "none" }[];
}

export interface BudgetInput {
  name: string;
  category_id: string | null;
  amount: Paise;
  alert_threshold: number;
  start_month: Month;
}

export interface Contribution {
  id: string;
  goal_id: string;
  kind: "contribution" | "withdrawal";
  amount: Paise;
  contributed_on: ISODate;
  note: string | null;
  created_at: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  target_amount: Paise;
  saved_amount: Paise;
  remaining_amount: Paise;
  progress_percent: number;
  target_date: ISODate | null;
  description: string | null;
  color: string;
  is_archived: boolean;
  is_demo: boolean;
  monthly_needed: Paise | null;
  recent_contributions: Contribution[];
  created_at: string;
  updated_at: string;
}

export interface SavingsGoalList {
  items: SavingsGoal[];
  totals: { target: Paise; saved: Paise };
}

export interface SavingsGoalInput {
  name: string;
  target_amount: Paise;
  target_date: ISODate | null;
  description: string | null;
  color?: string;
  is_archived?: boolean;
}

export interface ContributionInput {
  kind: "contribution" | "withdrawal";
  amount: Paise;
  contributed_on: ISODate;
  note: string | null;
}

export interface RecurringPayment {
  id: string;
  name: string;
  type: "income" | "expense";
  amount: Paise;
  category_id: string | null;
  category: CategoryRef | null;
  account_id: string;
  account_name: string;
  payment_method: PaymentMethod;
  frequency: Frequency;
  next_due_date: ISODate;
  is_active: boolean;
  notes: string | null;
  is_demo: boolean;
  monthly_equivalent: Paise;
  days_until_due: number;
  is_overdue: boolean;
  created_at: string;
  updated_at: string;
}

export interface UpcomingPayment {
  payment_id: string;
  name: string;
  type: "income" | "expense";
  amount: Paise;
  due_date: ISODate;
  days_until_due: number;
}

export interface RecurringList {
  items: RecurringPayment[];
  summary: {
    monthly_expense_estimate: Paise;
    monthly_income_estimate: Paise;
    active_count: number;
    upcoming: UpcomingPayment[];
  };
}

export interface RecurringInput {
  name: string;
  type: "income" | "expense";
  amount: Paise;
  category_id: string | null;
  account_id: string;
  payment_method: PaymentMethod;
  frequency: Frequency;
  next_due_date: ISODate;
  is_active: boolean;
  notes: string | null;
}

// Analytics ------------------------------------------------------------------

export interface AnalyticsRange {
  period: Period;
  start_date: ISODate;
  end_date: ISODate;
  previous_start_date: ISODate;
  previous_end_date: ISODate;
  days: number;
}

export interface AnalyticsParams {
  period?: Period;
  start_date?: string;
  end_date?: string;
  category_id?: string;
}

export interface Comparison {
  current: Paise;
  previous: Paise | null;
  change_percent: number | null;
}

export interface Summary {
  range: AnalyticsRange;
  balance: {
    net_worth: Paise;
    assets: Paise;
    liabilities: Paise;
    period_change: Paise;
    accounts: { id: string; name: string; type: AccountType; balance: Paise; is_liability: boolean }[];
  };
  income: Comparison;
  expenses: Comparison;
  refunds: { current: Paise };
  net_cash_flow: { current: Paise; previous: Paise | null };
  savings_rate: { current: number | null; previous: number | null; change_points: number | null };
  average_daily_spending: Paise;
  largest_expense: {
    id: string;
    description: string;
    amount: Paise;
    occurred_on: ISODate;
    category_name: string | null;
  } | null;
  top_category: { category_id: string | null; name: string; color: string; amount: Paise; percent: number } | null;
  transaction_count: number;
  has_previous_data: boolean;
  budget_utilization: { month: Month; budgeted: Paise; spent: Paise; percent: number } | null;
}

export interface CashFlowPoint {
  bucket_start: ISODate;
  label: string;
  income: Paise;
  expenses: Paise;
  net: Paise;
}

export interface CashFlow {
  range: AnalyticsRange;
  interval: Interval;
  points: CashFlowPoint[];
}

export interface BreakdownItem {
  category_id: string | null;
  name: string;
  color: string;
  icon: string;
  amount: Paise;
  percent: number;
  transaction_count: number;
}

export interface ExpenseBreakdown {
  range: AnalyticsRange;
  total: Paise;
  items: BreakdownItem[];
}

export interface SpendingTrend {
  range: AnalyticsRange;
  interval: Interval;
  total: Paise;
  average_daily: Paise;
  points: { bucket_start: ISODate; label: string; amount: Paise }[];
}

export interface BudgetPerformance {
  month: Month;
  overall: BudgetStatus | null;
  items: {
    budget_id: string;
    category_id: string | null;
    name: string;
    color: string;
    budgeted: Paise;
    spent: Paise;
    remaining: Paise;
    percent_used: number;
    status: BudgetState;
  }[];
}

export interface PaymentMethodBreakdown {
  range: AnalyticsRange;
  total: Paise;
  items: { method: PaymentMethod; label: string; amount: Paise; percent: number; transaction_count: number }[];
}

export interface TopCategories {
  range: AnalyticsRange;
  items: BreakdownItem[];
}

export interface SavingsTrend {
  items: {
    month: Month;
    label: string;
    income: Paise;
    expenses: Paise;
    net_cash_flow: Paise;
    savings_rate: number | null;
  }[];
}

export interface Insight {
  id: string;
  tone: "positive" | "negative" | "neutral" | "warning";
  title: string;
  message: string;
}

export interface Insights {
  range: AnalyticsRange;
  items: Insight[];
}

export interface RestoreResult {
  restored: Record<string, number>;
}

export interface ApiErrorDetail {
  loc?: (string | number)[];
  msg?: string;
  [key: string]: unknown;
}
