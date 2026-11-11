"use client";

import { ArrowLeftRight, Download, Plus, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { usePreferences } from "@/components/providers/preferences-provider";
import { useTransactionDialog } from "@/components/providers/transaction-dialog-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DateRangeInputs } from "@/components/ui/date-range";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SkeletonRows } from "@/components/ui/skeleton";
import { useAccounts, useCategories, useTransactions } from "@/hooks/queries";
import { useDebounce } from "@/hooks/use-debounce";
import { api, errorMessage } from "@/lib/api";
import { PAYMENT_METHODS, TRANSACTION_TYPES } from "@/lib/constants";
import { cn, downloadBlob } from "@/lib/utils";
import type { PaymentMethod, TransactionFilters, TransactionType } from "@/types/api";
import { TransactionTable } from "./transaction-table";

const PAGE_SIZE = 25;
const SORTS = [
  { value: "date:desc", label: "Newest first" },
  { value: "date:asc", label: "Oldest first" },
  { value: "amount:desc", label: "Highest amount" },
  { value: "amount:asc", label: "Lowest amount" },
];

function useFilters() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const filters: TransactionFilters = useMemo(() => {
    const list = (k: string) => {
      const v = params.getAll(k).filter(Boolean);
      return v.length ? v : undefined;
    };
    const sort = params.get("sort") === "amount" ? "amount" : "date";
    return {
      search: params.get("search") ?? undefined,
      start_date: params.get("start_date") ?? undefined,
      end_date: params.get("end_date") ?? undefined,
      category_id: list("category_id"),
      type: list("type") as TransactionType[] | undefined,
      account_id: params.get("account_id") ?? undefined,
      payment_method: list("payment_method") as PaymentMethod[] | undefined,
      sort,
      order: params.get("order") === "asc" ? "asc" : "desc",
      page: Math.max(1, Number(params.get("page")) || 1),
      page_size: PAGE_SIZE,
    };
  }, [params]);

  const update = (patch: Record<string, string | undefined>, resetPage = true) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === "") next.delete(k);
      else next.set(k, v);
    }
    if (resetPage && !("page" in patch)) next.delete("page");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const clear = () => router.replace(pathname, { scroll: false });
  return { filters, update, clear, raw: params };
}

