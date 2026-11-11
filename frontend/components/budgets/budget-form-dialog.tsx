"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, MoneyInput, Select } from "@/components/ui/input";
import { useCategories } from "@/hooks/queries";
import { useFinanceMutation } from "@/hooks/use-finance-mutation";
import { ApiError, api } from "@/lib/api";
import { paiseToRupeeInput, rupeesToPaise } from "@/lib/format";
import { budgetFormSchema, type BudgetFormInput, type BudgetFormValues } from "@/lib/validations/budget";
import type { BudgetStatus } from "@/types/api";

export function BudgetFormDialog({
  budget,
  month,
  takenCategoryIds,
  hasOverall,
  onClose,
}: {
  budget?: BudgetStatus;
  month: string;
  takenCategoryIds: string[];
  hasOverall: boolean;
  onClose: () => void;
}) {
  const categories = useCategories("expense");
  const form = useForm<BudgetFormInput, unknown, BudgetFormValues>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: budget
      ? {
          name: budget.name,
          category_id: budget.category_id ?? "",
          amount: paiseToRupeeInput(budget.amount),
          alert_threshold: budget.alert_threshold,
          start_month: budget.start_month,
        }
      : { name: "", category_id: "", amount: "", alert_threshold: 80, start_month: month },
  });
  const errors = form.formState.errors;

  const save = useFinanceMutation(
    (v: BudgetFormValues) => {
      const amount = rupeesToPaise(v.amount) ?? 0;
      if (budget) {
        return api.budgets.update(budget.id, {
          name: v.name.trim(),
          amount,
          alert_threshold: v.alert_threshold,
          start_month: v.start_month,
        });
      }
      return api.budgets.create({
        name: v.name.trim(),
        category_id: v.category_id || null,
        amount,
        alert_threshold: v.alert_threshold,
        start_month: v.start_month,
      });
    },
    {
      success: budget ? "Budget updated" : "Budget created",
      onSuccess: onClose,
      onError: (err) => {
        if (err instanceof ApiError && err.code === "duplicate_budget") {
          form.setError("category_id", { message: "A budget for this already exists" });
          return true;
        }
      },
    },
  );

  const options = (categories.data ?? []).filter(
    (c) => !c.is_archived && (!takenCategoryIds.includes(c.id) || c.id === budget?.category_id),
  );

  return (
    <Dialog
      open
      onClose={onClose}
      title={budget ? "Edit budget" : "Create budget"}
      description="Budgets are monthly limits that repeat from their start month."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="budget-form" loading={save.isPending}>
            {budget ? "Save" : "Create budget"}
          </Button>
        </>
      }
    >
      <form
        id="budget-form"
        noValidate
        className="space-y-4"
        onSubmit={form.handleSubmit((v) => {
          if (!budget && hasOverall && !v.category_id) {
            form.setError("category_id", { message: "You already have an overall budget — choose a category" });
            return;
          }
          save.mutate(v);
        })}
      >
        <Field
          label="Applies to"
          error={errors.category_id?.message}
          hint={budget ? "The scope of an existing budget can't be changed." : "Overall covers all spending; a category budget tracks one category."}
        >
          <Select
            {...form.register("category_id", {
              onChange: (e) => {
                if (!form.getValues("name")) {
                  const c = categories.data?.find((x) => x.id === e.target.value);
                  form.setValue("name", c ? c.name : "Monthly spending");
                }
              },
            })}
            disabled={!!budget}
          >
            {!hasOverall || (budget && !budget.category_id) ? <option value="">Overall (all spending)</option> : <option value="" disabled>Overall (already set)</option>}
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Name" error={errors.name?.message}>
          <Input {...form.register("name")} placeholder="Monthly spending" maxLength={60} />
        </Field>
        <Field label="Monthly limit" error={errors.amount?.message}>
          <MoneyInput {...form.register("amount")} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Alert at" error={errors.alert_threshold?.message} hint="% of limit">
            <Input type="number" min={1} max={100} {...form.register("alert_threshold")} />
          </Field>
          <Field label="Starts" error={errors.start_month?.message}>
            <Input type="month" {...form.register("start_month")} />
          </Field>
        </div>
      </form>
    </Dialog>
  );
}
