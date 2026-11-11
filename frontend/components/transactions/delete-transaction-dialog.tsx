"use client";

import { usePreferences } from "@/components/providers/preferences-provider";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useFinanceMutation } from "@/hooks/use-finance-mutation";
import { api } from "@/lib/api";
import type { Transaction } from "@/types/api";

export function DeleteTransactionDialog({ transaction, onClose }: { transaction: Transaction | null; onClose: () => void }) {
  const { money, date } = usePreferences();
  const remove = useFinanceMutation((id: string) => api.transactions.remove(id), {
    success: "Transaction deleted",
    onSuccess: onClose,
  });
  return (
    <ConfirmDialog
      open={!!transaction}
      onClose={onClose}
      loading={remove.isPending}
      onConfirm={() => transaction && remove.mutate(transaction.id)}
      title="Delete transaction?"
      description={
        transaction ? (
          <p>
            “{transaction.description}” ({money(transaction.amount)} on {date(transaction.occurred_on)}) will be removed.
            Account balances, budgets and reports update immediately. This can&apos;t be undone.
          </p>
        ) : null
      }
    />
  );
}
