"use client";

import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { usePreferences } from "@/components/providers/preferences-provider";
import { DemoBadge, Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Checkbox } from "@/components/ui/input";
import { Menu } from "@/components/ui/menu";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccounts } from "@/hooks/queries";
import { useFinanceMutation } from "@/hooks/use-finance-mutation";
import { ApiError, api, errorMessage } from "@/lib/api";
import { ACCOUNT_TYPE_META } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Account } from "@/types/api";
import { AccountFormDialog } from "./account-form-dialog";

export function AccountsView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { money } = usePreferences();
  const [showArchived, setShowArchived] = useState(false);
  const q = useAccounts(true);
  const [editing, setEditing] = useState<Account | "new" | null>(params.get("new") ? "new" : null);
  const [deleting, setDeleting] = useState<Account | null>(null);
  const [inUse, setInUse] = useState<Account | null>(null);

  const closeForm = () => {
    setEditing(null);
    if (params.get("new")) router.replace(pathname);
  };

  const archive = useFinanceMutation(
    (a: Account) => api.accounts.update(a.id, { is_archived: !a.is_archived }),
    { success: (a) => (a.is_archived ? `${a.name} archived` : `${a.name} restored`), onSuccess: () => setInUse(null) },
  );
  const remove = useFinanceMutation((a: Account) => api.accounts.remove(a.id), {
    success: "Account deleted",
    onSuccess: () => setDeleting(null),
    onError: (err, a) => {
      if (err instanceof ApiError && err.code === "account_in_use") {
        setDeleting(null);
        setInUse(a);
        return true;
      }
    },
  });

  const all = q.data?.items ?? [];
  const visible = all.filter((a) => showArchived || !a.is_archived);
  const archivedCount = all.filter((a) => a.is_archived).length;
  const totals = q.data?.totals;

  return (
    <>
      <PageHeader
        title="Accounts"
        description="Balances are calculated from each opening balance plus recorded activity."
        actions={
          <Button size="sm" variant="primary" onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" />
            Add account
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {[
          { label: "Assets", value: totals?.assets, hint: "Positive balances in cash, bank and wallet accounts" },
          { label: "Liabilities", value: totals?.liabilities, hint: "Amount owed on credit cards", negative: true },
          { label: "Net worth", value: totals?.net_worth, hint: "Assets minus liabilities" },
        ].map((t) => (
          <Card key={t.label} className="p-4">
            <p className="text-xs text-fg-subtle">{t.label}</p>
            {q.isLoading ? (
              <Skeleton className="mt-1.5 h-6 w-28" />
            ) : (
              <p className={cn("mt-0.5 text-lg font-semibold tabular-nums", t.negative && (t.value ?? 0) > 0 && "text-negative")}>
                {t.value !== undefined ? money(t.value) : "—"}
              </p>
            )}
            <p className="mt-0.5 text-[11px] text-fg-subtle">{t.hint}</p>
          </Card>
        ))}
      </div>

      {archivedCount ? (
        <div className="mb-3">
          <Checkbox
            label={`Show ${archivedCount} archived`}
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
        </div>
      ) : null}

      {q.isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : q.error ? (
        <Card>
          <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
        </Card>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={Wallet}
            title="No accounts yet"
            description="Add the places your money lives: a bank account, cash, a wallet or a credit card."
            action={
              <Button variant="primary" size="sm" onClick={() => setEditing("new")}>
                Add your first account
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((a) => {
            const meta = ACCOUNT_TYPE_META[a.type];
            const Icon = meta?.icon ?? Wallet;
            const owed = a.is_liability && a.current_balance < 0;
            return (
              <Card key={a.id} className={cn("p-4", a.is_archived && "opacity-70")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-fg-muted">
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{a.name}</p>
                      <p className="text-xs text-fg-subtle">{meta?.label}</p>
                    </div>
                  </div>
                  <Menu
                    label={`${a.name} actions`}
                    items={[
                      { label: "Edit", icon: <Pencil className="h-4 w-4" />, onSelect: () => setEditing(a) },
                      {
                        label: a.is_archived ? "Restore" : "Archive",
                        icon: a.is_archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />,
                        onSelect: () => archive.mutate(a),
                      },
                      { label: "Delete", icon: <Trash2 className="h-4 w-4" />, danger: true, onSelect: () => setDeleting(a) },
                    ]}
                    trigger={(props) => (
                      <Button size="icon-sm" variant="ghost" aria-label={`${a.name} actions`} {...props}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    )}
                  />
                </div>
                <p className="mt-4 text-xs text-fg-subtle">{owed ? "Amount owed" : "Current balance"}</p>
                <p className={cn("text-xl font-semibold tabular-nums", (owed || a.current_balance < 0) && "text-negative")}>
                  {owed ? money(-a.current_balance) : money(a.current_balance)}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-fg-subtle">
                  <span>
                    {a.is_liability ? "Opening dues" : "Opening"}{" "}
                    {money(a.is_liability ? -a.opening_balance : a.opening_balance)}
                  </span>
                  <span>·</span>
                  <span>
                    {a.transaction_count} transaction{a.transaction_count === 1 ? "" : "s"}
                  </span>
                  {a.is_archived ? <Badge>Archived</Badge> : null}
                  {a.is_demo ? <DemoBadge /> : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {editing ? <AccountFormDialog account={editing === "new" ? undefined : editing} onClose={closeForm} /> : null}

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting)}
        loading={remove.isPending}
        title="Delete account?"
        description={<p>“{deleting?.name}” will be permanently deleted.</p>}
      />
      <ConfirmDialog
        open={!!inUse}
        onClose={() => setInUse(null)}
        onConfirm={() => inUse && (inUse.is_archived ? setInUse(null) : archive.mutate(inUse))}
        loading={archive.isPending}
        tone="primary"
        confirmLabel={inUse?.is_archived ? "OK" : "Archive instead"}
        title="This account has transactions"
        description={
          <p>
            “{inUse?.name}” can&apos;t be deleted because transactions reference it — deleting it would change your history. Archive it to
            hide it from forms while keeping its records.
          </p>
        }
      />
    </>
  );
}
