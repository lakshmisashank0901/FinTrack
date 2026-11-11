import { z } from "zod";
import { rupeesToPaise } from "@/lib/format";

export const MAX_RUPEES = 1_000_000_000_000; // matches the DB ceiling of 10^14 paise

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date");
export const optionalIsoDate = z.union([z.literal(""), isoDate]);
export const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Choose a valid month");
export const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #16a34a");

/** A positive rupee amount typed by the user (up to 2 decimals). */
export const positiveAmount = z
  .string()
  .trim()
  .min(1, "Enter an amount")
  .refine((v) => rupeesToPaise(v) !== null, "Enter a valid amount (up to 2 decimals)")
  .refine((v) => (rupeesToPaise(v) ?? 0) > 0, "Amount must be greater than ₹0")
  .refine((v) => (rupeesToPaise(v) ?? 0) <= MAX_RUPEES * 100, "Amount is too large");

/** A signed rupee amount (e.g. an opening balance that can be overdrawn). */
export const signedAmount = z
  .string()
  .trim()
  .refine((v) => v === "" || signedRupeesToPaise(v) !== null, "Enter a valid amount (up to 2 decimals)");

export function signedRupeesToPaise(v: string): number | null {
  const s = v.trim();
  if (s === "") return 0;
  const negative = s.startsWith("-");
  const p = rupeesToPaise(negative ? s.slice(1) : s);
  if (p === null || p > MAX_RUPEES * 100) return null;
  return negative ? -p : p;
}

export const nullIfEmpty = (v: string | undefined | null) => {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
};
