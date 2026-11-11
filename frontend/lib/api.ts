import { env } from "@/lib/env";
import { getSupabase } from "@/lib/supabase/client";
import type {
  Account,
  AccountInput,
  AccountList,
  AnalyticsParams,
  ApiErrorDetail,
  BudgetHistory,
  BudgetInput,
  BudgetList,
  BudgetPerformance,
  BudgetStatus,
  CashFlow,
  Category,
  CategoryInput,
  CategoryKind,
  Contribution,
  ContributionInput,
  ExpenseBreakdown,
  Insights,
  Interval,
  Onboarding,
  PaymentMethodBreakdown,
  Profile,
  ProfileUpdate,
  RecurringInput,
  RecurringList,
  RecurringPayment,
  RestoreResult,
  SavingsGoal,
  SavingsGoalInput,
  SavingsGoalList,
  SavingsTrend,
  SpendingTrend,
  Summary,
  TopCategories,
  Transaction,
  TransactionFilters,
  TransactionInput,
  TransactionList,
} from "@/types/api";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: ApiErrorDetail[],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type QueryValue = string | number | boolean | null | undefined | (string | number)[];
export type Query = Record<string, QueryValue>;

export function buildQuery(query?: Query): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) value.forEach((v) => params.append(key, String(v)));
    else params.append(key, String(value));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

async function accessToken(): Promise<string | null> {
  const { data } = await getSupabase().auth.getSession();
  return data.session?.access_token ?? null;
}

async function refreshedToken(): Promise<string | null> {
  const { data, error } = await getSupabase().auth.refreshSession();
  if (error) return null;
  return data.session?.access_token ?? null;
}

async function handleUnauthorized() {
  try {
    await getSupabase().auth.signOut();
  } finally {
    if (typeof window !== "undefined") {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      // A full navigation (not router.push) drops every cached query from the expired session.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`/login?next=${next}&expired=1`);
    }
  }
}

async function toApiError(res: Response): Promise<ApiError> {
  let code = `http_${res.status}`;
  let message = res.statusText || "Request failed";
  let details: ApiErrorDetail[] | undefined;
  try {
    const body = await res.json();
    if (body?.error) {
      code = body.error.code ?? code;
      message = body.error.message ?? message;
      details = body.error.details;
    } else if (body?.detail) {
      message = typeof body.detail === "string" ? body.detail : message;
      if (Array.isArray(body.detail)) details = body.detail;
    }
  } catch {
    // Non-JSON error body; keep defaults.
  }
  return new ApiError(res.status, code, message, details);
}

interface RequestOptions {
  query?: Query;
  body?: unknown;
  raw?: boolean;
}

