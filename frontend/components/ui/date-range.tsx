"use client";

import { Input } from "./input";

export function DateRangeInputs({
  start,
  end,
  onChange,
  max,
}: {
  start: string;
  end: string;
  onChange: (range: { start: string; end: string }) => void;
  max?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <label className="sr-only" htmlFor="range-start">
        Start date
      </label>
      <Input
        id="range-start"
        type="date"
        value={start}
        max={end || max}
        onChange={(e) => onChange({ start: e.target.value, end })}
        className="h-8 w-[9.5rem] text-xs"
      />
      <span className="text-xs text-fg-subtle">to</span>
      <label className="sr-only" htmlFor="range-end">
        End date
      </label>
      <Input
        id="range-end"
        type="date"
        value={end}
        min={start}
        max={max}
        onChange={(e) => onChange({ start, end: e.target.value })}
        className="h-8 w-[9.5rem] text-xs"
      />
    </div>
  );
}
