"use client";

import { Database, Download, FlaskConical, RotateCcw, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useDemoStatus } from "@/hooks/queries";
import { useFinanceMutation } from "@/hooks/use-finance-mutation";
import { ApiError, api, errorMessage } from "@/lib/api";
import { downloadBlob } from "@/lib/utils";
import { backupShapeSchema } from "@/lib/validations/settings";
import type { ApiErrorDetail } from "@/types/api";

function Row({ icon: Icon, title, body, action }: { icon: typeof Download; title: string; body: string; action: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-fg-muted">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium">{title}</p>
        <p className="text-xs text-fg-subtle">{body}</p>
      </div>
      <div className="flex gap-2">{action}</div>
    </div>
  );
}

export function DataSection() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"csv" | "json" | null>(null);
  const [pending, setPending] = useState<{ name: string; data: unknown; counts: Record<string, number> } | null>(null);
  const [restoreErrors, setRestoreErrors] = useState<ApiErrorDetail[] | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [demoRemove, setDemoRemove] = useState(false);
  const demo = useDemoStatus();

  const exportFile = async (kind: "csv" | "json") => {
    setBusy(kind);
    try {
      const { blob, filename } = kind === "csv" ? await api.transactions.exportCsv({}) : await api.data.exportJson();
      downloadBlob(blob, filename);
      toast.success(kind === "csv" ? "Transactions exported" : "Backup downloaded");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setRestoreErrors(null);
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error("Backup files are limited to 20 MB.");
      const data = JSON.parse(await file.text());
      const parsed = backupShapeSchema.safeParse(data);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "This file isn't a valid FinTrack backup.");
      const b = parsed.data;
      setPending({
        name: file.name,
        data,
        counts: {
          accounts: b.accounts.length,
          transactions: b.transactions.length,
          budgets: b.budgets.length,
          "savings goals": b.savings_goals.length,
          "recurring items": b.recurring_payments.length,
        },
      });
    } catch (e) {
      toast.error(e instanceof SyntaxError ? "That file isn't valid JSON." : errorMessage(e));
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const restore = useFinanceMutation((data: unknown) => api.data.restore(data), {
    success: (r) => `Backup restored · ${r.restored.transactions ?? 0} transactions`,
    onSuccess: () => setPending(null),
    invalidate: (qc) => qc.invalidateQueries(),
    onError: (err) => {
      setPending(null);
      if (err instanceof ApiError && err.status === 422) {
        setRestoreErrors(err.details?.length ? err.details : [{ msg: err.message }]);
        toast.error("Backup failed validation — nothing was changed.");
        return true;
      }
    },
  });
  const reset = useFinanceMutation(() => api.data.reset(), {
    success: "All financial data reset",
    onSuccess: () => setResetOpen(false),
    invalidate: (qc) => qc.invalidateQueries(),
  });
  const loadDemo = useFinanceMutation(() => api.demo.load(), { success: "Demo data loaded" });
  const removeDemo = useFinanceMutation(() => api.demo.remove(), { success: "Demo data removed", onSuccess: () => setDemoRemove(false) });

  return (
    <Card id="data">
      <CardHeader title="Data management" description="Exports contain only your own records." />
      <CardBody>
        <div className="divide-y divide-border">
          <Row
            icon={Download}
            title="Export transactions"
            body="All transactions as a CSV spreadsheet (amounts in rupees)."
            action={
              <Button size="sm" loading={busy === "csv"} onClick={() => exportFile("csv")}>
                Export CSV
              </Button>
            }
          />
          <Row
            icon={Database}
            title="Download full backup"
            body="Accounts, categories, transactions, budgets, goals and recurring items as JSON."
            action={
              <Button size="sm" loading={busy === "json"} onClick={() => exportFile("json")}>
                Download JSON
              </Button>
            }
          />
          <Row
            icon={Upload}
            title="Restore from backup"
            body="Replaces your current financial data with a validated FinTrack backup."
            action={
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json,.json"
                  className="sr-only"
                  aria-label="Choose backup file"
                  onChange={(e) => onFile(e.target.files?.[0])}
                />
                <Button size="sm" loading={restore.isPending} onClick={() => fileRef.current?.click()}>
                  Choose file
                </Button>
              </>
            }
          />
          <Row
            icon={FlaskConical}
            title="Demo data"
            body={demo.data?.loaded ? "Sample records are loaded and labelled “Demo”." : "Load a labelled sample dataset to explore FinTrack."}
            action={
              demo.data?.loaded ? (
                <Button size="sm" onClick={() => setDemoRemove(true)}>
                  Remove demo data
                </Button>
              ) : (
                <Button size="sm" loading={loadDemo.isPending} disabled={!demo.isSuccess} onClick={() => loadDemo.mutate()}>
                  Load demo data
                </Button>
              )
            }
          />
          <Row
            icon={RotateCcw}
            title="Reset account data"
            body="Permanently deletes all accounts, transactions, budgets, goals and recurring items. Profile and preferences stay."
            action={
              <Button size="sm" variant="danger" onClick={() => setResetOpen(true)}>
                Reset data
              </Button>
            }
          />
        </div>
        {restoreErrors ? (
          <div role="alert" className="mt-4 rounded-lg border border-negative/30 bg-negative-soft p-3 text-xs">
            <p className="font-medium text-negative">The backup was rejected and nothing was changed:</p>
            <ul className="mt-1.5 max-h-40 list-disc space-y-0.5 overflow-auto pl-4 text-fg-muted">
              {restoreErrors.slice(0, 20).map((d, i) => (
                <li key={i}>
                  {d.loc?.length ? <span className="font-mono">{d.loc.join(".")}: </span> : null}
                  {d.msg ?? JSON.stringify(d)}
                </li>
              ))}
              {restoreErrors.length > 20 ? <li>…and {restoreErrors.length - 20} more</li> : null}
            </ul>
          </div>
        ) : null}
      </CardBody>

      <ConfirmDialog
        open={!!pending}
        onClose={() => setPending(null)}
        onConfirm={() => pending && restore.mutate(pending.data)}
        loading={restore.isPending}
        tone="danger"
        confirmLabel="Replace my data"
        title="Restore this backup?"
        description={
          pending ? (
            <div className="space-y-2">
              <p>
                <span className="font-medium text-fg">{pending.name}</span> contains{" "}
                {Object.entries(pending.counts)
                  .map(([k, v]) => `${v} ${k}`)
                  .join(", ")}
                .
              </p>
              <p>All your current financial data will be replaced. The backup is fully validated first; if anything is invalid, nothing changes.</p>
            </div>
          ) : null
        }
      />
      <ConfirmDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={() => reset.mutate()}
        loading={reset.isPending}
        confirmLabel="Reset everything"
        requireText="RESET"
        title="Reset all financial data?"
        description={<p>This permanently deletes every account, transaction, budget, savings goal and recurring item. Consider downloading a backup first.</p>}
      />
      <ConfirmDialog
        open={demoRemove}
        onClose={() => setDemoRemove(false)}
        onConfirm={() => removeDemo.mutate()}
        loading={removeDemo.isPending}
        confirmLabel="Remove"
        title="Remove demo data?"
        description={<p>Only records labelled “Demo” are deleted.</p>}
      />
    </Card>
  );
}
