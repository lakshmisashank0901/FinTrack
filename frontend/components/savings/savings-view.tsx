"use client";

import { Archive, ArchiveRestore, CalendarDays, History, MoreHorizontal, Pencil, PiggyBank, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { usePreferences } from "@/components/providers/preferences-provider";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Checkbox } from "@/components/ui/input";
import { Menu } from "@/components/ui/menu";
import { PageHeader } from "@/components/ui/page-header";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useSavingsGoals } from "@/hooks/queries";
import { useFinanceMutation } from "@/hooks/use-finance-mutation";
import { api, errorMessage } from "@/lib/api";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SavingsGoal } from "@/types/api";
import { ContributionDialog, ContributionHistoryDialog, GoalFormDialog } from "./goal-dialogs";

type Modal =
  | { kind: "form"; goal?: SavingsGoal }
  | { kind: "contribute"; goal: SavingsGoal; mode: "contribution" | "withdrawal" }
  | { kind: "history"; goal: SavingsGoal }
  | { kind: "delete"; goal: SavingsGoal }
  | null;

export function SavingsView() {
  const { money, date } = usePreferences();
  const [showArchived, setShowArchived] = useState(false);
  const q = useSavingsGoals(true);
  const [modal, setModal] = useState<Modal>(null);
  const close = () => setModal(null);
  const inv = { invalidate: (qc: import("@tanstack/react-query").QueryClient) => qc.invalidateQueries({ queryKey: ["savings"] }) };
  const archive = useFinanceMutation((g: SavingsGoal) => api.savings.update(g.id, { is_archived: !g.is_archived }), {
    ...inv,
    success: (g) => (g.is_archived ? "Goal archived" : "Goal restored"),
  });
  const remove = useFinanceMutation((g: SavingsGoal) => api.savings.remove(g.id), { ...inv, success: "Goal deleted", onSuccess: close });

  const all = q.data?.items ?? [];
  const visible = all.filter((g) => showArchived || !g.is_archived);
  const archivedCount = all.filter((g) => g.is_archived).length;
  const active = all.filter((g) => !g.is_archived);
  const totals = q.data?.totals;

  return (
    <>
      <PageHeader
        title="Savings goals"
        description="Earmark money for what matters. Goals track progress — they don't move money or count as spending."
        actions={
          <Button size="sm" variant="primary" onClick={() => setModal({ kind: "form" })}>
            <Plus className="h-4 w-4" />
            New goal
          </Button>
        }
      />

      {totals && active.length ? (
        <Card className="mb-4 flex flex-wrap items-center gap-x-8 gap-y-2 p-4">
          <div>
            <p className="text-xs text-fg-subtle">Saved across goals</p>
            <p className="text-lg font-semibold tabular-nums">{money(totals.saved)}</p>
          </div>
          <div>
            <p className="text-xs text-fg-subtle">Combined target</p>
            <p className="text-lg font-semibold tabular-nums">{money(totals.target)}</p>
          </div>
          <div className="min-w-48 flex-1">
            <Progress
              value={totals.target ? (totals.saved / totals.target) * 100 : 0}
              label="Overall savings progress"
            />
          </div>
        </Card>
      ) : null}

      {archivedCount ? (
        <div className="mb-3">
          <Checkbox label={`Show ${archivedCount} archived`} checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
        </div>
      ) : null}

      {q.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      ) : q.error ? (
        <Card>
          <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
        </Card>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={PiggyBank}
            title="No savings goals yet"
            description="Create a goal like an emergency fund, a new laptop or a trip, then record contributions as you save."
            action={
              <Button size="sm" variant="primary" onClick={() => setModal({ kind: "form" })}>
                Create a goal
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((g) => {
            const complete = g.remaining_amount <= 0;
            return (
              <Card key={g.id} className={cn("flex flex-col p-5", g.is_archived && "opacity-70")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: g.color }} aria-hidden />
                      <h2 className="truncate text-sm font-semibold">{g.name}</h2>
                    </div>
                    {g.description ? <p className="mt-1 line-clamp-2 text-xs text-fg-subtle">{g.description}</p> : null}
                  </div>
                  <Menu
                    label={`${g.name} actions`}
                    items={[
                      { label: "Edit", icon: <Pencil className="h-4 w-4" />, onSelect: () => setModal({ kind: "form", goal: g }) },
                      { label: "History", icon: <History className="h-4 w-4" />, onSelect: () => setModal({ kind: "history", goal: g }) },
                      {
                        label: g.is_archived ? "Restore" : "Archive",
                        icon: g.is_archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />,
                        onSelect: () => archive.mutate(g),
                      },
                      { label: "Delete", icon: <Trash2 className="h-4 w-4" />, danger: true, onSelect: () => setModal({ kind: "delete", goal: g }) },
                    ]}
                    trigger={(p) => (
                      <Button size="icon-sm" variant="ghost" aria-label={`${g.name} actions`} {...p}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    )}
                  />
                </div>

                <div className="mt-4 flex items-end justify-between gap-2">
                  <div>
                    <p className="text-xl font-semibold tabular-nums">{money(g.saved_amount)}</p>
                    <p className="text-xs text-fg-subtle">of {money(g.target_amount)}</p>
                  </div>
                  <span className="text-sm font-medium tabular-nums">{formatPercent(g.progress_percent, 0)}</span>
                </div>
                <Progress className="mt-2" value={g.progress_percent} color={g.color} label={`${g.name} progress`} />
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-subtle">
                  {complete ? <Badge tone="positive">Goal reached</Badge> : <span>{money(g.remaining_amount)} to go</span>}
                  {g.target_date ? (
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" aria-hidden />
                      {date(g.target_date)}
                    </span>
                  ) : null}
                  {g.monthly_needed ? <span>{money(g.monthly_needed, { decimals: "never" })}/month needed</span> : null}
                  {g.is_archived ? <Badge>Archived</Badge> : null}
                  {g.is_demo ? <DemoBadge /> : null}
                </div>

                <div className="mt-4 flex-1 border-t border-border pt-3">
                  <p className="mb-1.5 text-[11px] font-medium tracking-wide text-fg-subtle uppercase">Recent</p>
                  {g.recent_contributions.length ? (
                    <ul className="space-y-1">
                      {g.recent_contributions.slice(0, 3).map((c) => (
                        <li key={c.id} className="flex justify-between text-xs">
                          <span className="truncate text-fg-muted">
                            {date(c.contributed_on)}
                            {c.note ? ` · ${c.note}` : ""}
                          </span>
                          <span className={cn("tabular-nums", c.kind === "contribution" ? "text-positive" : "text-negative")}>
                            {c.kind === "contribution" ? "+" : "-"}
                            {money(c.amount)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-fg-subtle">No contributions yet.</p>
                  )}
                </div>

                {g.is_archived ? null : (
                  <div className="mt-4 flex gap-2">
                    <Button size="sm" variant="primary" className="flex-1" onClick={() => setModal({ kind: "contribute", goal: g, mode: "contribution" })}>
                      Add money
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
                      disabled={g.saved_amount <= 0}
                      onClick={() => setModal({ kind: "contribute", goal: g, mode: "withdrawal" })}
                    >
                      Withdraw
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {modal?.kind === "form" ? <GoalFormDialog goal={modal.goal} onClose={close} /> : null}
      {modal?.kind === "contribute" ? <ContributionDialog goal={modal.goal} kind={modal.mode} onClose={close} /> : null}
      {modal?.kind === "history" ? <ContributionHistoryDialog goal={modal.goal} onClose={close} /> : null}
      <ConfirmDialog
        open={modal?.kind === "delete"}
        onClose={close}
        onConfirm={() => modal?.kind === "delete" && remove.mutate(modal.goal)}
        loading={remove.isPending}
        title="Delete goal?"
        description={<p>“{modal?.kind === "delete" ? modal.goal.name : ""}” and its contribution history will be deleted.</p>}
      />
    </>
  );
}
