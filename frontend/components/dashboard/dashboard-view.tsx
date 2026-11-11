"use client";

import { Plus } from "lucide-react";
import { usePreferences } from "@/components/providers/preferences-provider";
import { useTransactionDialog } from "@/components/providers/transaction-dialog-provider";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { useProfile, useSummary } from "@/hooks/queries";
import { BudgetProgressCard } from "./budget-progress-card";
import { CashFlowCard } from "./cash-flow-card";
import { ExpenseBreakdownCard } from "./expense-breakdown-card";
import { InsightsCard } from "./insights-card";
import { OnboardingCard } from "./onboarding-card";
import { PeriodFilter, usePeriodState } from "./period-filter";
import { RecentTransactionsCard } from "./recent-transactions-card";
import { SpendingTrendCard } from "./spending-trend-card";
import { SummaryCards } from "./summary-cards";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function DashboardView() {
  const profile = useProfile();
  const { loaded } = usePreferences();
  const [params, setParams] = usePeriodState();
  const { openCreate } = useTransactionDialog();
  // Wait for preferences so the first request already uses the preferred period.
  const ready = loaded || profile.isError;
  const summary = useSummary(params, ready);
  const name = profile.data?.display_name?.split(" ")[0];

  return (
    <>
      <PageHeader
        title={name ? `${greeting()}, ${name}` : "Overview"}
        description="Your financial picture at a glance."
        actions={
          <>
            <PeriodFilter
              value={params}
              onChange={setParams}
              range={summary.data?.range}
            />
            <Button
              variant="primary"
              size="sm"
              className="hidden sm:inline-flex lg:hidden"
              onClick={() => openCreate()}
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </>
        }
      />
      <OnboardingCard />
      <SummaryCards
        summary={summary.data}
        isLoading={!ready || summary.isLoading}
        error={summary.error}
        onRetry={() => summary.refetch()}
      />
      {ready ? (
        // Two independent columns on desktop so cards of different heights never leave gaps.
        // Below xl the columns use `display: contents` and `order` keeps an interleaved reading order.
        <div className="mt-4 flex flex-col gap-4 xl:grid xl:grid-cols-5 xl:items-start">
          <div className="contents xl:col-span-3 xl:flex xl:flex-col xl:gap-4">
            <div className="order-1 xl:order-none">
              <CashFlowCard params={params} />
            </div>
            <div className="order-3 xl:order-none">
              <SpendingTrendCard params={params} />
            </div>
            <div className="order-5 xl:order-none">
              <RecentTransactionsCard />
            </div>
          </div>
          <div className="contents xl:col-span-2 xl:flex xl:flex-col xl:gap-4">
            <div className="order-2 xl:order-none">
              <ExpenseBreakdownCard params={params} />
            </div>
            <div className="order-4 xl:order-none">
              <BudgetProgressCard />
            </div>
            <div className="order-6 xl:order-none">
              <InsightsCard params={params} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
