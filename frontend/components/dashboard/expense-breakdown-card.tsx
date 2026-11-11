"use client";

import { useRouter } from "next/navigation";
import { ChartFrame } from "@/components/charts/chart-frame";
import { DonutChart } from "@/components/charts/donut-chart";
import { usePreferences } from "@/components/providers/preferences-provider";
import { useExpenseBreakdown } from "@/hooks/queries";
import { formatPercent } from "@/lib/format";
import type { AnalyticsParams } from "@/types/api";

export function ExpenseBreakdownCard({ params, title = "Where your money goes" }: { params: AnalyticsParams; title?: string }) {
  const router = useRouter();
  const { money } = usePreferences();
  const q = useExpenseBreakdown(params);
  const items = (q.data?.items ?? []).map((it) => ({
    key: it.category_id ?? "uncategorized",
    name: it.name,
    amount: it.amount,
    percent: it.percent,
    color: it.color,
    count: it.transaction_count,
  }));
  const range = q.data?.range;
  return (
    <ChartFrame
      title={title}
      description="Net spending by category. Select a category to see its transactions."
      isLoading={q.isLoading}
      isFetching={q.isFetching}
      error={q.error}
      onRetry={() => q.refetch()}
      isEmpty={q.isSuccess && items.length === 0}
      emptyTitle="No spending yet"
      emptyDescription="Once you record expenses in this period, you'll see how they split across categories."
      height={220}
      table={{
        columns: ["Category", "Amount", "Share", "Transactions"],
        rows: items.map((i) => [i.name, money(i.amount), formatPercent(i.percent), i.count ?? 0]),
      }}
    >
      <DonutChart
        items={items}
        total={q.data?.total ?? 0}
        centerLabel="Spent"
        selectLabel={(it) => `View ${it.name} transactions`}
        onSelect={(it) => {
          const qs = new URLSearchParams({ category_id: it.key });
          if (range) {
            qs.set("start_date", range.start_date);
            qs.set("end_date", range.end_date);
          }
          router.push(`/transactions?${qs.toString()}`);
        }}
      />
    </ChartFrame>
  );
}
