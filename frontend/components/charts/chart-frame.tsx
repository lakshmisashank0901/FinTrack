"use client";

import { BarChart3, Table2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

const SKELETON_BARS = [45, 70, 35, 85, 55, 65, 40, 75];

export interface ChartTable {
  columns: string[];
  rows: (string | number)[][];
}

export interface ChartFrameProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  isLoading?: boolean;
  isFetching?: boolean;
  error?: unknown;
  onRetry?: () => void;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: ReactNode;
  emptyAction?: ReactNode;
  height?: number;
  table?: ChartTable;
  className?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** Card wrapper giving every chart the same loading / error / empty / table states. */
export function ChartFrame({
  title,
  description,
  action,
  isLoading,
  isFetching,
  error,
  onRetry,
  isEmpty,
  emptyTitle = "No data for this period",
  emptyDescription,
  emptyAction,
  height = 260,
  table,
  className,
  children,
  footer,
}: ChartFrameProps) {
  const [showTable, setShowTable] = useState(false);
  const canTable = !!table && !isLoading && !error && !isEmpty;
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader
        title={title}
        description={description}
        action={
          <>
            {action}
            {canTable ? (
              <button
                type="button"
                onClick={() => setShowTable((s) => !s)}
                aria-pressed={showTable}
                aria-label={showTable ? "Show chart" : "Show data table"}
                title={showTable ? "Show chart" : "Show data table"}
                className="rounded-md p-1.5 text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg"
              >
                {showTable ? <BarChart3 className="h-4 w-4" /> : <Table2 className="h-4 w-4" />}
              </button>
            ) : null}
          </>
        }
      />
      <div className="flex-1 px-5 pt-3 pb-5">
        {isLoading ? (
          <div style={{ height }} className="flex flex-col justify-end gap-2" aria-busy="true" aria-label="Loading chart">
            <div className="flex flex-1 items-end gap-2">
              {SKELETON_BARS.map((h, i) => (
                <div key={i} className="flex-1" style={{ height: `${h}%` }}>
                  <Skeleton className="h-full w-full rounded-b-none" />
                </div>
              ))}
            </div>
            <Skeleton className="h-3 w-full" />
          </div>
        ) : error ? (
          <div style={{ minHeight: height }} className="flex items-center justify-center">
            <ErrorState message={errorMessage(error)} onRetry={onRetry} />
          </div>
        ) : isEmpty ? (
          <div style={{ minHeight: height }} className="flex items-center justify-center">
            <EmptyState icon={BarChart3} title={emptyTitle} description={emptyDescription} action={emptyAction} />
          </div>
        ) : showTable && table ? (
          <div className="max-h-[320px] overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-surface">
                <tr className="border-b border-border text-fg-subtle">
                  {table.columns.map((c, i) => (
                    <th key={c} scope="col" className={cn("py-1.5 pr-3 font-medium", i > 0 && "text-right")}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((r, ri) => (
                  <tr key={ri} className="border-b border-border/60 last:border-0">
                    {r.map((v, i) => (
                      <td key={i} className={cn("py-1.5 pr-3 tabular-nums", i > 0 ? "text-right" : "text-fg")}>
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={cn("transition-opacity duration-200", isFetching && "opacity-60")}>{children}</div>
        )}
      </div>
      {footer && !isLoading && !error && !isEmpty ? <div className="border-t border-border px-5 py-3">{footer}</div> : null}
    </Card>
  );
}
