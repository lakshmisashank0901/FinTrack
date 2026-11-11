"use client";

import { Check, FlaskConical, X } from "lucide-react";
import Link from "next/link";
import { useTransactionDialog } from "@/components/providers/transaction-dialog-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useOnboarding } from "@/hooks/queries";
import { useFinanceMutation } from "@/hooks/use-finance-mutation";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

export function OnboardingCard() {
  const { data } = useOnboarding();
  const { openCreate } = useTransactionDialog();
  const dismiss = useFinanceMutation(() => api.profile.update({ preferences: { onboarding_dismissed: true } }), {
    invalidate: (qc) => Promise.all([qc.invalidateQueries({ queryKey: ["profile"] }), qc.invalidateQueries({ queryKey: ["onboarding"] })]),
  });
  const loadDemo = useFinanceMutation(() => api.demo.load(), { success: "Demo data loaded — look for the “Demo” labels" });

  if (!data || data.dismissed) return null;
  const steps = [
    { done: data.has_account, label: "Add an account with its opening balance", action: <Link href="/accounts?new=1"><Button size="sm">Add account</Button></Link> },
    { done: data.has_income, label: "Record your first income", action: <Button size="sm" disabled={!data.has_account} onClick={() => openCreate({ type: "income" })}>Add income</Button> },
    { done: data.has_expense, label: "Record your first expense", action: <Button size="sm" disabled={!data.has_account} onClick={() => openCreate({ type: "expense" })}>Add expense</Button> },
    { done: data.has_budget, label: "Create your first budget", action: <Link href="/budgets?new=1"><Button size="sm">Create budget</Button></Link> },
  ];
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;

  return (
    <Card className="mb-5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Get started with FinTrack</h2>
          <p className="mt-0.5 text-xs text-fg-subtle">
            {done} of {steps.length} done · Your dashboard fills in as you add records.
          </p>
        </div>
        <Button size="icon-sm" variant="ghost" aria-label="Dismiss getting started" loading={dismiss.isPending} onClick={() => dismiss.mutate()}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <ol className="mt-4 grid gap-2 md:grid-cols-2">
        {steps.map((s, i) => (
          <li key={s.label} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                s.done ? "bg-accent text-accent-fg" : "bg-surface-2 text-fg-muted",
              )}
              aria-hidden
            >
              {s.done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className={cn("min-w-0 flex-1 text-[13px]", s.done && "text-fg-subtle line-through")}>{s.label}</span>
            {s.done ? <span className="sr-only">Done</span> : s.action}
          </li>
        ))}
      </ol>
      {!data.demo_loaded ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-surface-2 px-3 py-2.5">
          <FlaskConical className="h-4 w-4 text-warning" aria-hidden />
          <p className="min-w-0 flex-1 text-xs text-fg-muted">
            Want to look around first? Load a clearly labelled sample dataset. You can remove it any time.
          </p>
          <Button size="sm" variant="outline" loading={loadDemo.isPending} onClick={() => loadDemo.mutate()}>
            Explore demo data
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
