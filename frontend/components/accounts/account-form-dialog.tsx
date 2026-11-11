"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, MoneyInput, Select } from "@/components/ui/input";
import { useFinanceMutation } from "@/hooks/use-finance-mutation";
import { api } from "@/lib/api";
import { ACCOUNT_TYPES } from "@/lib/constants";
import { paiseToRupeeInput } from "@/lib/format";
import { accountFormSchema, type AccountFormValues } from "@/lib/validations/account";
import { signedRupeesToPaise } from "@/lib/validations/common";
import type { Account } from "@/types/api";

export function AccountFormDialog({ account, onClose }: { account?: Account; onClose: () => void }) {
  const isCard = account?.type === "credit_card";
  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: account
      ? {
          name: account.name,
          type: account.type,
          balance: paiseToRupeeInput(isCard ? -account.opening_balance : account.opening_balance),
        }
      : { name: "", type: "savings", balance: "" },
  });
  const type = useWatch({ control: form.control, name: "type" });
  const credit = type === "credit_card";

  const save = useFinanceMutation(
    (v: AccountFormValues) => {
      const entered = signedRupeesToPaise(v.balance) ?? 0;
      // Credit-card dues are entered as a positive amount owed and stored as a negative balance.
      const opening_balance = v.type === "credit_card" ? -Math.abs(entered) : entered;
      const body = { name: v.name.trim(), type: v.type, opening_balance };
      return account ? api.accounts.update(account.id, body) : api.accounts.create({ ...body, currency: "INR" });
    },
    { success: account ? "Account updated" : "Account added", onSuccess: onClose },
  );
  const errors = form.formState.errors;

  return (
    <Dialog
      open
      onClose={onClose}
      title={account ? "Edit account" : "Add account"}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="account-form" loading={save.isPending}>
            {account ? "Save" : "Add account"}
          </Button>
        </>
      }
    >
      <form id="account-form" noValidate className="space-y-4" onSubmit={form.handleSubmit((v) => save.mutate(v))}>
        <Field label="Account name" error={errors.name?.message}>
          <Input {...form.register("name")} placeholder="HDFC Savings" maxLength={60} autoFocus />
        </Field>
        <Field label="Type" error={errors.type?.message}>
          <Select {...form.register("type")}>
            {ACCOUNT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label={credit ? "Outstanding dues" : "Opening balance"}
          error={errors.balance?.message}
          hint={
            credit
              ? "What you owe on this card right now. It counts as a liability, not cash."
              : account
                ? "Changing this shifts the current balance by the same amount."
                : "The balance when you start tracking. Use a minus sign for an overdraft."
          }
        >
          <MoneyInput {...form.register("balance")} />
        </Field>
      </form>
    </Dialog>
  );
}
