"use client";

import { usePreferences } from "@/components/providers/preferences-provider";
import { cn } from "@/lib/utils";
import type { TransactionType } from "@/types/api";

/** Displays an amount in INR using the user's number format. */
export function Money({
  paise,
  className,
  signed,
  tone,
}: {
  paise: number;
  className?: string;
  signed?: boolean;
  tone?: "auto" | "positive" | "negative" | "none";
}) {
  const { money } = usePreferences();
  const color =
    tone === "positive"
      ? "text-positive"
      : tone === "negative"
        ? "text-negative"
        : tone === "auto"
          ? paise > 0
            ? "text-positive"
            : paise < 0
              ? "text-negative"
              : ""
          : "";
  return <span className={cn("tabular-nums", color, className)}>{money(paise, { signed })}</span>;
}

/** Transaction amount with sign and colour derived from its type. */
export function TransactionAmount({ type, amount, className }: { type: TransactionType; amount: number; className?: string }) {
  const { money } = usePreferences();
  const sign = type === "expense" ? "-" : type === "transfer" ? "" : "+";
  const color = type === "expense" ? "text-negative" : type === "transfer" ? "text-fg-muted" : "text-positive";
  return (
    <span className={cn("font-medium tabular-nums whitespace-nowrap", color, className)}>
      {sign}
      {money(amount)}
    </span>
  );
}
