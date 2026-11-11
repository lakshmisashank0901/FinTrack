"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BudgetVsActualChart } from "@/components/charts/budget-vs-actual-chart";
import { ChartFrame } from "@/components/charts/chart-frame";
import { DonutChart } from "@/components/charts/donut-chart";
import { HorizontalBarChart } from "@/components/charts/horizontal-bar-chart";
import { IncomeExpenseChart } from "@/components/charts/income-expense-chart";
import { PAYMENT_METHOD_SLOT, useChartTheme } from "@/components/charts/palette";
import { TrendLineChart } from "@/components/charts/trend-line-chart";
import { ExpenseBreakdownCard } from "@/components/dashboard/expense-breakdown-card";
import { PeriodFilter, usePeriodState } from "@/components/dashboard/period-filter";
import { SpendingTrendCard } from "@/components/dashboard/spending-trend-card";
import { DeltaLabel } from "@/components/dashboard/stat-card";
import { comparedToLabel } from "@/components/dashboard/summary-cards";
import { usePreferences } from "@/components/providers/preferences-provider";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { SegmentedControl } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useBudgetPerformance,
  useCashFlow,
  useCategories,
  usePaymentMethods,
  useSavingsTrend,
  useSummary,
  useTopCategories,
} from "@/hooks/queries";
import { errorMessage } from "@/lib/api";
import { formatMonth, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

function Metric({ label, value, sub, loading }: { label: string; value: ReactNode; sub?: ReactNode; loading?: boolean }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-fg-subtle">{label}</p>
      {loading ? (
        <Skeleton className="mt-2 h-6 w-24" />
      ) : (
        <>
          <p className="mt-1 truncate text-lg font-semibold tabular-nums">{value}</p>
          {sub ? <div className="mt-0.5 truncate text-[11px] text-fg-subtle">{sub}</div> : null}
        </>
      )}
    </Card>
  );
}

