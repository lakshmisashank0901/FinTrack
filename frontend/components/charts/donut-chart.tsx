"use client";

import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { usePreferences } from "@/components/providers/preferences-provider";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ChartTooltip } from "./chart-tooltip";
import { useChartTheme } from "./palette";

export interface DonutItem {
  key: string;
  name: string;
  amount: number;
  percent: number;
  color: string;
  count?: number;
}

/** Donut with a compact legend beside it (desktop) or below it (mobile). */
export function DonutChart({
  items,
  total,
  centerLabel = "Total",
  onSelect,
  selectLabel,
  height = 220,
}: {
  items: DonutItem[];
  total: number;
  centerLabel?: string;
  onSelect?: (item: DonutItem) => void;
  selectLabel?: (item: DonutItem) => string;
  height?: number;
}) {
  const t = useChartTheme();
  const { money } = usePreferences();
  const [hover, setHover] = useState<number | null>(null);
  const active = hover !== null ? items[hover] : null;

  return (
    <div className="@container">
      <div className="flex flex-col items-center gap-5 @lg:flex-row @lg:items-center">
        <div className="relative shrink-0" style={{ width: height, height }}>
          <ResponsiveContainer
            width="100%"
            height="100%"
            initialDimension={{ width: height, height }}
          >
            <PieChart>
              <Pie
                data={items}
                dataKey="amount"
                nameKey="name"
                innerRadius="64%"
                outerRadius="100%"
                paddingAngle={items.length > 1 ? 1 : 0}
                stroke={t.surface}
                strokeWidth={2}
                isAnimationActive={false}
                onMouseEnter={(_, i) => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onClick={(_, i) => onSelect?.(items[i])}
                className={onSelect ? "cursor-pointer" : undefined}
              >
                {items.map((it, i) => (
                  <Cell
                    key={it.key}
                    fill={it.color}
                    opacity={hover === null || hover === i ? 1 : 0.45}
                  />
                ))}
              </Pie>
              <Tooltip
                content={
                  <ChartTooltip
                    valueFormatter={(v, row) =>
                      `${money(v)} · ${formatPercent((row.payload as unknown as DonutItem | undefined)?.percent ?? 0)}`
                    }
                  />
                }
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-[11px] text-fg-subtle">
              {active ? active.name : centerLabel}
            </span>
            <span className="text-base font-semibold tabular-nums">
              {money(active ? active.amount : total, { decimals: "never" })}
            </span>
            {active ? (
              <span className="text-[11px] text-fg-subtle">
                {formatPercent(active.percent)}
              </span>
            ) : null}
          </div>
        </div>
        <ul className="w-full min-w-0 flex-1 space-y-0.5" aria-label="Legend">
          {items.map((it, i) => {
            const content = (
              <>
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                  style={{ backgroundColor: it.color }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate text-fg">
                  {it.name}
                </span>
                <span className="text-fg-subtle tabular-nums">
                  {formatPercent(it.percent)}
                </span>
                <span className="w-24 text-right font-medium tabular-nums">
                  {money(it.amount, { decimals: "never" })}
                </span>
              </>
            );
            const cls = cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
              hover === i && "bg-surface-2",
            );
            return (
              <li
                key={it.key}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                {onSelect ? (
                  <button
                    type="button"
                    className={cn(cls, "hover:bg-surface-2")}
                    onClick={() => onSelect(it)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    aria-label={selectLabel ? selectLabel(it) : it.name}
                  >
                    {content}
                  </button>
                ) : (
                  <div className={cls}>{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
