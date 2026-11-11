import { z } from "zod";
import { month, positiveAmount } from "./common";

export const budgetFormSchema = z.object({
  name: z.string().trim().min(1, "Name the budget").max(60, "Keep it under 60 characters"),
  category_id: z.string(),
  amount: positiveAmount,
  alert_threshold: z.coerce
    .number({ message: "Enter a percentage" })
    .int("Use a whole number")
    .min(1, "Minimum 1%")
    .max(100, "Maximum 100%"),
  start_month: month,
});
export type BudgetFormInput = z.input<typeof budgetFormSchema>;
export type BudgetFormValues = z.output<typeof budgetFormSchema>;
