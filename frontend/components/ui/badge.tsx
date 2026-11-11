import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "positive" | "negative" | "warning" | "info" | "demo";
const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-fg-muted border-border",
  positive: "bg-accent-soft text-positive border-transparent",
  negative: "bg-negative-soft text-negative border-transparent",
  warning: "bg-warning-soft text-warning border-transparent",
  info: "bg-surface-2 text-fg border-border",
  demo: "border-dashed border-warning/60 text-warning bg-transparent",
};

export function Badge({ tone = "neutral", className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] leading-none font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

export function DemoBadge() {
  return (
    <Badge tone="demo" title="Sample data from demo mode">
      Demo
    </Badge>
  );
}
