import { Suspense } from "react";
import { LoginForm } from "@/components/layout/auth-forms";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
