"use client";

import { ChartFrame } from "@/components/charts/chart-frame";
import { useChartTheme } from "@/components/charts/palette";
import { TrendLineChart } from "@/components/charts/trend-line-chart";
import { usePreferences } from "@/components/providers/preferences-provider";
import { SegmentedControl } from "@/components/ui/segmented";
import { useSpendingTrend } from "@/hooks/queries";
import type { AnalyticsParams } from "@/types/api";
import { INTERVAL_OPTIONS, useIntervalFor } from "./cash-flow-card";

export function SpendingTrendCard({ params }: { params: AnalyticsParams }) {
  const { money } = usePreferences();
  const t = useChartTheme();
  const [interval, setInterval] = useIntervalFor(params);
  const q = useSpendingTrend({ ...params, interval });
  const points = q.data?.points ?? [];
  const label = { day: "Daily", week: "Weekly", month: "Monthly" }[q.data?.interval ?? "day"];
  return (
    <ChartFrame
      title="Spending trend"
      description={`${label} net spending`}
      action={
        <SegmentedControl
          label="Trend interval"
          value={q.data?.interval ?? interval ?? "day"}
          onChange={setInterval}
          options={INTERVAL_OPTIONS}
        />
      }
      isLoading={q.isLoading}
      isFetching={q.isFetching}
      error={q.error}
      onRetry={() => q.refetch()}
      isEmpty={q.isSuccess && (q.data?.total ?? 0) === 0}
      emptyTitle="No spending in this period"
      height={220}
      table={{ columns: ["Period", "Spent"], rows: points.map((p) => [p.label, money(p.amount)]) }}
    >
      <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1">
        <div>
          <p className="text-xs text-fg-subtle">Total</p>
          <p className="text-base font-semibold tabular-nums">{money(q.data?.total ?? 0)}</p>
        </div>
        <div>
          <p className="text-xs text-fg-subtle">Average per day</p>
          <p className="text-base font-semibold tabular-nums">{money(q.data?.average_daily ?? 0)}</p>
        </div>
      </div>
      <TrendLineChart data={points} dataKey="amount" name="Spent" color={t.expense} height={200} />
    </ChartFrame>
  );
}
