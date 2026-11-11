import { z } from "zod";
import { hexColor, isoDate, optionalIsoDate, positiveAmount } from "./common";

export const goalFormSchema = z.object({
  name: z.string().trim().min(1, "Name your goal").max(60, "Keep it under 60 characters"),
  target_amount: positiveAmount,
  target_date: optionalIsoDate,
  description: z.string().max(500, "Limited to 500 characters"),
  color: hexColor,
});
export type GoalFormValues = z.infer<typeof goalFormSchema>;

export const contributionFormSchema = z.object({
  kind: z.enum(["contribution", "withdrawal"]),
  amount: positiveAmount,
  contributed_on: isoDate,
  note: z.string().max(200, "Limited to 200 characters"),
});
export type ContributionFormValues = z.infer<typeof contributionFormSchema>;
