import Link from "next/link";
import { Logo } from "@/components/layout/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Link href="/" className="mb-8" aria-label="FinTrack home">
        <Logo />
      </Link>
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-sm">{children}</div>
      <p className="mt-6 text-xs text-fg-subtle">Track smarter. Spend better. Save more.</p>
    </div>
  );
}
