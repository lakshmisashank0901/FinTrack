import { z } from "zod";

export const profileFormSchema = z.object({
  display_name: z.string().trim().max(80, "Keep it under 80 characters"),
});
export type ProfileFormValues = z.infer<typeof profileFormSchema>;

export const preferencesFormSchema = z.object({
  default_period: z.enum(["this_week", "this_month", "last_month", "last_3_months", "this_year"]),
  theme: z.enum(["light", "dark", "system"]),
  date_format: z.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]),
  number_format: z.enum(["en-IN", "en-US"]),
  timezone: z.string().min(1).max(64),
});
export type PreferencesFormValues = z.infer<typeof preferencesFormSchema>;

/** Light client-side shape check; the backend performs full validation. */
export const backupShapeSchema = z.looseObject({
  format: z.literal("fintrack-backup", { message: "This file isn't a FinTrack backup" }),
  version: z.number().int().positive(),
  accounts: z.array(z.unknown()),
  categories: z.array(z.unknown()),
  transactions: z.array(z.unknown()),
  budgets: z.array(z.unknown()),
  savings_goals: z.array(z.unknown()),
  savings_contributions: z.array(z.unknown()),
  recurring_payments: z.array(z.unknown()),
});
