import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { ResetPasswordForm } from "@/components/layout/auth-forms";

export const metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Link href="/" className="mb-8" aria-label="FinTrack home">
        <Logo />
      </Link>
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <ResetPasswordForm />
      </div>
    </div>
  );
}