export async function apiRequest<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
  const url = `${env.apiUrl}${path}${buildQuery(opts.query)}`;

  const send = async (token: string | null) => {
    const headers: Record<string, string> = { Accept: opts.raw ? "*/*" : "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";
    try {
      return await fetch(url, {
        method,
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      });
    } catch {
      throw new ApiError(
        0,
        "network_error",
        "Couldn't reach the FinTrack API. Check your connection or that the backend is running.",
      );
    }
  };

  let res = await send(await accessToken());
  if (res.status === 401) {
    // The access token may have just expired: refresh once and retry.
    const token = await refreshedToken();
    if (token) res = await send(token);
    if (res.status === 401) {
      await handleUnauthorized();
      throw new ApiError(401, "unauthorized", "Your session has expired. Please sign in again.");
    }
  }
  if (!res.ok) throw await toApiError(res);
  if (opts.raw) return res as unknown as T;
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

const get = <T>(path: string, query?: Query) => apiRequest<T>("GET", path, { query });
const post = <T>(path: string, body?: unknown) => apiRequest<T>("POST", path, { body: body ?? {} });
const patch = <T>(path: string, body: unknown) => apiRequest<T>("PATCH", path, { body });
const del = <T = void>(path: string) => apiRequest<T>("DELETE", path);

async function download(path: string, query: Query | undefined, fallbackName: string): Promise<{ blob: Blob; filename: string }> {
  const res = await apiRequest<Response>("GET", path, { query, raw: true });
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  return { blob: await res.blob(), filename: match ? decodeURIComponent(match[1]) : fallbackName };
}

export function transactionQuery(f: TransactionFilters): Query {
  return {
    search: f.search,
    start_date: f.start_date,
    end_date: f.end_date,
    category_id: f.category_id,
    type: f.type,
    account_id: f.account_id,
    payment_method: f.payment_method,
    sort: f.sort,
    order: f.order,
    page: f.page,
    page_size: f.page_size,
  };
}

const analytics = (p: AnalyticsParams): Query => ({
  period: p.period,
  start_date: p.period === "custom" ? p.start_date : undefined,
  end_date: p.period === "custom" ? p.end_date : undefined,
  category_id: p.category_id,
});

export const api = {
  profile: {
    get: () => get<Profile>("/api/profile"),
    update: (body: ProfileUpdate) => patch<Profile>("/api/profile", body),
    onboarding: () => get<Onboarding>("/api/onboarding"),
  },
  accounts: {
    list: (includeArchived = false) => get<AccountList>("/api/accounts", { include_archived: includeArchived }),
    create: (body: AccountInput) => post<Account>("/api/accounts", body),
    update: (id: string, body: Partial<AccountInput> & { is_archived?: boolean }) =>
      patch<Account>(`/api/accounts/${id}`, body),
    remove: (id: string) => del(`/api/accounts/${id}`),
  },
  categories: {
    list: (kind?: CategoryKind, includeArchived = false) =>
      get<Category[]>("/api/categories", { kind, include_archived: includeArchived }),
    create: (body: CategoryInput) => post<Category>("/api/categories", body),
    update: (id: string, body: Partial<CategoryInput> & { is_archived?: boolean }) =>
      patch<Category>(`/api/categories/${id}`, body),
    remove: (id: string) => del(`/api/categories/${id}`),
  },
  transactions: {
    list: (f: TransactionFilters) => get<TransactionList>("/api/transactions", transactionQuery(f)),
    get: (id: string) => get<Transaction>(`/api/transactions/${id}`),
    create: (body: TransactionInput) => post<Transaction>("/api/transactions", body),
    update: (id: string, body: Partial<TransactionInput>) => patch<Transaction>(`/api/transactions/${id}`, body),
    remove: (id: string) => del(`/api/transactions/${id}`),
    exportCsv: (f: TransactionFilters) => {
      const q = transactionQuery({ ...f, page: undefined, page_size: undefined });
      return download("/api/transactions/export", q, "fintrack-transactions.csv");
    },
  },
  budgets: {
    list: (month?: string) => get<BudgetList>("/api/budgets", { month }),
    history: (months = 6) => get<BudgetHistory>("/api/budgets/history", { months }),
    create: (body: BudgetInput) => post<BudgetStatus>("/api/budgets", body),
    update: (id: string, body: Partial<BudgetInput>) => patch<BudgetStatus>(`/api/budgets/${id}`, body),
    remove: (id: string) => del(`/api/budgets/${id}`),
  },
  savings: {
    list: (includeArchived = false) =>
      get<SavingsGoalList>("/api/savings-goals", { include_archived: includeArchived }),
    create: (body: SavingsGoalInput) => post<SavingsGoal>("/api/savings-goals", body),
    update: (id: string, body: Partial<SavingsGoalInput>) => patch<SavingsGoal>(`/api/savings-goals/${id}`, body),
    remove: (id: string) => del(`/api/savings-goals/${id}`),
    contributions: (id: string) => get<Contribution[]>(`/api/savings-goals/${id}/contributions`),
    contribute: (id: string, body: ContributionInput) =>
      post<SavingsGoal>(`/api/savings-goals/${id}/contributions`, body),
    removeContribution: (id: string, contributionId: string) =>
      del<SavingsGoal>(`/api/savings-goals/${id}/contributions/${contributionId}`),
  },
  recurring: {
    list: () => get<RecurringList>("/api/recurring-payments"),
    create: (body: RecurringInput) => post<RecurringPayment>("/api/recurring-payments", body),
    update: (id: string, body: Partial<RecurringInput>) =>
      patch<RecurringPayment>(`/api/recurring-payments/${id}`, body),
    remove: (id: string) => del(`/api/recurring-payments/${id}`),
    record: (id: string, body: { occurred_on?: string; amount?: number }) =>
      post<{ transaction: Transaction; payment: RecurringPayment }>(`/api/recurring-payments/${id}/record`, body),
    skip: (id: string) => post<RecurringPayment>(`/api/recurring-payments/${id}/skip`),
  },
  analytics: {
    summary: (p: AnalyticsParams) => get<Summary>("/api/analytics/summary", analytics(p)),
    cashFlow: (p: AnalyticsParams & { interval?: Interval; months?: number }) =>
      get<CashFlow>("/api/analytics/cash-flow", {
        ...(p.months ? { category_id: p.category_id } : analytics(p)),
        interval: p.interval,
        months: p.months,
      }),
    expenseBreakdown: (p: AnalyticsParams) => get<ExpenseBreakdown>("/api/analytics/expense-breakdown", analytics(p)),
    spendingTrend: (p: AnalyticsParams & { interval?: Interval }) =>
      get<SpendingTrend>("/api/analytics/spending-trend", { ...analytics(p), interval: p.interval }),
    budgetPerformance: (month?: string) => get<BudgetPerformance>("/api/analytics/budget-performance", { month }),
    paymentMethods: (p: AnalyticsParams) => get<PaymentMethodBreakdown>("/api/analytics/payment-methods", analytics(p)),
    topCategories: (p: AnalyticsParams & { limit?: number }) =>
      get<TopCategories>("/api/analytics/top-categories", { ...analytics(p), limit: p.limit }),
    savingsTrend: (months = 12) => get<SavingsTrend>("/api/analytics/savings-trend", { months }),
    insights: (p: AnalyticsParams) => get<Insights>("/api/analytics/insights", analytics(p)),
  },
  data: {
    exportJson: () => download("/api/data/export", undefined, "fintrack-backup.json"),
    restore: (backup: unknown) => post<RestoreResult>("/api/data/restore", backup),
    reset: () => post<{ status: string }>("/api/data/reset", { confirm: "RESET" }),
  },
  demo: {
    status: () => get<{ loaded: boolean }>("/api/demo"),
    load: () => post<{ loaded: boolean }>("/api/demo"),
    remove: () => del<{ loaded: boolean }>("/api/demo"),
  },
};

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}
