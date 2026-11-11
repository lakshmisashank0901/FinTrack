"use client";

import { ArrowDownLeft, ArrowUpRight, ChevronDown, Landmark, PiggyBank } from "lucide-react";
import { useState } from "react";
import { usePreferences } from "@/components/providers/preferences-provider";
import { ErrorState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { ACCOUNT_TYPE_META } from "@/lib/constants";
import { errorMessage } from "@/lib/api";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Summary } from "@/types/api";
import { StatCard, type Delta } from "./stat-card";

export function comparedToLabel(summary: Summary, date: (d: string) => string) {
  const r = summary.range;
  return `${date(r.previous_start_date)} – ${date(r.previous_end_date)}`;
}

export function SummaryCards({
  summary,
  isLoading,
  error,
  onRetry,
}: {
  summary?: Summary;
  isLoading: boolean;
  error?: unknown;
  onRetry?: () => void;
}) {
  const { money, date } = usePreferences();
  const [showAccounts, setShowAccounts] = useState(false);

  if (error && !summary) {
    return (
      <Card>
        <ErrorState message={errorMessage(error)} onRetry={onRetry} />
      </Card>
    );
  }

  const prevLabel = summary ? comparedToLabel(summary, (d) => date(d)) : "";
  const pct = (v: number | null | undefined, upIsGood: boolean): Delta | null =>
    v === null || v === undefined ? null : { value: v, upIsGood, comparedTo: prevLabel };
  const s = summary;
  const rateDelta: Delta | null =
    s && s.savings_rate.change_points !== null
      ? { value: s.savings_rate.change_points, unit: "points", upIsGood: true, comparedTo: prevLabel }
      : null;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Total balance"
        icon={Landmark}
        isLoading={isLoading}
        value={s ? money(s.balance.net_worth) : null}
        footnote={
          s ? (
            <span>
              Net worth across active accounts
              {s.balance.period_change !== 0 ? (
                <>
                  {" · "}
                  <span className={s.balance.period_change > 0 ? "text-positive" : "text-negative"}>
                    {money(s.balance.period_change, { signed: true })}
                  </span>{" "}
                  this period
                </>
              ) : null}
            </span>
          ) : null
        }
      >
        {s && s.balance.accounts.length ? (
          <div className="mt-3 border-t border-border pt-2">
            <div className="flex justify-between text-xs text-fg-subtle">
              <span>Assets {money(s.balance.assets, { decimals: "never" })}</span>
              {s.balance.liabilities ? <span>Owed {money(s.balance.liabilities, { decimals: "never" })}</span> : null}
            </div>
            <button
              type="button"
              onClick={() => setShowAccounts((v) => !v)}
              aria-expanded={showAccounts}
              className="mt-2 flex items-center gap-1 text-xs font-medium text-fg-muted hover:text-fg"
            >
              {showAccounts ? "Hide" : "View"} {s.balance.accounts.length} account{s.balance.accounts.length === 1 ? "" : "s"}
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showAccounts && "rotate-180")} />
            </button>
            {showAccounts ? (
              <ul className="ft-fade-in mt-2 space-y-1.5">
                {s.balance.accounts.map((a) => {
                  const Icon = ACCOUNT_TYPE_META[a.type]?.icon ?? Landmark;
                  return (
                    <li key={a.id} className="flex items-center gap-2 text-xs">
                      <Icon className="h-3.5 w-3.5 text-fg-subtle" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{a.name}</span>
                      <span className={cn("tabular-nums", a.balance < 0 && "text-negative")}>
                        {a.is_liability && a.balance < 0 ? `Owed ${money(-a.balance)}` : money(a.balance)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        ) : null}
      </StatCard>

      <StatCard
        label="Income"
        icon={ArrowDownLeft}
        isLoading={isLoading}
        value={s ? money(s.income.current) : null}
        delta={s ? pct(s.income.change_percent, true) : null}
        footnote={s && !s.has_previous_data ? "No earlier data to compare" : undefined}
      />
      <StatCard
        label="Expenses"
        icon={ArrowUpRight}
        isLoading={isLoading}
        value={s ? money(s.expenses.current) : null}
        delta={s ? pct(s.expenses.change_percent, false) : null}
        footnote={
          s
            ? s.refunds.current > 0
              ? `After ${money(s.refunds.current)} in refunds`
              : !s.has_previous_data
                ? "No earlier data to compare"
                : undefined
            : undefined
        }
      />
      <StatCard
        label="Savings rate"
        icon={PiggyBank}
        isLoading={isLoading}
        value={
          s ? (
            s.savings_rate.current === null ? (
              <span className="text-fg-subtle">—</span>
            ) : (
              <span className={s.savings_rate.current < 0 ? "text-negative" : undefined}>{formatPercent(s.savings_rate.current)}</span>
            )
          ) : null
        }
        delta={rateDelta}
        footnote={
          s
            ? s.savings_rate.current === null
              ? "Needs income in this period"
              : `${money(s.net_cash_flow.current, { signed: true })} net cash flow`
            : undefined
        }
      />
    </div>
  );
}
