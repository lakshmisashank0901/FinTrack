"use client";

import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { usePreferences } from "@/components/providers/preferences-provider";
import { ChartTooltip } from "./chart-tooltip";
import { useChartTheme } from "./palette";

export interface RankedItem {
  key: string;
  name: string;
  amount: number;
  color: string;
}

/** Ranked horizontal bars; each bar wears its entity's colour, value at the tip. */
export function HorizontalBarChart({ items, onSelect }: { items: RankedItem[]; onSelect?: (item: RankedItem) => void }) {
  const t = useChartTheme();
  const { compact } = usePreferences();
  const height = Math.max(120, items.length * 36 + 12);
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 500, height }}>
        <BarChart data={items} layout="vertical" margin={{ top: 0, right: 56, left: 0, bottom: 0 }} barCategoryGap="30%">
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            tickLine={false}
            axisLine={false}
            width={110}
            tick={{ fill: t.text, fontSize: 12 }}
            tickFormatter={(v: string) => (v.length > 15 ? `${v.slice(0, 14)}…` : v)}
          />
          <Tooltip cursor={{ fill: t.grid, opacity: 0.5 }} content={<ChartTooltip />} />
          <Bar
            dataKey="amount"
            name="Spent"
            radius={[0, 4, 4, 0]}
            maxBarSize={20}
            onClick={(_, i) => onSelect?.(items[i])}
            className={onSelect ? "cursor-pointer" : undefined}
          >
            {items.map((it) => (
              <Cell key={it.key} fill={it.color} />
            ))}
            <LabelList dataKey="amount" position="right" formatter={(v) => compact(Number(v))} fill={t.text} fontSize={11} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
