import { z } from "zod";
import { isoDate, positiveAmount } from "./common";
import { paymentMethodEnum } from "./transaction";

export const recurringFormSchema = z.object({
  name: z.string().trim().min(1, "Name this payment").max(80, "Keep it under 80 characters"),
  type: z.enum(["income", "expense"]),
  amount: positiveAmount,
  category_id: z.string(),
  account_id: z.string().min(1, "Choose an account"),
  payment_method: paymentMethodEnum,
  frequency: z.enum(["weekly", "monthly", "quarterly", "yearly"]),
  next_due_date: isoDate,
  is_active: z.boolean(),
  notes: z.string().max(500, "Limited to 500 characters"),
});
export type RecurringFormValues = z.infer<typeof recurringFormSchema>;
