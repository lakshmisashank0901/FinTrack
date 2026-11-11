"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Wallet } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { usePreferences } from "@/components/providers/preferences-provider";
import type { TransactionDefaults } from "@/components/providers/transaction-dialog-provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, MoneyInput, Select, Textarea } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented";
import { useFinanceMutation } from "@/hooks/use-finance-mutation";
import { useAccounts, useCategories } from "@/hooks/queries";
import { ApiError, api, errorMessage } from "@/lib/api";
import { CATEGORY_COLORS, PAYMENT_METHODS, TRANSACTION_TYPES } from "@/lib/constants";
import { paiseToRupeeInput } from "@/lib/format";
import { newRequestId } from "@/lib/utils";
import {
  toTransactionInput,
  transactionFormSchema,
  type TransactionFormValues,
} from "@/lib/validations/transaction";
import type { Transaction, TransactionType } from "@/types/api";

const kindFor = (t: TransactionType) => (t === "income" ? "income" : "expense");

export function TransactionFormDialog({
  open,
  onClose,
  transaction,
  defaults,
}: {
  open: boolean;
  onClose: () => void;
  transaction?: Transaction;
  defaults?: TransactionDefaults;
}) {
  const { today } = usePreferences();
  const accounts = useAccounts(true);
  const categories = useCategories();
  // One idempotency key per opened form: a double-submit or retry can't create duplicates.
  const [requestId] = useState(newRequestId);
  const editing = !!transaction;

  const activeAccounts = useMemo(() => {
    // Archived accounts are hidden, except the ones an edited transaction already uses.
    return (accounts.data?.items ?? []).filter(
      (a) => !a.is_archived || a.id === transaction?.account_id || a.id === transaction?.to_account_id,
    );
  }, [accounts.data, transaction]);

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: transaction
      ? {
          type: transaction.type,
          amount: paiseToRupeeInput(transaction.amount),
          description: transaction.description,
          category_id: transaction.category_id ?? "",
          account_id: transaction.account_id,
          to_account_id: transaction.to_account_id ?? "",
          occurred_on: transaction.occurred_on,
          occurred_time: transaction.occurred_time?.slice(0, 5) ?? "",
          payment_method: transaction.payment_method ?? "",
          notes: transaction.notes ?? "",
          tags: transaction.tags.join(", "),
        }
      : {
          type: defaults?.type ?? "expense",
          amount: "",
          description: "",
          category_id: defaults?.category_id ?? "",
          account_id: defaults?.account_id ?? "",
          to_account_id: "",
          occurred_on: today(),
          occurred_time: "",
          payment_method: "upi",
          notes: "",
          tags: "",
        },
  });
  const { register, handleSubmit, setValue, formState, setError, control } = form;
  const errors = formState.errors;
  const type = useWatch({ control, name: "type" });
  const accountId = useWatch({ control, name: "account_id" });

  // Pre-select the first account once accounts load.
  useEffect(() => {
    if (!accountId && !editing && activeAccounts.length > 0) setValue("account_id", activeAccounts[0].id);
  }, [accountId, editing, activeAccounts, setValue]);

  const kind = kindFor(type);
  const categoryOptions = (categories.data ?? []).filter((c) => c.kind === kind && !c.is_archived);

  const save = useFinanceMutation(
    (values: TransactionFormValues) => {
      const input = toTransactionInput(values);
      return transaction
        ? api.transactions.update(transaction.id, input)
        : api.transactions.create({ ...input, client_request_id: requestId });
    },
    {
      success: editing ? "Transaction updated" : "Transaction added",
      onSuccess: () => onClose(),
      onError: (err) => {
        if (err instanceof ApiError && err.status === 422 && err.details?.length) {
          for (const d of err.details) {
            const field = d.loc?.[d.loc.length - 1];
            if (typeof field === "string" && field in form.getValues()) {
              setError(field as keyof TransactionFormValues, { message: d.msg ?? "Invalid value" });
            }
          }
        }
        return false;
      },
    },
  );

  const [newCategory, setNewCategory] = useState<string | null>(null);
  const createCategory = useFinanceMutation(
    (name: string) =>
      api.categories.create({
        name,
        kind,
        color: CATEGORY_COLORS[(categories.data?.length ?? 0) % CATEGORY_COLORS.length],
        icon: "circle",
      }),
    {
      success: (c) => `Category “${c.name}” created`,
      onSuccess: (c) => {
        setValue("category_id", c.id);
        setNewCategory(null);
      },
      invalidate: (qc) => qc.invalidateQueries({ queryKey: ["categories"] }),
    },
  );

  const onTypeChange = (t: TransactionType) => {
    setValue("type", t, { shouldValidate: formState.isSubmitted });
    const current = form.getValues("category_id");
    const cat = categories.data?.find((c) => c.id === current);
    if (t === "transfer" || (cat && cat.kind !== kindFor(t))) setValue("category_id", "");
    if (t === "transfer") setValue("payment_method", "bank_transfer");
    else setValue("to_account_id", "");
  };

  const noAccounts = accounts.isSuccess && activeAccounts.length === 0;
  const submitting = save.isPending;

  return (
    <Dialog
      open={open}
      onClose={() => !submitting && onClose()}
      title={editing ? "Edit transaction" : "Add transaction"}
      description={editing ? undefined : "Record money in, money out, a refund or a move between accounts."}
      footer={
        noAccounts ? undefined : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="transaction-form" loading={submitting}>
              {editing ? "Save changes" : "Add transaction"}
            </Button>
          </>
        )
      }
    >
      {noAccounts ? (
        <EmptyState
          icon={Wallet}
          title="Add an account first"
          description="Transactions belong to an account such as cash, a bank account or a credit card."
          action={
            <Link href="/accounts?new=1" onClick={onClose}>
              <Button variant="primary">Add an account</Button>
            </Link>
          }
        />
      ) : (
        <form
          id="transaction-form"
          noValidate
          onSubmit={handleSubmit((v) => {
            if (!submitting) save.mutate(v);
          })}
          className="space-y-4"
        >
          <SegmentedControl
            label="Transaction type"
            size="md"
            value={type}
            onChange={onTypeChange}
            options={TRANSACTION_TYPES}
            className="w-full [&>button]:flex-1"
          />
          {type === "refund" ? (
            <p className="text-xs text-fg-subtle">Refunds add money back to the account and reduce spending in their category.</p>
          ) : type === "transfer" ? (
            <p className="text-xs text-fg-subtle">Transfers move money between your accounts and are not counted as income or expenses.</p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Amount" error={errors.amount?.message}>
              <MoneyInput {...register("amount")} autoFocus={!editing} />
            </Field>
            <Field label="Description" error={errors.description?.message}>
              <Input {...register("description")} placeholder={type === "income" ? "October salary" : "Lunch with team"} maxLength={140} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={type === "transfer" ? "From account" : "Account"} error={errors.account_id?.message}>
              <Select {...register("account_id")}>
                <option value="" disabled>
                  Choose account
                </option>
                {activeAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>
            {type === "transfer" ? (
              <Field label="To account" error={errors.to_account_id?.message}>
                <Select {...register("to_account_id")}>
                  <option value="">Choose account</option>
                  {activeAccounts
                    .filter((a) => a.id !== accountId)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                </Select>
              </Field>
            ) : (
              <Field label="Category" error={errors.category_id?.message} optional>
                {newCategory === null ? (
                  <div className="flex gap-1.5">
                    <Select {...register("category_id")} className="flex-1">
                      <option value="">Uncategorised</option>
                      {categoryOptions.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                    <Button size="icon" aria-label="New category" title="New category" onClick={() => setNewCategory("")}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-1.5">
                    <Input
                      autoFocus
                      value={newCategory}
                      maxLength={40}
                      placeholder={`New ${kind} category`}
                      onChange={(e) => setNewCategory(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (newCategory.trim()) createCategory.mutate(newCategory.trim());
                        }
                        if (e.key === "Escape") {
                          e.stopPropagation();
                          setNewCategory(null);
                        }
                      }}
                    />
                    <Button
                      variant="secondary"
                      loading={createCategory.isPending}
                      disabled={!newCategory.trim()}
                      onClick={() => createCategory.mutate(newCategory.trim())}
                    >
                      Add
                    </Button>
                    <Button variant="ghost" onClick={() => setNewCategory(null)}>
                      Cancel
                    </Button>
                  </div>
                )}
              </Field>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Date" error={errors.occurred_on?.message}>
              <Input type="date" {...register("occurred_on")} />
            </Field>
            <Field label="Time" error={errors.occurred_time?.message} optional>
              <Input type="time" {...register("occurred_time")} />
            </Field>
            <Field label="Payment method" error={errors.payment_method?.message}>
              <Select {...register("payment_method")}>
                {type === "transfer" ? <option value="">Not applicable</option> : null}
                {PAYMENT_METHODS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Tags" error={errors.tags?.message} hint="Separate with commas, e.g. work, trip" optional>
            <Input {...register("tags")} placeholder="work, trip" />
          </Field>
          <Field label="Notes" error={errors.notes?.message} optional>
            <Textarea {...register("notes")} rows={2} maxLength={1000} />
          </Field>
          {formState.errors.root ? <p className="text-xs text-negative">{formState.errors.root.message}</p> : null}
        </form>
      )}
      {accounts.isError ? <p className="text-xs text-negative">{errorMessage(accounts.error)}</p> : null}
    </Dialog>
  );
}
