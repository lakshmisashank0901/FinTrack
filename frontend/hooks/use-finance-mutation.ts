"use client";

import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { errorMessage } from "@/lib/api";

/** Invalidates every financial query (everything except the profile) so that
 *  balances, budgets, analytics and lists all refetch after a write. */
export function invalidateFinance(qc: QueryClient) {
  return qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "profile" });
}

interface Options<TData, TVars> {
  success?: string | ((data: TData, vars: TVars) => string);
  /** Return true to suppress the default error toast (e.g. handled inline). */
  onError?: (err: unknown, vars: TVars) => boolean | void;
  onSuccess?: (data: TData, vars: TVars) => void;
  invalidate?: (qc: QueryClient) => Promise<unknown> | void;
}

export function useFinanceMutation<TData, TVars = void>(
  fn: (vars: TVars) => Promise<TData>,
  opts: Options<TData, TVars> = {},
) {
  const qc = useQueryClient();
  return useMutation<TData, unknown, TVars>({
    mutationFn: fn,
    onSuccess: async (data, vars) => {
      await (opts.invalidate ? opts.invalidate(qc) : invalidateFinance(qc));
      if (opts.success) toast.success(typeof opts.success === "function" ? opts.success(data, vars) : opts.success);
      opts.onSuccess?.(data, vars);
    },
    onError: (err, vars) => {
      if (opts.onError?.(err, vars)) return;
      toast.error(errorMessage(err));
    },
  });
}
