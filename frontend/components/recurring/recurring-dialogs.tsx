"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { usePreferences } from "@/components/providers/preferences-provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, MoneyInput, Select, Textarea } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented";
import { useAccounts, useCategories } from "@/hooks/queries";
import { useFinanceMutation } from "@/hooks/use-finance-mutation";
import { ApiError, api } from "@/lib/api";
import { FREQUENCIES, FREQUENCY_LABEL, PAYMENT_METHODS } from "@/lib/constants";
import { paiseToRupeeInput, rupeesToPaise } from "@/lib/format";
import { positiveAmount } from "@/lib/validations/common";
import { recurringFormSchema, type RecurringFormValues } from "@/lib/validations/recurring";
import type { RecurringPayment } from "@/types/api";

export function RecurringFormDialog({ payment, onClose }: { payment?: RecurringPayment; onClose: () => void }) {
  const { today } = usePreferences();
  const accounts = useAccounts(true);
  const categories = useCategories();
  const form = useForm<RecurringFormValues>({
    resolver: zodResolver(recurringFormSchema),
    defaultValues: payment
      ? {
          name: payment.name,
          type: payment.type,
          amount: paiseToRupeeInput(payment.amount),
          category_id: payment.category_id ?? "",
          account_id: payment.account_id,
          payment_method: payment.payment_method,
          frequency: payment.frequency,
          next_due_date: payment.next_due_date,
          is_active: payment.is_active,
          notes: payment.notes ?? "",
        }
      : {
          name: "",
          type: "expense",
          amount: "",
          category_id: "",
          account_id: "",
          payment_method: "upi",
          frequency: "monthly",
          next_due_date: today(),
          is_active: true,
          notes: "",
        },
  });
  const type = useWatch({ control: form.control, name: "type" });
  const errors = form.formState.errors;
  const accountOptions = (accounts.data?.items ?? []).filter((a) => !a.is_archived || a.id === payment?.account_id);
  const categoryOptions = (categories.data ?? []).filter((c) => c.kind === type && !c.is_archived);

  const save = useFinanceMutation(
    (v: RecurringFormValues) => {
      const body = {
        name: v.name.trim(),
        type: v.type,
        amount: rupeesToPaise(v.amount) ?? 0,
        category_id: v.category_id || null,
        account_id: v.account_id,
        payment_method: v.payment_method,
        frequency: v.frequency,
        next_due_date: v.next_due_date,
        is_active: v.is_active,
        notes: v.notes.trim() || null,
      };
      return payment ? api.recurring.update(payment.id, body) : api.recurring.create(body);
    },
    { success: payment ? "Recurring payment updated" : "Recurring payment added", onSuccess: onClose },
  );

  const noAccounts = accounts.isSuccess && accountOptions.length === 0;

  return (
    <Dialog
      open
      onClose={onClose}
      title={payment ? "Edit recurring item" : "New recurring item"}
      description="A schedule reminder. Nothing is paid automatically."
      footer={
        noAccounts ? undefined : (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="recurring-form" loading={save.isPending}>
              {payment ? "Save" : "Add"}
            </Button>
          </>
        )
      }
    >
      {noAccounts ? (
        <p className="text-sm text-fg-muted">
          Add an account first.{" "}
          <Link href="/accounts?new=1" className="font-medium text-fg underline">
            Add an account
          </Link>
        </p>
      ) : (
        <form id="recurring-form" noValidate className="space-y-4" onSubmit={form.handleSubmit((v) => save.mutate(v))}>
          <SegmentedControl
            label="Type"
            size="md"
            value={type}
            onChange={(v) => {
              form.setValue("type", v);
              form.setValue("category_id", "");
            }}
            options={[
              { value: "expense", label: "Expense" },
              { value: "income", label: "Income" },
            ]}
            className="w-full [&>button]:flex-1"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" error={errors.name?.message}>
              <Input {...form.register("name")} placeholder="Rent, Netflix, Salary…" maxLength={80} />
            </Field>
            <Field label="Amount" error={errors.amount?.message}>
              <MoneyInput {...form.register("amount")} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Frequency" error={errors.frequency?.message}>
              <Select {...form.register("frequency")}>
                {FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Next due date" error={errors.next_due_date?.message}>
              <Input type="date" {...form.register("next_due_date")} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Account" error={errors.account_id?.message}>
              <Select {...form.register("account_id")}>
                <option value="">Choose account</option>
                {accountOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Category" optional>
              <Select {...form.register("category_id")}>
                <option value="">Uncategorised</option>
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Payment method" error={errors.payment_method?.message}>
              <Select {...form.register("payment_method")}>
                {PAYMENT_METHODS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Notes" error={errors.notes?.message} optional>
            <Textarea rows={2} {...form.register("notes")} maxLength={500} />
          </Field>
          <Checkbox label="Active" {...form.register("is_active")} />
        </form>
      )}
    </Dialog>
  );
}

export function RecordPaymentDialog({ payment, onClose }: { payment: RecurringPayment; onClose: () => void }) {
  const { money, date } = usePreferences();
  const [occurredOn, setOccurredOn] = useState(payment.next_due_date);
  const [amount, setAmount] = useState(paiseToRupeeInput(payment.amount));
  const [error, setError] = useState<string | null>(null);
  const record = useFinanceMutation(
    () => {
      const paise = rupeesToPaise(amount) ?? 0;
      return api.recurring.record(payment.id, {
        occurred_on: occurredOn,
        amount: paise !== payment.amount ? paise : undefined,
      });
    },
    {
      success: (r) => `Recorded ${r.transaction.description} · next due ${date(r.payment.next_due_date)}`,
      onSuccess: onClose,
      onError: (err) => {
        if (err instanceof ApiError && err.code === "already_recorded") {
          setError("This occurrence was already recorded.");
          return true;
        }
      },
    },
  );
  const submit = () => {
    const check = positiveAmount.safeParse(amount);
    if (!check.success) {
      setError(check.error.issues[0]?.message ?? "Invalid amount");
      return;
    }
    if (!occurredOn) {
      setError("Choose a date");
      return;
    }
    setError(null);
    record.mutate();
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Mark “${payment.name}” as ${payment.type === "income" ? "received" : "paid"}`}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={record.isPending}>
            Record transaction
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-[13px] text-fg-muted">
          This records a {payment.type} of {money(payment.amount)} in {payment.account_name} for the occurrence due{" "}
          {date(payment.next_due_date)}, then moves the due date to the next {FREQUENCY_LABEL[payment.frequency].toLowerCase()} cycle.
          FinTrack doesn&apos;t make payments — confirm only once it has actually happened.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <Input type="date" value={occurredOn} onChange={(e) => setOccurredOn(e.target.value)} />
          </Field>
          <Field label="Amount">
            <MoneyInput value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
        </div>
        {error ? (
          <p role="alert" className="text-xs text-negative">
            {error}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
