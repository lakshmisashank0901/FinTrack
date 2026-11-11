"use client";

import { AlertTriangle, Info, Lightbulb, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { SkeletonRows } from "@/components/ui/skeleton";
import { useInsights } from "@/hooks/queries";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { AnalyticsParams, Insight } from "@/types/api";

const TONE: Record<Insight["tone"], { icon: typeof Info; cls: string }> = {
  positive: { icon: TrendingUp, cls: "bg-accent-soft text-positive" },
  negative: { icon: TrendingDown, cls: "bg-negative-soft text-negative" },
  warning: { icon: AlertTriangle, cls: "bg-warning-soft text-warning" },
  neutral: { icon: Info, cls: "bg-surface-2 text-fg-muted" },
};

export function InsightsCard({ params }: { params: AnalyticsParams }) {
  const q = useInsights(params);
  return (
    <Card>
      <CardHeader title="Insights" description="Observations drawn from your own records." />
      <CardBody>
        {q.isLoading ? (
          <SkeletonRows rows={3} />
        ) : q.error ? (
          <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
        ) : !q.data?.items.length ? (
          <EmptyState icon={Lightbulb} title="Not enough data yet" description="Insights appear once there's enough activity to support them." />
        ) : (
          <ul className={cn("space-y-3", q.isFetching && "opacity-60")}>
            {q.data.items.map((it) => {
              const t = TONE[it.tone] ?? TONE.neutral;
              const Icon = t.icon;
              return (
                <li key={it.id} className="flex gap-3">
                  <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", t.cls)} aria-hidden>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <p className="text-[13px] font-medium">{it.title}</p>
                    <p className="text-xs text-fg-muted">{it.message}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
