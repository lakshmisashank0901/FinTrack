"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { usePreferences } from "@/components/providers/preferences-provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/empty-state";
import { Field, Input, MoneyInput, Textarea } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented";
import { SkeletonRows } from "@/components/ui/skeleton";
import { useContributions } from "@/hooks/queries";
import { useFinanceMutation } from "@/hooks/use-finance-mutation";
import { ApiError, api, errorMessage } from "@/lib/api";
import { GOAL_COLORS } from "@/lib/constants";
import { paiseToRupeeInput, rupeesToPaise } from "@/lib/format";
import { cn } from "@/lib/utils";
import { contributionFormSchema, goalFormSchema, type ContributionFormValues, type GoalFormValues } from "@/lib/validations/savings";
import type { SavingsGoal } from "@/types/api";

const invalidateSavings = (qc: import("@tanstack/react-query").QueryClient) => qc.invalidateQueries({ queryKey: ["savings"] });

export function GoalFormDialog({ goal, onClose }: { goal?: SavingsGoal; onClose: () => void }) {
  const form = useForm<GoalFormValues>({
    resolver: zodResolver(goalFormSchema),
    defaultValues: goal
      ? {
          name: goal.name,
          target_amount: paiseToRupeeInput(goal.target_amount),
          target_date: goal.target_date ?? "",
          description: goal.description ?? "",
          color: goal.color,
        }
      : { name: "", target_amount: "", target_date: "", description: "", color: GOAL_COLORS[0] },
  });
  const errors = form.formState.errors;
  const color = useWatch({ control: form.control, name: "color" });
  const save = useFinanceMutation(
    (v: GoalFormValues) => {
      const body = {
        name: v.name.trim(),
        target_amount: rupeesToPaise(v.target_amount) ?? 0,
        target_date: v.target_date || null,
        description: v.description.trim() || null,
        color: v.color,
      };
      return goal ? api.savings.update(goal.id, body) : api.savings.create(body);
    },
    { success: goal ? "Goal updated" : "Goal created", onSuccess: onClose, invalidate: invalidateSavings },
  );
  return (
    <Dialog
      open
      onClose={onClose}
      title={goal ? "Edit goal" : "New savings goal"}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="goal-form" loading={save.isPending}>
            {goal ? "Save" : "Create goal"}
          </Button>
        </>
      }
    >
      <form id="goal-form" noValidate className="space-y-4" onSubmit={form.handleSubmit((v) => save.mutate(v))}>
        <Field label="Goal name" error={errors.name?.message}>
          <Input {...form.register("name")} placeholder="Emergency fund" maxLength={60} autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Target amount" error={errors.target_amount?.message}>
            <MoneyInput {...form.register("target_amount")} />
          </Field>
          <Field label="Target date" error={errors.target_date?.message} optional>
            <Input type="date" {...form.register("target_date")} />
          </Field>
        </div>
        <Field label="Description" error={errors.description?.message} optional>
          <Textarea {...form.register("description")} rows={2} maxLength={500} />
        </Field>
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium">Colour</legend>
          <div className="flex flex-wrap gap-2">
            {GOAL_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Colour ${c}`}
                aria-pressed={color === c}
                onClick={() => form.setValue("color", c)}
                className={cn("h-7 w-7 rounded-full ring-offset-2 ring-offset-surface", color === c && "ring-2 ring-fg")}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </fieldset>
      </form>
    </Dialog>
  );
}

export function ContributionDialog({
  goal,
  kind,
  onClose,
}: {
  goal: SavingsGoal;
  kind: "contribution" | "withdrawal";
  onClose: () => void;
}) {
  const { today, money } = usePreferences();
  const form = useForm<ContributionFormValues>({
    resolver: zodResolver(contributionFormSchema),
    defaultValues: { kind, amount: "", contributed_on: today(), note: "" },
  });
  const current = useWatch({ control: form.control, name: "kind" });
  const errors = form.formState.errors;
  const save = useFinanceMutation(
    (v: ContributionFormValues) =>
      api.savings.contribute(goal.id, {
        kind: v.kind,
        amount: rupeesToPaise(v.amount) ?? 0,
        contributed_on: v.contributed_on,
        note: v.note.trim() || null,
      }),
    {
      success: (_, v) => (v.kind === "contribution" ? "Contribution recorded" : "Withdrawal recorded"),
      onSuccess: onClose,
      invalidate: invalidateSavings,
      onError: (err) => {
        if (err instanceof ApiError && err.code === "insufficient_savings") {
          form.setError("amount", { message: `You can withdraw at most ${money(goal.saved_amount)}` });
          return true;
        }
      },
    },
  );
  return (
    <Dialog
      open
      onClose={onClose}
      title={goal.name}
      description="Goals are earmarks — recording here doesn't create a transaction or count as spending."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="contribution-form" loading={save.isPending}>
            Record {current === "contribution" ? "contribution" : "withdrawal"}
          </Button>
        </>
      }
    >
      <form id="contribution-form" noValidate className="space-y-4" onSubmit={form.handleSubmit((v) => save.mutate(v))}>
        <SegmentedControl
          label="Kind"
          size="md"
          value={current}
          onChange={(v) => form.setValue("kind", v)}
          options={[
            { value: "contribution", label: "Add money" },
            { value: "withdrawal", label: "Withdraw" },
          ]}
          className="w-full [&>button]:flex-1"
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount" error={errors.amount?.message} hint={current === "withdrawal" ? `Saved: ${money(goal.saved_amount)}` : undefined}>
            <MoneyInput {...form.register("amount")} autoFocus />
          </Field>
          <Field label="Date" error={errors.contributed_on?.message}>
            <Input type="date" {...form.register("contributed_on")} />
          </Field>
        </div>
        <Field label="Note" error={errors.note?.message} optional>
          <Input {...form.register("note")} maxLength={200} />
        </Field>
      </form>
    </Dialog>
  );
}

export function ContributionHistoryDialog({ goal, onClose }: { goal: SavingsGoal; onClose: () => void }) {
  const { money, date } = usePreferences();
  const q = useContributions(goal.id);
  const remove = useFinanceMutation((cid: string) => api.savings.removeContribution(goal.id, cid), {
    success: "Entry removed",
    invalidate: invalidateSavings,
  });
  return (
    <Dialog open onClose={onClose} title={`${goal.name} history`} size="sm">
      {q.isLoading ? (
        <SkeletonRows rows={4} />
      ) : q.error ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : !q.data?.length ? (
        <p className="py-6 text-center text-sm text-fg-subtle">No contributions yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {q.data.map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium">{c.kind === "contribution" ? "Added" : "Withdrawn"}</p>
                <p className="truncate text-xs text-fg-subtle">
                  {date(c.contributed_on)}
                  {c.note ? ` · ${c.note}` : ""}
                </p>
              </div>
              <span className={cn("text-sm font-medium tabular-nums", c.kind === "contribution" ? "text-positive" : "text-negative")}>
                {c.kind === "contribution" ? "+" : "-"}
                {money(c.amount)}
              </span>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Remove entry"
                disabled={remove.isPending}
                onClick={() => remove.mutate(c.id)}
                className="hover:text-negative"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
