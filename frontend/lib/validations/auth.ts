import { z } from "zod";

const email = z.email("Enter a valid email address");
const password = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Use at most 72 characters")
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/\d/, "Include at least one number");

export const loginSchema = z.object({ email, password: z.string().min(1, "Enter your password") });
export type LoginValues = z.infer<typeof loginSchema>;

export const signupSchema = z
  .object({
    display_name: z.string().trim().max(80, "Keep it under 80 characters"),
    email,
    password,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match" });
export type SignupValues = z.infer<typeof signupSchema>;

export const forgotSchema = z.object({ email });
export type ForgotValues = z.infer<typeof forgotSchema>;

export const resetSchema = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match" });
export type ResetValues = z.infer<typeof resetSchema>;
