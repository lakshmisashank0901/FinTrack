"use client";

import { PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransactionDialog } from "@/components/providers/transaction-dialog-provider";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { NAV_ITEMS, isActive } from "./nav-items";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  const { openCreate } = useTransactionDialog();
  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-200 lg:flex",
        collapsed ? "w-[68px]" : "w-60",
      )}
      aria-label="Main navigation"
    >
      <div className={cn("flex h-14 items-center px-4", collapsed ? "justify-center" : "justify-between")}>
        <Link href="/dashboard" aria-label="FinTrack overview">
          <Logo collapsed={collapsed} />
        </Link>
        {collapsed ? null : (
          <button
            type="button"
            onClick={onToggle}
            aria-label="Collapse sidebar"
            className="rounded-md p-1 text-fg-subtle hover:bg-surface-2 hover:text-fg"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="px-3 pt-1 pb-3">
        <button
          type="button"
          onClick={() => openCreate()}
          className={cn(
            "flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-accent text-sm font-medium text-accent-fg shadow-sm transition hover:brightness-110",
          )}
          aria-label="Add transaction"
          title={collapsed ? "Add transaction" : undefined}
        >
          <Plus className="h-4 w-4" />
          {collapsed ? null : "Add transaction"}
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              title={collapsed ? item.label : undefined}
              className={cn(
                "relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors",
                collapsed && "justify-center px-0",
                active ? "bg-surface-2 text-fg" : "text-fg-muted hover:bg-surface-2/70 hover:text-fg",
              )}
            >
              {active ? <span className="absolute top-2 bottom-2 left-0 w-[3px] rounded-full bg-accent" aria-hidden /> : null}
              <Icon className={cn("h-4 w-4 shrink-0", active && "text-accent")} />
              {collapsed ? <span className="sr-only">{item.label}</span> : item.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-1 border-t border-border p-3">
        <ThemeToggle showLabel={!collapsed} className={cn("w-full", collapsed && "justify-center")} />
        {collapsed ? (
          <button
            type="button"
            onClick={onToggle}
            aria-label="Expand sidebar"
            className="flex h-9 w-full items-center justify-center rounded-lg text-fg-muted hover:bg-surface-2 hover:text-fg"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        ) : null}
        <UserMenu collapsed={collapsed} />
      </div>
    </aside>
  );
}
