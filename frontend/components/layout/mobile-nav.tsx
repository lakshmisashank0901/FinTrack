"use client";

import { ArrowLeftRight, LayoutDashboard, LogOut, Menu as MenuIcon, Plus, Target, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useTransactionDialog } from "@/components/providers/transaction-dialog-provider";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { NAV_ITEMS, isActive } from "./nav-items";
import { ThemeToggle } from "./theme-toggle";
import { useSignOut } from "./user-menu";

export function MobileTopBar({ onMenu }: { onMenu: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-surface/90 px-4 backdrop-blur lg:hidden">
      <Link href="/dashboard" aria-label="FinTrack overview">
        <Logo />
      </Link>
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <button
          type="button"
          onClick={onMenu}
          aria-label="Open menu"
          className="rounded-lg p-2 text-fg-muted hover:bg-surface-2 hover:text-fg"
        >
          <MenuIcon className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}

const TABS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/transactions", label: "Activity", icon: ArrowLeftRight },
  { href: "/budgets", label: "Budgets", icon: Target },
];

export function MobileBottomBar({ onMore }: { onMore: () => void }) {
  const pathname = usePathname();
  const { openCreate } = useTransactionDialog();
  const tab = (t: (typeof TABS)[number]) => {
    const active = isActive(pathname, t.href);
    const Icon = t.icon;
    return (
      <Link
        key={t.href}
        href={t.href}
        aria-current={active ? "page" : undefined}
        className={cn("flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px]", active ? "text-accent" : "text-fg-subtle")}
      >
        <Icon className="h-5 w-5" />
        {t.label}
      </Link>
    );
  };
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      {tab(TABS[0])}
      {tab(TABS[1])}
      <div className="flex flex-1 items-center justify-center">
        <button
          type="button"
          onClick={() => openCreate()}
          aria-label="Add transaction"
          className="-mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-fg shadow-lg ring-4 ring-bg"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
      {tab(TABS[2])}
      <button type="button" onClick={onMore} className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] text-fg-subtle">
        <MenuIcon className="h-5 w-5" />
        More
      </button>
    </nav>
  );
}

export function MobileMenuSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const signOut = useSignOut();
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    if (open) onClose();
  }
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
      <button type="button" aria-label="Close menu" className="ft-fade-in absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="ft-slide-up absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-border bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mb-3 flex items-center justify-between">
          <Logo />
          <button type="button" onClick={onClose} aria-label="Close menu" className="rounded-md p-1.5 text-fg-subtle hover:bg-surface-2">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="grid grid-cols-2 gap-1.5">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-[13px] font-medium",
                  active ? "border-accent/40 bg-accent-soft text-fg" : "border-border text-fg-muted",
                )}
              >
                <Icon className={cn("h-4 w-4", active && "text-accent")} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={signOut}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-border py-2.5 text-[13px] font-medium text-negative"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}