export function TransactionsView() {
  const { filters, update, clear, raw } = useFilters();
  const { money } = usePreferences();
  const { openCreate } = useTransactionDialog();
  const accounts = useAccounts(true);
  const categories = useCategories(undefined, true);
  const q = useTransactions(filters);
  const [exporting, setExporting] = useState(false);

  // Debounced search box, mirrored into the URL.
  const [search, setSearch] = useState(filters.search ?? "");
  const debounced = useDebounce(search, 350);
  useEffect(() => {
    if ((filters.search ?? "") !== debounced.trim()) update({ search: debounced.trim() || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the debounced value
  }, [debounced]);

  const active =
    !!filters.search ||
    !!filters.start_date ||
    !!filters.end_date ||
    !!filters.category_id ||
    !!filters.type ||
    !!filters.account_id ||
    !!filters.payment_method;

  const exportCsv = async () => {
    setExporting(true);
    try {
      const { blob, filename } = await api.transactions.exportCsv(filters);
      downloadBlob(blob, filename);
      toast.success("CSV exported");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  const totals = q.data?.totals;
  const expenseCats = (categories.data ?? []).filter((c) => c.kind === "expense");
  const incomeCats = (categories.data ?? []).filter((c) => c.kind === "income");

  return (
    <>
      <PageHeader
        title="Transactions"
        description="Search, filter and manage every record."
        actions={
          <>
            <Button size="sm" onClick={exportCsv} loading={exporting} disabled={!q.data?.total}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button size="sm" variant="primary" onClick={() => openCreate()}>
              <Plus className="h-4 w-4" />
              Add transaction
            </Button>
          </>
        }
      />

      <Card className="mb-4 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
            <label htmlFor="tx-search" className="sr-only">
              Search transactions
            </label>
            <Input
              id="tx-search"
              type="search"
              placeholder="Search description or notes"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-[13px]"
            />
          </div>
          <DateRangeInputs
            start={filters.start_date ?? ""}
            end={filters.end_date ?? ""}
            onChange={({ start, end }) => update({ start_date: start || undefined, end_date: end || undefined })}
          />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <FilterSelect
            label="Type"
            value={filters.type?.[0] ?? ""}
            onChange={(v) => update({ type: v })}
            options={TRANSACTION_TYPES}
            all="All types"
          />
          <div>
            <label htmlFor="f-category" className="sr-only">
              Category
            </label>
            <Select
              id="f-category"
              value={raw.get("category_id") ?? ""}
              onChange={(e) => update({ category_id: e.target.value || undefined })}
              className="h-8 text-[13px]"
            >
              <option value="">All categories</option>
              <option value="uncategorized">Uncategorised</option>
              <optgroup label="Expense">
                {expenseCats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Income">
                {incomeCats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            </Select>
          </div>
          <FilterSelect
            label="Account"
            value={filters.account_id ?? ""}
            onChange={(v) => update({ account_id: v })}
            options={(accounts.data?.items ?? []).map((a) => ({ value: a.id, label: a.is_archived ? `${a.name} (archived)` : a.name }))}
            all="All accounts"
          />
          <FilterSelect
            label="Payment method"
            value={filters.payment_method?.[0] ?? ""}
            onChange={(v) => update({ payment_method: v })}
            options={PAYMENT_METHODS}
            all="All methods"
          />
          <FilterSelect
            label="Sort"
            value={`${filters.sort}:${filters.order}`}
            onChange={(v) => {
              const [sort, order] = (v || "date:desc").split(":");
              update({ sort: sort === "date" ? undefined : sort, order: order === "desc" ? undefined : order });
            }}
            options={SORTS}
          />
          <Button
            size="sm"
            variant="ghost"
            className="h-8"
            disabled={!active}
            onClick={() => {
              setSearch("");
              clear();
            }}
          >
            <X className="h-4 w-4" />
            Clear filters
          </Button>
        </div>
      </Card>

      <div className={cn("mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4", q.isFetching && "opacity-70")}>
        <Total label="Income" value={totals ? money(totals.income) : "—"} tone="positive" />
        <Total
          label="Expenses"
          value={totals ? money(totals.net_spending) : "—"}
          sub={totals && totals.refunds > 0 ? `${money(totals.expenses)} spent − ${money(totals.refunds)} refunds` : undefined}
          tone="negative"
        />
        <Total label="Net cash flow" value={totals ? money(totals.net_cash_flow, { signed: true }) : "—"} />
        <Total label="Transactions" value={totals ? String(totals.count) : "—"} />
      </div>

      <Card className="px-4 py-2 sm:px-5">
        {q.isLoading ? (
          <div className="py-4">
            <SkeletonRows rows={8} />
          </div>
        ) : q.error ? (
          <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
        ) : !q.data?.items.length ? (
          <EmptyState
            icon={ArrowLeftRight}
            title={active ? "No transactions match these filters" : "No transactions yet"}
            description={active ? "Try widening the date range or clearing filters." : "Add your first income or expense to get started."}
            action={
              active ? (
                <Button size="sm" onClick={() => { setSearch(""); clear(); }}>
                  Clear filters
                </Button>
              ) : (
                <Button size="sm" variant="primary" onClick={() => openCreate()}>
                  Add transaction
                </Button>
              )
            }
          />
        ) : (
          <>
            <TransactionTable items={q.data.items} className={cn(q.isFetching && "opacity-70")} />
            <div className="border-t border-border py-3">
              <Pagination
                page={q.data.page}
                pageSize={q.data.page_size}
                total={q.data.total}
                onPage={(p) => update({ page: p > 1 ? String(p) : undefined }, false)}
              />
            </div>
          </>
        )}
      </Card>
    </>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  all,
}: {
  label: string;
  value: string;
  onChange: (v: string | undefined) => void;
  options: { value: string; label: string }[];
  all?: string;
}) {
  const id = `f-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value || undefined)} className="h-8 text-[13px]">
        {all ? <option value="">{all}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

function Total({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "positive" | "negative" }) {
  return (
    <Card className="px-4 py-3">
      <p className="text-xs text-fg-subtle">{label}</p>
      <p className={cn("mt-0.5 text-base font-semibold tabular-nums", tone === "positive" && "text-positive", tone === "negative" && "text-negative")}>
        {value}
      </p>
      {sub ? <p className="mt-0.5 truncate text-[11px] text-fg-subtle">{sub}</p> : null}
    </Card>
  );
}
