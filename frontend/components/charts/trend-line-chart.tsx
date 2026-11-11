"use client";

import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { usePreferences } from "@/components/providers/preferences-provider";
import { ChartTooltip } from "./chart-tooltip";
import { useChartTheme } from "./palette";

/** Single-series line with a 10% area wash and crosshair tooltip. */
export function TrendLineChart<T extends { label: string }>({
  data,
  dataKey,
  name,
  color,
  height = 240,
  zeroLine = false,
  valueFormatter,
}: {
  data: T[];
  dataKey: keyof T & string;
  name: string;
  color?: string;
  height?: number;
  zeroLine?: boolean;
  valueFormatter?: (v: number) => string;
}) {
  const t = useChartTheme();
  const { compact } = usePreferences();
  const stroke = color ?? t.series[0];
  const gradientId = `fill-${dataKey}`;
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height }}>
        <AreaChart data={data as Record<string, unknown>[]} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.14} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={t.grid} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: t.grid }}
            tick={{ fill: t.axis, fontSize: 11 }}
            interval="preserveStartEnd"
            minTickGap={14}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: t.axis, fontSize: 11 }}
            tickFormatter={(v: number) => (valueFormatter ? valueFormatter(v) : compact(v))}
            width={56}
          />
          {zeroLine ? <ReferenceLine y={0} stroke={t.axis} strokeOpacity={0.6} /> : null}
          <Tooltip
            cursor={{ stroke: t.axis, strokeWidth: 1 }}
            content={<ChartTooltip valueFormatter={valueFormatter} />}
          />
          <Area
            type="monotone"
            dataKey={dataKey as string}
            name={name}
            stroke={stroke}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={data.length <= 14 ? { r: 3, strokeWidth: 2, stroke: t.surface, fill: stroke } : false}
            activeDot={{ r: 5, strokeWidth: 2, stroke: t.surface, fill: stroke }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
