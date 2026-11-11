import { cn } from "@/lib/utils";
import type { BudgetState } from "@/types/api";

const fills: Record<BudgetState | "neutral", string> = {
  on_track: "bg-accent",
  approaching: "bg-warning",
  exceeded: "bg-negative",
  neutral: "bg-fg-muted",
};

export function Progress({
  value,
  status = "on_track",
  color,
  label,
  className,
}: {
  value: number;
  status?: BudgetState | "neutral";
  color?: string;
  label: string;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-surface-3", className)}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500 ease-out", !color && fills[status])}
        style={{ width: `${clamped}%`, backgroundColor: color }}
      />
    </div>
  );
}
