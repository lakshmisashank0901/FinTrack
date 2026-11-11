import { z } from "zod";
import { signedAmount } from "./common";

export const accountTypeEnum = z.enum(["cash", "savings", "current", "credit_card", "wallet", "other"]);

export const accountFormSchema = z.object({
  name: z.string().trim().min(1, "Name your account").max(60, "Keep it under 60 characters"),
  type: accountTypeEnum,
  /** For credit cards this is the outstanding dues (entered positive, stored negative). */
  balance: signedAmount,
});
export type AccountFormValues = z.infer<typeof accountFormSchema>;
