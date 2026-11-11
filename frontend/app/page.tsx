import { ArrowRight, ChartPie, ShieldCheck, Target } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/layout/logo";

const FEATURES = [
  { icon: ChartPie, title: "See where money goes", body: "Category breakdowns, trends and cash flow from your own records." },
  { icon: Target, title: "Stay within budget", body: "Monthly limits with clear on-track, approaching and exceeded states." },
  { icon: ShieldCheck, title: "Private by design", body: "Every record is tied to your account and isolated at the database." },
];

export default function Landing() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col px-5 sm:px-8">
      <header className="flex h-16 items-center justify-between">
        <Logo />
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/login" className="rounded-lg px-3 py-1.5 text-fg-muted hover:text-fg">
            Sign in
          </Link>
          <Link href="/signup" className="rounded-lg bg-fg px-3 py-1.5 font-medium text-bg hover:opacity-90">
            Get started
          </Link>
        </nav>
      </header>
      <main className="flex flex-1 flex-col justify-center py-16">
        <p className="text-sm font-medium text-accent">Personal finance, made clear</p>
        <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
          Track smarter. Spend better. Save more.
        </h1>
        <p className="mt-4 max-w-xl text-base text-fg-muted">
          FinTrack brings your accounts, spending, budgets and savings goals together, so you can understand your finances in
          seconds.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-fg shadow-sm hover:brightness-110"
          >
            Create a free account <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/login" className="rounded-lg border border-border-strong bg-surface px-4 py-2.5 text-sm font-medium hover:bg-surface-2">
            Sign in
          </Link>
        </div>
        <div className="mt-16 grid gap-4 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-border bg-surface p-5">
              <Icon className="h-5 w-5 text-accent" aria-hidden />
              <h2 className="mt-3 text-sm font-semibold">{title}</h2>
              <p className="mt-1 text-[13px] text-fg-muted">{body}</p>
            </div>
          ))}
        </div>
      </main>
      <footer className="py-6 text-xs text-fg-subtle">FinTrack · Track smarter. Spend better. Save more.</footer>
    </div>
  );
}
