"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { TransactionDetailsDialog } from "@/components/transactions/transaction-details-dialog";
import { TransactionFormDialog } from "@/components/transactions/transaction-form-dialog";
import type { Transaction, TransactionType } from "@/types/api";

export interface TransactionDefaults {
  type?: TransactionType;
  category_id?: string;
  account_id?: string;
}

interface Ctx {
  openCreate: (defaults?: TransactionDefaults) => void;
  openEdit: (tx: Transaction) => void;
  openView: (tx: Transaction) => void;
}

const TransactionDialogContext = createContext<Ctx | null>(null);

export function useTransactionDialog() {
  const ctx = useContext(TransactionDialogContext);
  if (!ctx) throw new Error("useTransactionDialog must be used inside TransactionDialogProvider");
  return ctx;
}

type State =
  | { mode: "closed" }
  | { mode: "create"; defaults?: TransactionDefaults; key: number }
  | { mode: "edit"; tx: Transaction; key: number }
  | { mode: "view"; tx: Transaction };

export function TransactionDialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ mode: "closed" });
  const close = useCallback(() => setState({ mode: "closed" }), []);
  const value = useMemo<Ctx>(
    () => ({
      openCreate: (defaults) => setState({ mode: "create", defaults, key: Date.now() }),
      openEdit: (tx) => setState({ mode: "edit", tx, key: Date.now() }),
      openView: (tx) => setState({ mode: "view", tx }),
    }),
    [],
  );
  return (
    <TransactionDialogContext.Provider value={value}>
      {children}
      {state.mode === "create" || state.mode === "edit" ? (
        <TransactionFormDialog
          key={state.key}
          open
          onClose={close}
          transaction={state.mode === "edit" ? state.tx : undefined}
          defaults={state.mode === "create" ? state.defaults : undefined}
        />
      ) : null}
      {state.mode === "view" ? (
        <TransactionDetailsDialog
          transaction={state.tx}
          onClose={close}
          onEdit={() => setState({ mode: "edit", tx: state.tx, key: Date.now() })}
        />
      ) : null}
    </TransactionDialogContext.Provider>
  );
}
