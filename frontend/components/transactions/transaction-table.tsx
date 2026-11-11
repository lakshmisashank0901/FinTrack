"use client";

import { Eye, Pencil, Repeat, Trash2 } from "lucide-react";
import { useState } from "react";
import { usePreferences } from "@/components/providers/preferences-provider";
import { useTransactionDialog } from "@/components/providers/transaction-dialog-provider";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TransactionAmount } from "@/components/ui/money";
import { PAYMENT_METHOD_LABEL, TRANSACTION_TYPE_LABEL } from "@/lib/constants";
import type { Transaction } from "@/types/api";
import { CategoryChip, CategoryIcon } from "./category-chip";
import { DeleteTransactionDialog } from "./delete-transaction-dialog";
import { typeTone } from "./transaction-details-dialog";

function Actions({
  tx,
  onDelete,
  compact,
}: {
  tx: Transaction;
  onDelete: (t: Transaction) => void;
  compact?: boolean;
}) {
  const { openEdit, openView } = useTransactionDialog();
  return (
    <div className="flex items-center justify-end gap-0.5">
      {compact ? null : (
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={`View ${tx.description}`}
          onClick={() => openView(tx)}
        >
          <Eye className="h-4 w-4" />
        </Button>
      )}
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={`Edit ${tx.description}`}
        onClick={() => openEdit(tx)}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={`Delete ${tx.description}`}
        onClick={() => onDelete(tx)}
        className="hover:text-negative"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function accountLabel(tx: Transaction) {
  return tx.type === "transfer"
    ? `${tx.account_name} → ${tx.to_account_name ?? "?"}`
    : tx.account_name;
}

export function TransactionTable({
  items,
  dense = false,
  className,
}: {
  items: Transaction[];
  dense?: boolean;
  className?: string;
}) {
  const { date } = usePreferences();
  const { openView } = useTransactionDialog();
  const [deleting, setDeleting] = useState<Transaction | null>(null);

  return (
    <div className={className}>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-border text-xs text-fg-subtle">
              <th scope="col" className="py-2 pr-3 font-medium">
                Description
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Category
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Date
              </th>
              {dense ? null : (
                <th scope="col" className="py-2 pr-3 font-medium">
                  Payment
                </th>
              )}
              {dense ? null : (
                <th scope="col" className="py-2 pr-3 font-medium">
                  Account
                </th>
              )}
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                Amount
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((tx) => (
              <tr
                key={tx.id}
                className="group border-b border-border/70 last:border-0 hover:bg-surface-2/60"
              >
                <td className="max-w-[16rem] py-2.5 pr-3">
                  <div className="flex items-center gap-2.5">
                    <CategoryIcon
                      category={
                        tx.type === "transfer"
                          ? { color: "#85847e", icon: "repeat" }
                          : tx.category
                      }
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-fg">
                        {tx.description}
                      </p>
                      <div className="mt-0.5 flex items-center gap-1">
                        <Badge tone={typeTone(tx.type)}>
                          {TRANSACTION_TYPE_LABEL[tx.type]}
                        </Badge>
                        {tx.recurring_payment_id ? (
                          <Repeat
                            className="h-3 w-3 text-fg-subtle"
                            aria-label="From a recurring payment"
                          />
                        ) : null}
                        {tx.is_demo ? <DemoBadge /> : null}
                        {dense ? (
                          <span className="ml-1 truncate text-[11px] text-fg-subtle">
                            {[
                              tx.payment_method
                                ? PAYMENT_METHOD_LABEL[tx.payment_method]
                                : null,
                              accountLabel(tx),
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="py-2.5 pr-3">
                  {tx.type === "transfer" ? (
                    <span className="text-fg-subtle">—</span>
                  ) : (
                    <CategoryChip category={tx.category} />
                  )}
                </td>
                <td className="py-2.5 pr-3 whitespace-nowrap text-fg-muted tabular-nums">
                  {date(tx.occurred_on)}
                </td>
                {dense ? null : (
                  <td className="py-2.5 pr-3 whitespace-nowrap text-fg-muted">
                    {tx.payment_method
                      ? PAYMENT_METHOD_LABEL[tx.payment_method]
                      : "—"}
                  </td>
                )}
                {dense ? null : (
                  <td className="max-w-[12rem] truncate py-2.5 pr-3 text-fg-muted">
                    {accountLabel(tx)}
                  </td>
                )}
                <td className="py-2.5 pr-3 text-right whitespace-nowrap">
                  <TransactionAmount type={tx.type} amount={tx.amount} />
                </td>
                <td className="py-2.5 text-right">
                  <Actions tx={tx} onDelete={setDeleting} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile list */}
      <ul className="divide-y divide-border md:hidden">
        {items.map((tx) => (
          <li key={tx.id} className="flex items-center gap-3 py-3">
            <button
              type="button"
              onClick={() => openView(tx)}
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
            >
              <CategoryIcon
                category={
                  tx.type === "transfer"
                    ? { color: "#85847e", icon: "repeat" }
                    : tx.category
                }
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{tx.description}</p>
                <p className="truncate text-xs text-fg-subtle">
                  {date(tx.occurred_on)} ·{" "}
                  {tx.type === "transfer"
                    ? accountLabel(tx)
                    : (tx.category?.name ?? "Uncategorised")}
                  {tx.payment_method
                    ? ` · ${PAYMENT_METHOD_LABEL[tx.payment_method]}`
                    : ""}
                </p>
                <div className="mt-1 flex gap-1">
                  <Badge tone={typeTone(tx.type)}>
                    {TRANSACTION_TYPE_LABEL[tx.type]}
                  </Badge>
                  {tx.is_demo ? <DemoBadge /> : null}
                </div>
              </div>
              <TransactionAmount
                type={tx.type}
                amount={tx.amount}
                className="text-sm"
              />
            </button>
            <Actions tx={tx} onDelete={setDeleting} compact />
          </li>
        ))}
      </ul>
      <DeleteTransactionDialog
        transaction={deleting}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