export function AnalyticsView() {
  const router = useRouter();
  const t = useChartTheme();
  const { money, date, loaded } = usePreferences();
  const [period, setPeriod] = usePeriodState();
  const [categoryId, setCategoryId] = useState("");
  const [months, setMonths] = useState(6);
  const params = { ...period, category_id: categoryId || undefined };
  const categories = useCategories("expense", true);

  const summary = useSummary(params, loaded);
  const cashFlow = useCashFlow({ months, interval: "month" });
  const methods = usePaymentMethods(params, loaded);
  const top = useTopCategories({ ...params, limit: 7 }, loaded);
  const savings = useSavingsTrend(12);
  const budgetMonth = summary.data?.range.end_date.slice(0, 7);
  const perf = useBudgetPerformance(budgetMonth);

  const s = summary.data;
  const prev = s ? comparedToLabel(s, date) : "";
  const methodItems = (methods.data?.items ?? []).map((m) => ({
    key: m.method,
    name: m.label,
    amount: m.amount,
    percent: m.percent,
    color: t.series[PAYMENT_METHOD_SLOT[m.method] ?? 6],
    count: m.transaction_count,
  }));
  const topItems = (top.data?.items ?? []).map((c) => ({
    key: c.category_id ?? "uncategorized",
    name: c.name,
    amount: c.amount,
    color: c.color,
  }));
  const savingsItems = savings.data?.items ?? [];
  const perfItems = perf.data?.items ?? [];
  const cashPoints = cashFlow.data?.points ?? [];
  const loading = !loaded || summary.isLoading;

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Reports calculated by FinTrack from your recorded transactions."
        actions={
          <>
            <PeriodFilter value={period} onChange={setPeriod} range={s?.range} />
            <label htmlFor="a-category" className="sr-only">
              Category
            </label>
            <Select id="a-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="h-8 w-auto text-[13px]">
              <option value="">All categories</option>
              {(categories.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </>
        }
      />
      {categoryId ? (
        <p className="-mt-2 mb-4 text-xs text-fg-subtle">
          Spending figures are limited to the selected category. Income, net cash flow and savings rate always include everything.
        </p>
      ) : null}

      {summary.error && !s ? (
        <Card className="mb-4">
          <ErrorState message={errorMessage(summary.error)} onRetry={() => summary.refetch()} />
        </Card>
      ) : (
        <div className={cn("mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5", summary.isFetching && !loading && "opacity-70")}>
          <Metric loading={loading} label="Total income" value={s ? money(s.income.current) : "—"} />
          <Metric loading={loading} label="Total expenses" value={s ? money(s.expenses.current) : "—"} sub={s && s.refunds.current ? `Net of ${money(s.refunds.current)} refunds` : undefined} />
          <Metric
            loading={loading}
            label="Net cash flow"
            value={s ? <span className={s.net_cash_flow.current < 0 ? "text-negative" : undefined}>{money(s.net_cash_flow.current, { signed: true })}</span> : "—"}
          />
          <Metric loading={loading} label="Savings rate" value={s ? formatPercent(s.savings_rate.current) : "—"} sub={s?.savings_rate.current === null ? "No income in period" : undefined} />
          <Metric loading={loading} label="Avg. daily spending" value={s ? money(s.average_daily_spending) : "—"} sub={s ? `Over ${s.range.days} day${s.range.days === 1 ? "" : "s"}` : undefined} />
          <Metric
            loading={loading}
            label="Largest expense"
            value={s?.largest_expense ? money(s.largest_expense.amount) : "—"}
            sub={s?.largest_expense ? `${s.largest_expense.description} · ${date(s.largest_expense.occurred_on)}` : "No expenses"}
          />
          <Metric
            loading={loading}
            label="Top category"
            value={s?.top_category ? s.top_category.name : "—"}
            sub={s?.top_category ? `${money(s.top_category.amount)} · ${formatPercent(s.top_category.percent)}` : "No expenses"}
          />
          <Metric
            loading={loading}
            label="Spending change"
            value={s?.expenses.change_percent !== null && s?.expenses.change_percent !== undefined ? <DeltaLabel delta={{ value: s.expenses.change_percent, upIsGood: false, comparedTo: prev }} /> : "—"}
            sub={s && s.expenses.change_percent === null ? (s.has_previous_data ? "No spending previously" : "No earlier data") : undefined}
          />
          <Metric
            loading={loading}
            label="Budget utilisation"
            value={s?.budget_utilization ? formatPercent(s.budget_utilization.percent) : "—"}
            sub={
              s?.budget_utilization
                ? `${money(s.budget_utilization.spent, { decimals: "never" })} of ${money(s.budget_utilization.budgeted, { decimals: "never" })} · ${formatMonth(s.budget_utilization.month)}`
                : "No budget set"
            }
          />
          <Metric loading={loading} label="Transactions" value={s ? s.transaction_count : "—"} />
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartFrame
          title="Income vs expenses"
          description={`Monthly totals, last ${months} months`}
          action={
            <SegmentedControl
              label="Months"
              value={months}
              onChange={setMonths}
              options={[
                { value: 6, label: "6M" },
                { value: 12, label: "12M" },
              ]}
            />
          }
          isLoading={cashFlow.isLoading}
          isFetching={cashFlow.isFetching}
          error={cashFlow.error}
          onRetry={() => cashFlow.refetch()}
          isEmpty={cashFlow.isSuccess && cashPoints.every((p) => !p.income && !p.expenses)}
          table={{
            columns: ["Month", "Income", "Expenses", "Net"],
            rows: cashPoints.map((p) => [p.label, money(p.income), money(p.expenses), money(p.net, { signed: true })]),
          }}
        >
          <IncomeExpenseChart points={cashPoints} />
        </ChartFrame>
        {loaded ? <ExpenseBreakdownCard params={params} title="Expense categories" /> : null}
        {loaded ? <SpendingTrendCard params={params} /> : null}
        <ChartFrame
          title="Budget vs actual"
          description={budgetMonth ? `Category limits in ${formatMonth(budgetMonth)}` : undefined}
          isLoading={perf.isLoading || !budgetMonth}
          isFetching={perf.isFetching}
          error={perf.error}
          onRetry={() => perf.refetch()}
          isEmpty={perf.isSuccess && perfItems.length === 0}
          emptyTitle="No category budgets"
          emptyDescription="Create category budgets to compare them with actual spending."
          table={{
            columns: ["Category", "Budget", "Spent", "Used"],
            rows: perfItems.map((i) => [i.name, money(i.budgeted), money(i.spent), formatPercent(i.percent_used)]),
          }}
        >
          <BudgetVsActualChart data={perfItems.map((i) => ({ label: i.name, budgeted: i.budgeted, spent: i.spent }))} />
        </ChartFrame>
        <ChartFrame
          title="Monthly net cash flow"
          description="Income minus net spending each month (not a running balance), last 12 months"
          isLoading={savings.isLoading}
          isFetching={savings.isFetching}
          error={savings.error}
          onRetry={() => savings.refetch()}
          isEmpty={savings.isSuccess && savingsItems.every((i) => !i.income && !i.expenses)}
          table={{
            columns: ["Month", "Income", "Expenses", "Net cash flow", "Savings rate"],
            rows: savingsItems.map((i) => [i.label, money(i.income), money(i.expenses), money(i.net_cash_flow, { signed: true }), formatPercent(i.savings_rate)]),
          }}
        >
          <TrendLineChart data={savingsItems} dataKey="net_cash_flow" name="Net cash flow" color={t.series[0]} zeroLine />
        </ChartFrame>
        <ChartFrame
          title="Payment methods"
          description="Net spending by how you paid"
          isLoading={!loaded || methods.isLoading}
          isFetching={methods.isFetching}
          error={methods.error}
          onRetry={() => methods.refetch()}
          isEmpty={methods.isSuccess && methodItems.length === 0}
          emptyTitle="No spending in this period"
          height={220}
          table={{
            columns: ["Method", "Amount", "Share", "Transactions"],
            rows: methodItems.map((m) => [m.name, money(m.amount), formatPercent(m.percent), m.count]),
          }}
        >
          <DonutChart items={methodItems} total={methods.data?.total ?? 0} centerLabel="Spent" />
        </ChartFrame>
        <ChartFrame
          title="Top spending categories"
          description="Ranked by net spending"
          className="xl:col-span-2"
          isLoading={!loaded || top.isLoading}
          isFetching={top.isFetching}
          error={top.error}
          onRetry={() => top.refetch()}
          isEmpty={top.isSuccess && topItems.length === 0}
          emptyTitle="No spending in this period"
          height={160}
          table={{ columns: ["Category", "Amount"], rows: topItems.map((c) => [c.name, money(c.amount)]) }}
        >
          <HorizontalBarChart
            items={topItems}
            onSelect={(it) => {
              const qs = new URLSearchParams({ category_id: it.key });
              if (s) {
                qs.set("start_date", s.range.start_date);
                qs.set("end_date", s.range.end_date);
              }
              router.push(`/transactions?${qs.toString()}`);
            }}
          />
        </ChartFrame>
      </div>
    </>
  );
}
