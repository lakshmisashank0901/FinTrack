"use client";

import { usePreferences } from "@/components/providers/preferences-provider";

interface Row {
  name?: string | number;
  value?: number | string | (number | string)[];
  color?: string;
  dataKey?: string | number;
  payload?: Record<string, unknown>;
}

/** Shared tooltip: value leads (strong), series name follows; keyed with a short line. */
export function ChartTooltip({
  active,
  payload,
  label,
  labelFormatter,
  valueFormatter,
}: {
  active?: boolean;
  payload?: Row[];
  label?: string | number;
  labelFormatter?: (label: string | number | undefined, payload?: Row[]) => string;
  valueFormatter?: (v: number, row: Row) => string;
}) {
  const { money } = usePreferences();
  if (!active || !payload?.length) return null;
  const fmt = valueFormatter ?? ((v: number) => money(v));
  const heading = labelFormatter ? labelFormatter(label, payload) : label;
  return (
    <div className="pointer-events-none min-w-36 rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-lg">
      {heading !== undefined && heading !== "" ? <p className="mb-1.5 text-fg-subtle">{heading}</p> : null}
      <ul className="space-y-1">
        {payload.map((row, i) => (
          <li key={`${row.dataKey ?? i}`} className="flex items-center gap-2">
            <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: row.color }} aria-hidden />
            <span className="font-semibold text-fg tabular-nums">{fmt(Number(row.value ?? 0), row)}</span>
            <span className="text-fg-subtle">{row.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LegendItems({ items }: { items: { label: string; color: string; shape?: "bar" | "line" }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={it.shape === "line" ? "h-0.5 w-3.5 rounded-full" : "h-2.5 w-2.5 rounded-[3px]"}
            style={{ backgroundColor: it.color }}
          />
          {it.label}
        </li>
      ))}
    </ul>
  );
}
