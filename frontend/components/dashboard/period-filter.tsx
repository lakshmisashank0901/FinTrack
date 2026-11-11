"use client";

import { useState } from "react";
import { usePreferences } from "@/components/providers/preferences-provider";
import { DateRangeInputs } from "@/components/ui/date-range";
import { Select } from "@/components/ui/input";
import { PERIODS } from "@/lib/constants";
import type { AnalyticsParams, AnalyticsRange, Period } from "@/types/api";

/** Period state that defaults to the user's preferred period until they choose another. */
export function usePeriodState() {
  const { prefs } = usePreferences();
  const [override, setOverride] = useState<AnalyticsParams | null>(null);
  const params: AnalyticsParams = override ?? { period: prefs.default_period };
  return [params, setOverride] as const;
}

export function PeriodFilter({
  value,
  onChange,
  range,
}: {
  value: AnalyticsParams;
  onChange: (v: AnalyticsParams) => void;
  range?: AnalyticsRange;
}) {
  const { today, date } = usePreferences();
  const period = value.period ?? "this_month";
  const choose = (p: Period) => {
    if (p === "custom") {
      const end = today();
      const start = range?.start_date ?? `${end.slice(0, 8)}01`;
      onChange({ ...value, period: "custom", start_date: start, end_date: range?.end_date ?? end });
    } else {
      onChange({ ...value, period: p, start_date: undefined, end_date: undefined });
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="period" className="sr-only">
        Period
      </label>
      <Select id="period" value={period} onChange={(e) => choose(e.target.value as Period)} className="h-8 w-auto text-[13px]">
        {PERIODS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
        <option value="custom">Custom range</option>
      </Select>
      {period === "custom" ? (
        <DateRangeInputs
          start={value.start_date ?? ""}
          end={value.end_date ?? ""}
          max={today()}
          onChange={({ start, end }) => {
            if (start && end && start <= end) onChange({ ...value, period: "custom", start_date: start, end_date: end });
          }}
        />
      ) : range ? (
        <span className="text-xs text-fg-subtle tabular-nums">
          {date(range.start_date)} – {date(range.end_date)}
        </span>
      ) : null}
    </div>
  );
}
