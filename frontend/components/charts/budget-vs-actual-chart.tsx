"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { usePreferences } from "@/components/providers/preferences-provider";
import { ChartTooltip, LegendItems } from "./chart-tooltip";
import { useChartTheme } from "./palette";

export interface BudgetBar {
  label: string;
  budgeted: number;
  spent: number;
}

export function BudgetVsActualChart({
  data,
  height = 260,
  budgetLabel = "Budget",
  spentLabel = "Spent",
}: {
  data: BudgetBar[];
  height?: number;
  budgetLabel?: string;
  spentLabel?: string;
}) {
  const t = useChartTheme();
  const { compact } = usePreferences();
  return (
    <div>
      <LegendItems
        items={[
          { label: budgetLabel, color: t.series[0] },
          { label: spentLabel, color: t.series[1] },
        ]}
      />
      <div style={{ height }} className="mt-3">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height }}>
          <BarChart data={data} barGap={2} barCategoryGap="28%" margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={t.grid} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: t.grid }}
              tick={{ fill: t.axis, fontSize: 11 }}
              interval={0}
              tickFormatter={(v: string) => (v.length > 12 ? `${v.slice(0, 11)}…` : v)}
            />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: t.axis, fontSize: 11 }} tickFormatter={(v: number) => compact(v)} width={56} />
            <Tooltip cursor={{ fill: t.grid, opacity: 0.5 }} content={<ChartTooltip />} />
            <Bar dataKey="budgeted" name={budgetLabel} fill={t.series[0]} radius={[4, 4, 0, 0]} maxBarSize={24} />
            <Bar dataKey="spent" name={spentLabel} fill={t.series[1]} radius={[4, 4, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
