"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { usePreferences } from "@/components/providers/preferences-provider";
import type { CashFlowPoint } from "@/types/api";
import { ChartTooltip, LegendItems } from "./chart-tooltip";
import { useChartTheme } from "./palette";

/** Grouped bars: income vs net expenses per bucket. */
export function IncomeExpenseChart({ points, height = 260 }: { points: CashFlowPoint[]; height?: number }) {
  const t = useChartTheme();
  const { compact } = usePreferences();
  const many = points.length > 16;
  return (
    <div>
      <LegendItems
        items={[
          { label: "Income", color: t.income },
          { label: "Expenses", color: t.expense },
        ]}
      />
      <div style={{ height }} className="mt-3">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height }}>
          <BarChart data={points} barGap={2} barCategoryGap={many ? "18%" : "28%"} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={t.grid} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: t.grid }}
              tick={{ fill: t.axis, fontSize: 11 }}
              interval="preserveStartEnd"
              minTickGap={many ? 16 : 6}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: t.axis, fontSize: 11 }}
              tickFormatter={(v: number) => compact(v)}
              width={56}
            />
            <Tooltip cursor={{ fill: t.grid, opacity: 0.5 }} content={<ChartTooltip />} />
            <Bar dataKey="income" name="Income" fill={t.income} radius={[4, 4, 0, 0]} maxBarSize={24} />
            <Bar dataKey="expenses" name="Expenses" fill={t.expense} radius={[4, 4, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
