"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { CategoryIcon } from "@/components/transactions/category-chip";
import { DemoBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/empty-state";
import { Checkbox, Field, Input, Select } from "@/components/ui/input";
import { Menu } from "@/components/ui/menu";
import { SegmentedControl } from "@/components/ui/segmented";
import { SkeletonRows } from "@/components/ui/skeleton";
import { useCategories } from "@/hooks/queries";
import { useFinanceMutation } from "@/hooks/use-finance-mutation";
import { ApiError, api, errorMessage } from "@/lib/api";
import { CATEGORY_COLORS, CATEGORY_ICONS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { categoryFormSchema, type CategoryFormValues } from "@/lib/validations/category";
import type { Category, CategoryKind } from "@/types/api";

export function CategoriesSection() {
  const [kind, setKind] = useState<CategoryKind>("expense");
  const [showArchived, setShowArchived] = useState(false);
  const q = useCategories(kind, true);
  const [editing, setEditing] = useState<Category | "new" | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const archive = useFinanceMutation((c: Category) => api.categories.update(c.id, { is_archived: !c.is_archived }), {
    success: (c) => (c.is_archived ? `${c.name} archived` : `${c.name} restored`),
  });
  const remove = useFinanceMutation((c: Category) => api.categories.remove(c.id), {
    success: "Category deleted",
    onSuccess: () => setDeleting(null),
  });
  const items = (q.data ?? []).filter((c) => showArchived || !c.is_archived);

  return (
    <Card id="categories">
      <CardHeader
        title="Categories"
        description="Organise income and spending. Archived categories stay on past transactions."
        action={
          <>
            <SegmentedControl
              label="Category kind"
              value={kind}
              onChange={setKind}
              options={[
                { value: "expense", label: "Expense" },
                { value: "income", label: "Income" },
              ]}
            />
            <Button size="sm" variant="primary" onClick={() => setEditing("new")}>
              <Plus className="h-4 w-4" />
              New
            </Button>
          </>
        }
      />
      <CardBody>
        <div className="mb-3">
          <Checkbox label="Show archived" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
        </div>
        {q.isLoading ? (
          <SkeletonRows rows={4} />
        ) : q.error ? (
          <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((c) => (
              <li key={c.id} className={cn("flex items-center gap-3 rounded-lg border border-border px-3 py-2", c.is_archived && "opacity-60")}>
                <CategoryIcon category={c} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{c.name}</p>
                  <p className="text-[11px] text-fg-subtle">
                    {c.transaction_count ?? 0} transaction{c.transaction_count === 1 ? "" : "s"}
                    {c.is_archived ? " · archived" : ""}
                  </p>
                </div>
                {c.is_demo ? <DemoBadge /> : null}
                <Menu
                  label={`${c.name} actions`}
                  items={[
                    { label: "Edit", icon: <Pencil className="h-4 w-4" />, onSelect: () => setEditing(c) },
                    {
                      label: c.is_archived ? "Restore" : "Archive",
                      icon: c.is_archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />,
                      onSelect: () => archive.mutate(c),
                    },
                    { label: "Delete", icon: <Trash2 className="h-4 w-4" />, danger: true, onSelect: () => setDeleting(c) },
                  ]}
                  trigger={(p) => (
                    <Button size="icon-sm" variant="ghost" aria-label={`${c.name} actions`} {...p}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  )}
                />
              </li>
            ))}
          </ul>
        )}
      </CardBody>
      {editing ? <CategoryDialog category={editing === "new" ? undefined : editing} kind={kind} onClose={() => setEditing(null)} /> : null}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting)}
        loading={remove.isPending}
        title="Delete category?"
        description={
          <p>
            “{deleting?.name}” will be deleted. Its {deleting?.transaction_count ?? 0} transaction(s) become uncategorised and any budget for it is
            removed. To keep history tidy, consider archiving instead.
          </p>
        }
      />
    </Card>
  );
}

function CategoryDialog({ category, kind, onClose }: { category?: Category; kind: CategoryKind; onClose: () => void }) {
  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: category
      ? { name: category.name, kind: category.kind, color: category.color, icon: category.icon }
      : { name: "", kind, color: CATEGORY_COLORS[0], icon: "circle" },
  });
  const color = useWatch({ control: form.control, name: "color" });
  const icon = useWatch({ control: form.control, name: "icon" });
  const save = useFinanceMutation(
    (v: CategoryFormValues) =>
      category
        ? api.categories.update(category.id, { name: v.name.trim(), color: v.color, icon: v.icon })
        : api.categories.create({ ...v, name: v.name.trim() }),
    {
      success: category ? "Category updated" : "Category created",
      onSuccess: onClose,
      onError: (err) => {
        if (err instanceof ApiError && err.code === "duplicate_category") {
          form.setError("name", { message: "A category with this name already exists" });
          return true;
        }
      },
    },
  );
  return (
    <Dialog
      open
      onClose={onClose}
      title={category ? "Edit category" : "New category"}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="category-form" loading={save.isPending}>
            Save
          </Button>
        </>
      }
    >
      <form id="category-form" noValidate className="space-y-4" onSubmit={form.handleSubmit((v) => save.mutate(v))}>
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label="Name" error={form.formState.errors.name?.message}>
            <Input {...form.register("name")} maxLength={40} autoFocus />
          </Field>
          <Field label="Kind">
            <Select {...form.register("kind")} disabled={!!category}>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </Select>
          </Field>
        </div>
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium">Colour</legend>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Colour ${c}`}
                aria-pressed={color === c}
                onClick={() => form.setValue("color", c, { shouldDirty: true })}
                className={cn("h-6 w-6 rounded-full ring-offset-2 ring-offset-surface", color === c && "ring-2 ring-fg")}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium">Icon</legend>
          <div className="grid grid-cols-8 gap-1.5">
            {Object.entries(CATEGORY_ICONS).map(([name, Icon]) => (
              <button
                key={name}
                type="button"
                aria-label={`Icon ${name}`}
                aria-pressed={icon === name}
                onClick={() => form.setValue("icon", name, { shouldDirty: true })}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-md border transition-colors",
                  icon === name ? "border-transparent text-white" : "border-border text-fg-muted hover:bg-surface-2",
                )}
                style={icon === name ? { backgroundColor: color } : undefined}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </fieldset>
      </form>
    </Dialog>
  );
}
