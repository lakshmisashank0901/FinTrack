import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("h-7 w-7", className)}>
      <rect width="32" height="32" rx="9" fill="var(--accent)" />
      <path d="M9 21.5 14 16l3.5 3.2L23 12" fill="none" stroke="var(--accent-fg)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="23" cy="12" r="1.9" fill="var(--accent-fg)" />
    </svg>
  );
}

export function Logo({ collapsed = false, className }: { collapsed?: boolean; className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      {collapsed ? <span className="sr-only">FinTrack</span> : <span className="text-[15px] font-semibold tracking-tight text-fg">FinTrack</span>}
    </span>
  );
}
