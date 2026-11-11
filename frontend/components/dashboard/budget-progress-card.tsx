"use client";

import { AlertTriangle, CircleCheck, OctagonAlert, Target } from "lucide-react";
import Link from "next/link";
import { usePreferences } from "@/components/providers/preferences-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { SkeletonRows } from "@/components/ui/skeleton";
import { useBudgets } from "@/hooks/queries";
import { errorMessage } from "@/lib/api";
import { formatMonth, formatPercent } from "@/lib/format";
import type { BudgetState, BudgetStatus } from "@/types/api";

export const STATUS_META: Record<BudgetState, { label: string; tone: "positive" | "warning" | "negative"; icon: typeof CircleCheck }> = {
  on_track: { label: "On track", tone: "positive", icon: CircleCheck },
  approaching: { label: "Approaching limit", tone: "warning", icon: AlertTriangle },
  exceeded: { label: "Exceeded", tone: "negative", icon: OctagonAlert },
};

export function BudgetStatusBadge({ status }: { status: BudgetState }) {
  const m = STATUS_META[status];
  const Icon = m.icon;
  return (
    <Badge tone={m.tone}>
      <Icon className="h-3 w-3" aria-hidden />
      {m.label}
    </Badge>
  );
}

export function BudgetRow({ b }: { b: BudgetStatus }) {
  const { money } = usePreferences();
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {b.category ? (
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: b.category.color }} aria-hidden />
          ) : null}
          <span className="truncate text-[13px] font-medium">{b.name}</span>
        </div>
        <BudgetStatusBadge status={b.status} />
      </div>
      <Progress value={b.percent_used} status={b.status} label={`${b.name}: ${formatPercent(b.percent_used)} used`} />
      <div className="flex justify-between text-xs text-fg-subtle tabular-nums">
        <span>
          {money(b.spent, { decimals: "never" })} of {money(b.amount, { decimals: "never" })} · {formatPercent(b.percent_used, 0)}
        </span>
        <span className={b.remaining < 0 ? "text-negative" : undefined}>
          {b.remaining < 0 ? `${money(-b.remaining, { decimals: "never" })} over` : `${money(b.remaining, { decimals: "never" })} left`}
        </span>
      </div>
    </div>
  );
}

export function BudgetProgressCard() {
  const q = useBudgets();
  const list = q.data ? [...(q.data.overall ? [q.data.overall] : []), ...q.data.categories] : [];
  // Most urgent first.
  const order: Record<BudgetState, number> = { exceeded: 0, approaching: 1, on_track: 2 };
  const sorted = [...list].sort((a, b) => order[a.status] - order[b.status] || b.percent_used - a.percent_used).slice(0, 6);
  return (
    <Card>
      <CardHeader
        title="Budgets"
        description={q.data ? formatMonth(q.data.month) : undefined}
        action={
          <Link href="/budgets">
            <Button size="sm" variant="ghost">
              Manage
            </Button>
          </Link>
        }
      />
      <CardBody>
        {q.isLoading ? (
          <SkeletonRows rows={3} />
        ) : q.error ? (
          <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
        ) : sorted.length === 0 ? (
          <EmptyState
            icon={Target}
            title="No budgets this month"
            description="Set a monthly limit to see how your spending tracks against it."
            action={
              <Link href="/budgets?new=1">
                <Button size="sm" variant="primary">
                  Create a budget
                </Button>
              </Link>
            }
          />
        ) : (
          <div className="space-y-4">
            {sorted.map((b) => (
              <BudgetRow key={b.id} b={b} />
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
