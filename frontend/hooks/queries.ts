"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { AnalyticsParams, CategoryKind, Interval, TransactionFilters } from "@/types/api";

export const qk = {
  profile: ["profile"] as const,
  onboarding: ["onboarding"] as const,
  demo: ["demo"] as const,
  accounts: (archived: boolean) => ["accounts", { archived }] as const,
  categories: (kind?: CategoryKind, archived = false) => ["categories", { kind, archived }] as const,
  transactions: (f: TransactionFilters) => ["transactions", f] as const,
  transaction: (id: string) => ["transactions", "detail", id] as const,
  budgets: (month?: string) => ["budgets", { month }] as const,
  budgetHistory: (months: number) => ["budgets", "history", { months }] as const,
  savings: (archived: boolean) => ["savings", { archived }] as const,
  contributions: (id: string) => ["savings", "contributions", id] as const,
  recurring: ["recurring"] as const,
  analytics: (name: string, params: object) => ["analytics", name, params] as const,
};

const previous = { placeholderData: keepPreviousData };

export const useProfile = () => useQuery({ queryKey: qk.profile, queryFn: api.profile.get, staleTime: 60_000 });
export const useOnboarding = () => useQuery({ queryKey: qk.onboarding, queryFn: api.profile.onboarding });
export const useDemoStatus = () => useQuery({ queryKey: qk.demo, queryFn: api.demo.status });

export const useAccounts = (includeArchived = false) =>
  useQuery({ queryKey: qk.accounts(includeArchived), queryFn: () => api.accounts.list(includeArchived) });

export const useCategories = (kind?: CategoryKind, includeArchived = false) =>
  useQuery({
    queryKey: qk.categories(kind, includeArchived),
    queryFn: () => api.categories.list(kind, includeArchived),
    staleTime: 60_000,
  });

export const useTransactions = (f: TransactionFilters) =>
  useQuery({ queryKey: qk.transactions(f), queryFn: () => api.transactions.list(f), ...previous });

export const useTransaction = (id: string | null) =>
  useQuery({ queryKey: qk.transaction(id ?? ""), queryFn: () => api.transactions.get(id!), enabled: !!id });

export const useBudgets = (month?: string) =>
  useQuery({ queryKey: qk.budgets(month), queryFn: () => api.budgets.list(month), ...previous });

export const useBudgetHistory = (months = 6) =>
  useQuery({ queryKey: qk.budgetHistory(months), queryFn: () => api.budgets.history(months) });

export const useSavingsGoals = (includeArchived = false) =>
  useQuery({ queryKey: qk.savings(includeArchived), queryFn: () => api.savings.list(includeArchived) });

export const useContributions = (id: string | null) =>
  useQuery({ queryKey: qk.contributions(id ?? ""), queryFn: () => api.savings.contributions(id!), enabled: !!id });

export const useRecurring = () => useQuery({ queryKey: qk.recurring, queryFn: api.recurring.list });

// Analytics ------------------------------------------------------------------

export const useSummary = (p: AnalyticsParams, enabled = true) =>
  useQuery({ queryKey: qk.analytics("summary", p), queryFn: () => api.analytics.summary(p), enabled, ...previous });

export const useCashFlow = (p: AnalyticsParams & { interval?: Interval; months?: number }, enabled = true) =>
  useQuery({ queryKey: qk.analytics("cash-flow", p), queryFn: () => api.analytics.cashFlow(p), enabled, ...previous });

export const useExpenseBreakdown = (p: AnalyticsParams, enabled = true) =>
  useQuery({
    queryKey: qk.analytics("expense-breakdown", p),
    queryFn: () => api.analytics.expenseBreakdown(p),
    enabled,
    ...previous,
  });

export const useSpendingTrend = (p: AnalyticsParams & { interval?: Interval }, enabled = true) =>
  useQuery({
    queryKey: qk.analytics("spending-trend", p),
    queryFn: () => api.analytics.spendingTrend(p),
    enabled,
    ...previous,
  });

export const useBudgetPerformance = (month?: string) =>
  useQuery({
    queryKey: qk.analytics("budget-performance", { month }),
    queryFn: () => api.analytics.budgetPerformance(month),
    ...previous,
  });

export const usePaymentMethods = (p: AnalyticsParams, enabled = true) =>
  useQuery({
    queryKey: qk.analytics("payment-methods", p),
    queryFn: () => api.analytics.paymentMethods(p),
    enabled,
    ...previous,
  });

export const useTopCategories = (p: AnalyticsParams & { limit?: number }, enabled = true) =>
  useQuery({
    queryKey: qk.analytics("top-categories", p),
    queryFn: () => api.analytics.topCategories(p),
    enabled,
    ...previous,
  });

export const useSavingsTrend = (months = 12) =>
  useQuery({ queryKey: qk.analytics("savings-trend", { months }), queryFn: () => api.analytics.savingsTrend(months), ...previous });

export const useInsights = (p: AnalyticsParams, enabled = true) =>
  useQuery({ queryKey: qk.analytics("insights", p), queryFn: () => api.analytics.insights(p), enabled, ...previous });
