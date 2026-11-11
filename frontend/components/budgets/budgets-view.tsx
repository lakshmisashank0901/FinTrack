"use client";

import { ChevronLeft, ChevronRight, MoreHorizontal, Pencil, Plus, Target, Trash2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { BudgetVsActualChart } from "@/components/charts/budget-vs-actual-chart";
import { ChartFrame } from "@/components/charts/chart-frame";
import { BudgetRow } from "@/components/dashboard/budget-progress-card";
import { usePreferences } from "@/components/providers/preferences-provider";
import { DemoBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Menu } from "@/components/ui/menu";
import { PageHeader } from "@/components/ui/page-header";
import { SkeletonRows } from "@/components/ui/skeleton";
import { useBudgetHistory, useBudgetPerformance, useBudgets } from "@/hooks/queries";
import { useFinanceMutation } from "@/hooks/use-finance-mutation";
import { api, errorMessage } from "@/lib/api";
import { currentMonth, formatMonth, formatPercent, shiftMonth } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BudgetStatus } from "@/types/api";
import { BudgetFormDialog } from "./budget-form-dialog";

export function BudgetsView() {
  const { prefs, money } = usePreferences();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const thisMonth = currentMonth(prefs.timezone);
  const [month, setMonth] = useState(thisMonth);
  const [form, setForm] = useState<BudgetStatus | "new" | null>(params.get("new") ? "new" : null);
  const [deleting, setDeleting] = useState<BudgetStatus | null>(null);
  const [historyMonths, setHistoryMonths] = useState(6);

  const q = useBudgets(month);
  const perf = useBudgetPerformance(month);
  const history = useBudgetHistory(historyMonths);

  const remove = useFinanceMutation((b: BudgetStatus) => api.budgets.remove(b.id), {
    success: "Budget deleted",
    onSuccess: () => setDeleting(null),
  });

  const closeForm = () => {
    setForm(null);
    if (params.get("new")) router.replace(pathname);
  };

  const data = q.data;
  const all = data ? [...(data.overall ? [data.overall] : []), ...data.categories] : [];

  const actions = (b: BudgetStatus) => (
    <Menu
      label={`${b.name} actions`}
      items={[
        { label: "Edit", icon: <Pencil className="h-4 w-4" />, onSelect: () => setForm(b) },
        { label: "Delete", icon: <Trash2 className="h-4 w-4" />, danger: true, onSelect: () => setDeleting(b) },
      ]}
      trigger={(p) => (
        <Button size="icon-sm" variant="ghost" aria-label={`${b.name} actions`} {...p}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      )}
    />
  );

  const perfItems = perf.data?.items ?? [];

  return (
    <>
      <PageHeader
        title="Budgets"
        description="Monthly limits, measured against net spending (expenses minus refunds)."
        actions={
          <>
            <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-0.5">
              <Button size="icon-sm" variant="ghost" aria-label="Previous month" onClick={() => setMonth((m) => shiftMonth(m, -1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-20 text-center text-[13px] font-medium tabular-nums" aria-live="polite">
                {formatMonth(month)}
              </span>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Next month"
                disabled={month >= thisMonth}
                onClick={() => setMonth((m) => shiftMonth(m, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button size="sm" variant="primary" onClick={() => setForm("new")}>
              <Plus className="h-4 w-4" />
              New budget
            </Button>
          </>
        }
      />

      {q.isLoading ? (
        <Card className="p-5">
          <SkeletonRows rows={4} />
        </Card>
      ) : q.error ? (
        <Card>
          <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
        </Card>
      ) : all.length === 0 ? (
        <Card>
          <EmptyState
            icon={Target}
            title={`No budgets active in ${formatMonth(month)}`}
            description="Create an overall monthly limit, or limits for individual categories."
            action={
              <Button size="sm" variant="primary" onClick={() => setForm("new")}>
                Create a budget
              </Button>
            }
          />
        </Card>
      ) : (
        <div className={cn("grid gap-4 lg:grid-cols-3", q.isFetching && "opacity-70")}>
          <div className="space-y-4 lg:col-span-2">
            {data?.overall ? (
              <Card className="p-5">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium tracking-wide text-fg-subtle uppercase">Overall budget</p>
                    {data.overall.is_demo ? <DemoBadge /> : null}
                  </div>
                  {actions(data.overall)}
                </div>
                <BudgetRow b={data.overall} />
              </Card>
            ) : null}
            <Card>
              <CardHeader title="Category budgets" description="Each category is tracked on its own; these limits are not added to the overall budget." />
              <CardBody>
                {data?.categories.length ? (
                  <ul className="divide-y divide-border">
                    {data.categories.map((b) => (
                      <li key={b.id} className="flex items-start gap-2 py-3 first:pt-0 last:pb-0">
                        <div className="min-w-0 flex-1">
                          <BudgetRow b={b} />
                          {b.is_demo ? (
                            <div className="mt-1">
                              <DemoBadge />
                            </div>
                          ) : null}
                        </div>
                        {actions(b)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[13px] text-fg-subtle">No category budgets for this month.</p>
                )}
              </CardBody>
            </Card>
          </div>
          <Card className="h-fit p-5">
            <h2 className="text-sm font-semibold">{formatMonth(month)} summary</h2>
            <dl className="mt-3 space-y-2.5 text-[13px]">
              {[
                ["Total spending", data ? money(data.summary.total_spent) : "—"],
                ["Category limits", data ? money(data.summary.category_budgeted) : "—"],
                ["Spent in budgeted categories", data ? money(data.summary.category_spent) : "—"],
                ["Spent outside category budgets", data ? money(data.summary.unbudgeted_spent) : "—"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-fg-subtle">{k}</dt>
                  <dd className="font-medium tabular-nums">{v}</dd>
                </div>
              ))}
              {data?.overall ? (
                <div className="flex justify-between gap-3 border-t border-border pt-2.5">
                  <dt className="text-fg-subtle">Overall limit used</dt>
                  <dd className="font-medium tabular-nums">{formatPercent(data.overall.percent_used)}</dd>
                </div>
              ) : null}
            </dl>
          </Card>
        </div>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <ChartFrame
          title="Budget vs actual"
          description={`Category limits compared with spending in ${formatMonth(month)}`}
          isLoading={perf.isLoading}
          isFetching={perf.isFetching}
          error={perf.error}
          onRetry={() => perf.refetch()}
          isEmpty={perf.isSuccess && perfItems.length === 0}
          emptyTitle="No category budgets to compare"
          table={{
            columns: ["Category", "Budget", "Spent", "Used"],
            rows: perfItems.map((i) => [i.name, money(i.budgeted), money(i.spent), formatPercent(i.percent_used)]),
          }}
        >
          <BudgetVsActualChart data={perfItems.map((i) => ({ label: i.name, budgeted: i.budgeted, spent: i.spent }))} />
        </ChartFrame>
        <ChartFrame
          title="Budget history"
          description="Monthly limit compared with matching spending"
          action={
            <div className="flex gap-1">
              {[6, 12].map((n) => (
                <Button key={n} size="sm" variant={historyMonths === n ? "secondary" : "ghost"} onClick={() => setHistoryMonths(n)}>
                  {n}M
                </Button>
              ))}
            </div>
          }
          isLoading={history.isLoading}
          isFetching={history.isFetching}
          error={history.error}
          onRetry={() => history.refetch()}
          isEmpty={history.isSuccess && (history.data?.items ?? []).every((i) => i.budgeted === 0)}
          emptyTitle="No budget history yet"
          table={{
            columns: ["Month", "Budget", "Spent", "Status"],
            rows: (history.data?.items ?? []).map((i) => [
              formatMonth(i.month),
              money(i.budgeted),
              money(i.spent),
              i.status === "none" ? "—" : i.status.replace("_", " "),
            ]),
          }}
        >
          <BudgetVsActualChart
            data={(history.data?.items ?? []).map((i) => ({ label: formatMonth(i.month), budgeted: i.budgeted, spent: i.spent }))}
          />
        </ChartFrame>
      </div>

      {form ? (
        <BudgetFormDialog
          budget={form === "new" ? undefined : form}
          month={month}
          hasOverall={!!data?.overall}
          takenCategoryIds={(data?.categories ?? []).map((b) => b.category_id!).filter(Boolean)}
          onClose={closeForm}
        />
      ) : null}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting)}
        loading={remove.isPending}
        title="Delete budget?"
        description={<p>“{deleting?.name}” will be removed from every month. Your transactions are not affected.</p>}
      />
    </>
  );
}
