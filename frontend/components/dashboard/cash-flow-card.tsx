"use client";

import { useState } from "react";
import { ChartFrame } from "@/components/charts/chart-frame";
import { IncomeExpenseChart } from "@/components/charts/income-expense-chart";
import { usePreferences } from "@/components/providers/preferences-provider";
import { SegmentedControl } from "@/components/ui/segmented";
import { useCashFlow } from "@/hooks/queries";
import type { AnalyticsParams, Interval } from "@/types/api";

export const INTERVAL_OPTIONS: { value: Interval; label: string }[] = [
  { value: "day", label: "Daily" },
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
];

/** Interval chosen by the user for the current period; falls back to the backend's default. */
export function useIntervalFor(params: AnalyticsParams) {
  const key = JSON.stringify(params);
  const [state, setState] = useState<{ key: string; interval?: Interval }>({ key });
  const interval = state.key === key ? state.interval : undefined;
  return [interval, (i: Interval) => setState({ key, interval: i })] as const;
}

export function CashFlowCard({ params }: { params: AnalyticsParams }) {
  const { money } = usePreferences();
  const [interval, setInterval] = useIntervalFor(params);
  const q = useCashFlow({ ...params, interval });
  const points = q.data?.points ?? [];
  const empty = points.every((p) => p.income === 0 && p.expenses === 0);
  return (
    <ChartFrame
      title="Income vs expenses"
      description="Expenses are net of refunds; transfers are excluded."
      action={
        <SegmentedControl
          label="Chart interval"
          value={q.data?.interval ?? interval ?? "day"}
          onChange={setInterval}
          options={INTERVAL_OPTIONS}
        />
      }
      isLoading={q.isLoading}
      isFetching={q.isFetching}
      error={q.error}
      onRetry={() => q.refetch()}
      isEmpty={q.isSuccess && empty}
      emptyDescription="Add income or expense transactions to see your cash flow."
      table={{
        columns: ["Period", "Income", "Expenses", "Net"],
        rows: points.map((p) => [p.label, money(p.income), money(p.expenses), money(p.net, { signed: true })]),
      }}
    >
      <IncomeExpenseChart points={points} />
    </ChartFrame>
  );
}
