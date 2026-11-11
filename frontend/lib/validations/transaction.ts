import { z } from "zod";
import { rupeesToPaise } from "@/lib/format";
import type { PaymentMethod, TransactionInput } from "@/types/api";
import { isoDate, nullIfEmpty, positiveAmount } from "./common";

export const transactionTypeEnum = z.enum(["income", "expense", "refund", "transfer"]);
export const paymentMethodEnum = z.enum([
  "upi",
  "cash",
  "debit_card",
  "credit_card",
  "bank_transfer",
  "net_banking",
  "other",
]);

export const transactionFormSchema = z
  .object({
    type: transactionTypeEnum,
    amount: positiveAmount,
    description: z.string().trim().min(1, "Add a short description").max(140, "Keep it under 140 characters"),
    category_id: z.string(),
    account_id: z.string().min(1, "Choose an account"),
    to_account_id: z.string(),
    occurred_on: isoDate,
    occurred_time: z.union([z.literal(""), z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM")]),
    payment_method: z.union([z.literal(""), paymentMethodEnum]),
    notes: z.string().max(1000, "Notes are limited to 1000 characters"),
    tags: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.type === "transfer") {
      if (!v.to_account_id) {
        ctx.addIssue({ code: "custom", path: ["to_account_id"], message: "Choose the destination account" });
      } else if (v.to_account_id === v.account_id) {
        ctx.addIssue({ code: "custom", path: ["to_account_id"], message: "Source and destination must differ" });
      }
    }
    const tags = parseTags(v.tags);
    if (tags.length > 10) ctx.addIssue({ code: "custom", path: ["tags"], message: "Up to 10 tags" });
    if (tags.some((t) => t.length > 30)) ctx.addIssue({ code: "custom", path: ["tags"], message: "Tags are limited to 30 characters" });
  });

export type TransactionFormValues = z.infer<typeof transactionFormSchema>;

export function parseTags(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  );
}

export function toTransactionInput(v: TransactionFormValues): TransactionInput {
  const transfer = v.type === "transfer";
  return {
    type: v.type,
    amount: rupeesToPaise(v.amount) ?? 0,
    description: v.description.trim(),
    category_id: transfer ? null : v.category_id || null,
    account_id: v.account_id,
    to_account_id: transfer ? v.to_account_id || null : null,
    occurred_on: v.occurred_on,
    occurred_time: v.occurred_time || null,
    payment_method: (v.payment_method || (transfer ? null : "other")) as PaymentMethod | null,
    notes: nullIfEmpty(v.notes),
    tags: parseTags(v.tags),
  };
}
