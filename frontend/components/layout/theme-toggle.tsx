"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const useMounted = () => useSyncExternalStore(() => () => {}, () => true, () => false);

export function ThemeToggle({ showLabel = false, className }: { showLabel?: boolean; className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const dark = mounted && resolvedTheme === "dark";
  const toggle = () => {
    const next = dark ? "light" : "dark";
    setTheme(next);
    // Persist the choice; failure is harmless (the local theme still applies).
    api.profile.update({ preferences: { theme: next } }).catch(() => {});
  };
  const label = dark ? "Switch to light theme" : "Switch to dark theme";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg",
        className,
      )}
    >
      {dark ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
      {showLabel ? <span>{dark ? "Light mode" : "Dark mode"}</span> : null}
    </button>
  );
}
