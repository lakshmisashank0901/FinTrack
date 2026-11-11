"use client";

import { usePreferences } from "@/components/providers/preferences-provider";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TransactionAmount } from "@/components/ui/money";
import { PAYMENT_METHOD_LABEL, TRANSACTION_TYPE_LABEL } from "@/lib/constants";
import type { Transaction } from "@/types/api";
import { CategoryChip } from "./category-chip";

export function TransactionDetailsDialog({
  transaction: tx,
  onClose,
  onEdit,
}: {
  transaction: Transaction;
  onClose: () => void;
  onEdit: () => void;
}) {
  const { date } = usePreferences();
  const rows: [string, React.ReactNode][] = [
    ["Type", <Badge key="t" tone={typeTone(tx.type)}>{TRANSACTION_TYPE_LABEL[tx.type]}</Badge>],
    ["Date", `${date(tx.occurred_on)}${tx.occurred_time ? ` · ${tx.occurred_time.slice(0, 5)}` : ""}`],
    [tx.type === "transfer" ? "From" : "Account", tx.account_name],
  ];
  if (tx.type === "transfer") rows.push(["To", tx.to_account_name ?? "—"]);
  else rows.push(["Category", <CategoryChip key="c" category={tx.category} />]);
  rows.push(["Payment method", tx.payment_method ? PAYMENT_METHOD_LABEL[tx.payment_method] : "—"]);
  if (tx.tags.length) rows.push(["Tags", tx.tags.map((t) => <Badge key={t} className="mr-1">{t}</Badge>)]);
  if (tx.notes) rows.push(["Notes", <span key="n" className="whitespace-pre-wrap">{tx.notes}</span>]);
  if (tx.recurring_payment_id) rows.push(["Source", "Recorded from a recurring payment"]);

  return (
    <Dialog
      open
      onClose={onClose}
      title="Transaction details"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button variant="secondary" onClick={onEdit}>
            Edit
          </Button>
        </>
      }
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{tx.description}</p>
          {tx.is_demo ? (
            <div className="mt-1">
              <DemoBadge />
            </div>
          ) : null}
        </div>
        <TransactionAmount type={tx.type} amount={tx.amount} className="text-lg" />
      </div>
      <dl className="divide-y divide-border text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 py-2">
            <dt className="text-fg-subtle">{k}</dt>
            <dd className="text-right text-fg">{v}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}

export function typeTone(t: Transaction["type"]) {
  return t === "income" ? "positive" : t === "expense" ? "negative" : t === "refund" ? "info" : "neutral";
}
