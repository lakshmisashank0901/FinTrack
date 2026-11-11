"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ChevronsUpDown, LogOut, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { Menu } from "@/components/ui/menu";
import { useProfile } from "@/hooks/queries";
import { getSupabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function useSignOut() {
  const router = useRouter();
  const qc = useQueryClient();
  return async () => {
    await getSupabase().auth.signOut();
    qc.clear();
    router.replace("/login");
    router.refresh();
  };
}

export function UserMenu({ collapsed = false, side = "top" }: { collapsed?: boolean; side?: "top" | "bottom" }) {
  const { data } = useProfile();
  const router = useRouter();
  const signOut = useSignOut();
  const name = data?.display_name || data?.email?.split("@")[0] || "Account";
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Menu
      label="Account menu"
      side={side}
      align={side === "top" ? "start" : "end"}
      header={
        <div className="border-b border-border px-2.5 py-2">
          <p className="truncate text-[13px] font-medium">{name}</p>
          <p className="truncate text-xs text-fg-subtle">{data?.email}</p>
        </div>
      }
      items={[
        { label: "Settings", icon: <Settings className="h-4 w-4" />, onSelect: () => router.push("/settings") },
        { label: "Sign out", icon: <LogOut className="h-4 w-4" />, onSelect: signOut, danger: true },
      ]}
      trigger={(props) => (
        <button
          type="button"
          {...props}
          aria-label="Open account menu"
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-surface-2",
            collapsed && "justify-center",
          )}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[11px] font-semibold text-fg">
            {initials}
          </span>
          {collapsed ? null : (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-fg">{name}</span>
                <span className="block truncate text-[11px] text-fg-subtle">{data?.email}</span>
              </span>
              <ChevronsUpDown className="h-3.5 w-3.5 text-fg-subtle" />
            </>
          )}
        </button>
      )}
    />
  );
}
