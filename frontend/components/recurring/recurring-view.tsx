"use client";

import { CalendarClock, CheckCheck, MoreHorizontal, Pause, Pencil, Play, Plus, SkipForward, Trash2 } from "lucide-react";
import { useState } from "react";
import { CategoryIcon } from "@/components/transactions/category-chip";
import { usePreferences } from "@/components/providers/preferences-provider";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Menu } from "@/components/ui/menu";
import { PageHeader } from "@/components/ui/page-header";
import { SkeletonRows } from "@/components/ui/skeleton";
import { useRecurring } from "@/hooks/queries";
import { useFinanceMutation } from "@/hooks/use-finance-mutation";
import { api, errorMessage } from "@/lib/api";
import { FREQUENCY_LABEL, PAYMENT_METHOD_LABEL } from "@/lib/constants";
import { formatDate, relativeDays } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { RecurringPayment } from "@/types/api";
import { RecordPaymentDialog, RecurringFormDialog } from "./recurring-dialogs";

type Modal =
  | { kind: "form"; payment?: RecurringPayment }
  | { kind: "record"; payment: RecurringPayment }
  | { kind: "delete"; payment: RecurringPayment }
  | null;

export function RecurringView() {
  const { money, date } = usePreferences();
  const q = useRecurring();
  const [modal, setModal] = useState<Modal>(null);
  const close = () => setModal(null);

  const toggle = useFinanceMutation((p: RecurringPayment) => api.recurring.update(p.id, { is_active: !p.is_active }), {
    success: (p) => (p.is_active ? `${p.name} resumed` : `${p.name} paused`),
  });
  const skip = useFinanceMutation((p: RecurringPayment) => api.recurring.skip(p.id), {
    success: (p) => `Skipped · next due ${date(p.next_due_date)}`,
  });
  const remove = useFinanceMutation((p: RecurringPayment) => api.recurring.remove(p.id), {
    success: "Recurring item deleted",
    onSuccess: close,
  });

  const items = q.data?.items ?? [];
  const active = items.filter((i) => i.is_active);
  const inactive = items.filter((i) => !i.is_active);
  const summary = q.data?.summary;
  const byId = new Map(items.map((i) => [i.id, i]));

  const row = (p: RecurringPayment) => (
    <li key={p.id} className={cn("flex flex-wrap items-center gap-3 py-3", !p.is_active && "opacity-60")}>
      <CategoryIcon category={p.category ?? { color: "#85847e", icon: "repeat" }} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="truncate text-sm font-medium">{p.name}</p>
          <Badge>{FREQUENCY_LABEL[p.frequency]}</Badge>
          {p.type === "income" ? <Badge tone="positive">Income</Badge> : null}
          {p.is_demo ? <DemoBadge /> : null}
        </div>
        <p className="truncate text-xs text-fg-subtle">
          {p.account_name} · {PAYMENT_METHOD_LABEL[p.payment_method]}
          {p.category ? ` · ${p.category.name}` : ""}
        </p>
      </div>
      <div className="text-right">
        <p className={cn("text-sm font-medium tabular-nums", p.type === "income" ? "text-positive" : "text-fg")}>{money(p.amount)}</p>
        <p className={cn("text-xs", p.is_active && p.is_overdue ? "font-medium text-negative" : "text-fg-subtle")}>
          {p.is_active ? `${relativeDays(p.days_until_due)} · ${date(p.next_due_date)}` : "Paused"}
        </p>
      </div>
      <div className="flex items-center gap-1">
        {p.is_active ? (
          <Button size="sm" onClick={() => setModal({ kind: "record", payment: p })}>
            <CheckCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Mark {p.type === "income" ? "received" : "paid"}</span>
          </Button>
        ) : null}
        <Menu
          label={`${p.name} actions`}
          items={[
            ...(p.is_active
              ? [{ label: "Skip this occurrence", icon: <SkipForward className="h-4 w-4" />, onSelect: () => skip.mutate(p) }]
              : []),
            { label: "Edit", icon: <Pencil className="h-4 w-4" />, onSelect: () => setModal({ kind: "form", payment: p }) },
            {
              label: p.is_active ? "Pause" : "Resume",
              icon: p.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />,
              onSelect: () => toggle.mutate(p),
            },
            { label: "Delete", icon: <Trash2 className="h-4 w-4" />, danger: true, onSelect: () => setModal({ kind: "delete", payment: p }) },
          ]}
          trigger={(t) => (
            <Button size="icon-sm" variant="ghost" aria-label={`${p.name} actions`} {...t}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          )}
        />
      </div>
    </li>
  );

  return (
    <>
      <PageHeader
        title="Recurring payments"
        description="Scheduled bills, subscriptions and income. These are reminders — mark them paid to record a real transaction."
        actions={
          <Button size="sm" variant="primary" onClick={() => setModal({ kind: "form" })}>
            <Plus className="h-4 w-4" />
            Add recurring
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-fg-subtle">Est. monthly outgoings</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums">{summary ? money(summary.monthly_expense_estimate) : "—"}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-fg-subtle">Est. monthly income</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums">{summary ? money(summary.monthly_income_estimate) : "—"}</p>
        </Card>
        <Card className="col-span-2 p-4 md:col-span-1">
          <p className="text-xs text-fg-subtle">Active schedules</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums">{summary ? summary.active_count : "—"}</p>
        </Card>
      </div>

      {q.isLoading ? (
        <Card className="p-5">
          <SkeletonRows rows={5} />
        </Card>
      ) : q.error ? (
        <Card>
          <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon={CalendarClock}
            title="No recurring payments"
            description="Add rent, subscriptions, bills, insurance or regular income to see what's coming up."
            action={
              <Button size="sm" variant="primary" onClick={() => setModal({ kind: "form" })}>
                Add recurring item
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Card>
              <CardHeader title="Active" description="Scheduled — not yet recorded as transactions." />
              <CardBody>
                {active.length ? <ul className="divide-y divide-border">{active.map(row)}</ul> : <p className="text-[13px] text-fg-subtle">Nothing active.</p>}
              </CardBody>
            </Card>
            {inactive.length ? (
              <Card>
                <CardHeader title="Paused" />
                <CardBody>
                  <ul className="divide-y divide-border">{inactive.map(row)}</ul>
                </CardBody>
              </Card>
            ) : null}
          </div>
          <Card className="h-fit">
            <CardHeader title="Upcoming" description="Next 30 days, plus anything overdue" />
            <CardBody>
              {summary?.upcoming.length ? (
                <ol className="space-y-3">
                  {summary.upcoming.map((u) => {
                    const p = byId.get(u.payment_id);
                    const overdue = u.days_until_due < 0;
                    return (
                      <li key={`${u.payment_id}-${u.due_date}`} className="flex items-center gap-3">
                        <div
                          className={cn(
                            "flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg border text-center leading-none",
                            overdue ? "border-negative/40 bg-negative-soft text-negative" : "border-border bg-surface-2",
                          )}
                        >
                          <span className="text-[10px] uppercase">{formatDate(u.due_date).split(" ")[1]}</span>
                          <span className="text-sm font-semibold">{u.due_date.slice(8, 10)}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium">{u.name}</p>
                          <p className={cn("text-xs", overdue ? "text-negative" : "text-fg-subtle")}>{relativeDays(u.days_until_due)}</p>
                        </div>
                        <span className={cn("text-[13px] font-medium tabular-nums", u.type === "income" && "text-positive")}>
                          {u.type === "income" ? "+" : ""}
                          {money(u.amount)}
                        </span>
                        {p && u.due_date === p.next_due_date ? (
                          <Button size="icon-sm" variant="ghost" aria-label={`Mark ${u.name} as paid`} onClick={() => setModal({ kind: "record", payment: p })}>
                            <CheckCheck className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="text-[13px] text-fg-subtle">Nothing due in the next 30 days.</p>
              )}
            </CardBody>
          </Card>
        </div>
      )}

      {modal?.kind === "form" ? <RecurringFormDialog payment={modal.payment} onClose={close} /> : null}
      {modal?.kind === "record" ? <RecordPaymentDialog payment={modal.payment} onClose={close} /> : null}
      <ConfirmDialog
        open={modal?.kind === "delete"}
        onClose={close}
        onConfirm={() => modal?.kind === "delete" && remove.mutate(modal.payment)}
        loading={remove.isPending}
        title="Delete recurring item?"
        description={<p>The schedule is removed. Transactions already recorded from it are kept.</p>}
      />
    </>
  );
}
