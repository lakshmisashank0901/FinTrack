"use client";

import { useTheme } from "next-themes";
import type { PaymentMethod } from "@/types/api";

// Validated categorical steps (dataviz reference palette), selected per mode.
// Income/expense use slots 3 (aqua-green) and 8 (red); their CVD separation is in
// the 6–8 band, so every chart pairing them also ships a legend, tooltip and table view.
const LIGHT = {
  surface: "#ffffff",
  grid: "#ecebe6",
  axis: "#898781",
  text: "#55554f",
  income: "#1baf7a",
  expense: "#e34948",
  series: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"],
};
const DARK = {
  surface: "#151517",
  grid: "#26262a",
  axis: "#898781",
  text: "#b4b3ac",
  income: "#199e70",
  expense: "#e66767",
  series: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"],
};

export type ChartTheme = typeof LIGHT;

export function useChartTheme(): ChartTheme {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === "dark" ? DARK : LIGHT;
}

/** Fixed slot per payment method so a method keeps its colour across filters. */
export const PAYMENT_METHOD_SLOT: Record<PaymentMethod, number> = {
  upi: 0,
  debit_card: 1,
  cash: 2,
  credit_card: 3,
  net_banking: 4,
  bank_transfer: 5,
  other: 6,
};
