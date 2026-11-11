"use client";

import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatSignedPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface Delta {
  /** Change value: percent (default) or percentage points. */
  value: number;
  unit?: "percent" | "points";
  /** Whether an increase is good (income) or bad (expenses). */
  upIsGood: boolean;
  comparedTo: string;
}

export function DeltaLabel({ delta }: { delta: Delta }) {
  const flat = Math.abs(delta.value) < 0.05;
  const up = delta.value > 0;
  const good = flat ? null : up === delta.upIsGood;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  const text =
    delta.unit === "points"
      ? `${delta.value > 0 ? "+" : ""}${Number(delta.value.toFixed(1))} pts`
      : formatSignedPercent(delta.value);
  return (
    <span className="inline-flex flex-wrap items-center gap-1 text-xs">
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-md px-1 py-0.5 font-medium tabular-nums",
          good === null ? "bg-surface-2 text-fg-muted" : good ? "bg-accent-soft text-positive" : "bg-negative-soft text-negative",
        )}
      >
        <Icon className="h-3 w-3" aria-hidden />
        {text}
      </span>
      <span className="text-fg-subtle">vs {delta.comparedTo}</span>
    </span>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  delta,
  footnote,
  isLoading,
  children,
  className,
}: {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  delta?: Delta | null;
  footnote?: ReactNode;
  isLoading?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("p-4 sm:p-5", className)}>
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-fg-muted">{label}</p>
        {Icon ? <Icon className="h-4 w-4 text-fg-subtle" aria-hidden /> : null}
      </div>
      {isLoading ? (
        <div className="mt-3 space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
      ) : (
        <>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-fg">{value}</p>
          <div className="mt-1.5 min-h-5">
            {delta ? <DeltaLabel delta={delta} /> : footnote ? <span className="text-xs text-fg-subtle">{footnote}</span> : null}
          </div>
          {delta && footnote ? <p className="mt-1 text-xs text-fg-subtle">{footnote}</p> : null}
          {children}
        </>
      )}
    </Card>
  );
}
