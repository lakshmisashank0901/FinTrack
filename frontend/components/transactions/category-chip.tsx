import { Circle } from "lucide-react";
import { CATEGORY_ICONS } from "@/lib/constants";
import type { CategoryRef } from "@/types/api";

export function CategoryIcon({ category, size = "md" }: { category: Pick<CategoryRef, "color" | "icon"> | null; size?: "sm" | "md" }) {
  const Icon = CATEGORY_ICONS[category?.icon ?? ""] ?? Circle;
  const color = category?.color ?? "#85847e";
  const box = size === "sm" ? "h-7 w-7" : "h-8 w-8";
  return (
    <span
      className={`flex ${box} shrink-0 items-center justify-center rounded-full`}
      style={{ backgroundColor: `${color}1f`, color }}
      aria-hidden
    >
      <Icon className="h-4 w-4" />
    </span>
  );
}

export function CategoryChip({ category }: { category: CategoryRef | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-fg-muted">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: category?.color ?? "#85847e" }} aria-hidden />
      {category?.name ?? "Uncategorised"}
    </span>
  );
}
