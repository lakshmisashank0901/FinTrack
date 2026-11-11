import { z } from "zod";
import { hexColor } from "./common";

export const categoryFormSchema = z.object({
  name: z.string().trim().min(1, "Name the category").max(40, "Keep it under 40 characters"),
  kind: z.enum(["expense", "income"]),
  color: hexColor,
  icon: z.string().min(1).max(40),
});
export type CategoryFormValues = z.infer<typeof categoryFormSchema>;
