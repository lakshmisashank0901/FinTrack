import type { DateFormat, NumberFormat, Paise } from "@/types/api";

// Money ----------------------------------------------------------------------
// All amounts travel as integer paise. Conversion is done with integer/string
// math so values never pick up floating-point drift.

const intFormatters = new Map<string, Intl.NumberFormat>();
function intFormatter(locale: NumberFormat) {
  let f = intFormatters.get(locale);
  if (!f) {
    f = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
    intFormatters.set(locale, f);
  }
  return f;
}

/** Groups a non-negative integer string-safe value: 125000 → "1,25,000" (en-IN). */
export function groupDigits(value: number | bigint, locale: NumberFormat = "en-IN") {
  return intFormatter(locale).format(value);
}

export interface MoneyOptions {
  locale?: NumberFormat;
  /** "auto" shows paise only when non-zero; "always" always shows two decimals; "never" rounds to rupees. */
  decimals?: "auto" | "always" | "never";
  /** Prefix "+" for positive values. */
  signed?: boolean;
}

export function formatINR(paise: Paise, opts: MoneyOptions = {}): string {
  const { locale = "en-IN", decimals = "auto", signed = false } = opts;
  if (!Number.isFinite(paise)) return "—";
  const negative = paise < 0;
  let abs = Math.abs(Math.trunc(paise));
  if (decimals === "never") abs = Math.round(abs / 100) * 100;
  const rupees = Math.floor(abs / 100);
  const fraction = abs % 100;
  let out = `₹${groupDigits(rupees, locale)}`;
  if (decimals === "always" || (decimals === "auto" && fraction !== 0)) {
    out += `.${String(fraction).padStart(2, "0")}`;
  }
  if (negative && abs !== 0) return `-${out}`;
  if (signed && abs !== 0) return `+${out}`;
  return out;
}

/** Compact axis labels: ₹1.2L, ₹45K, ₹2.5Cr (en-IN) or ₹1.2M (en-US). */
export function formatINRCompact(paise: Paise, locale: NumberFormat = "en-IN"): string {
  const negative = paise < 0;
  const rupees = Math.abs(paise) / 100;
  const units =
    locale === "en-IN"
      ? [
          { v: 1e7, s: "Cr" },
          { v: 1e5, s: "L" },
          { v: 1e3, s: "K" },
        ]
      : [
          { v: 1e9, s: "B" },
          { v: 1e6, s: "M" },
          { v: 1e3, s: "K" },
        ];
  let body = groupDigits(Math.round(rupees), locale);
  for (const u of units) {
    if (rupees >= u.v) {
      const n = rupees / u.v;
      body = `${n >= 100 ? Math.round(n) : Number(n.toFixed(1))}${u.s}`;
      break;
    }
  }
  return `${negative ? "-" : ""}₹${body}`;
}

const RUPEE_INPUT = /^\d{1,13}(\.\d{0,2})?$/;

/** Parses user input like "1,250.5" or "₹ 1250" into paise. Returns null when invalid. */
export function rupeesToPaise(input: string | number | null | undefined): Paise | null {
  if (input === null || input === undefined) return null;
  const s = String(input).replace(/[₹,\s]/g, "");
  if (!RUPEE_INPUT.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  const paise = Number(whole) * 100 + Number(frac.padEnd(2, "0") || "0");
  return Number.isSafeInteger(paise) ? paise : null;
}

/** Paise → plain editable rupee string: 125050 → "1250.50", 125000 → "1250". */
export function paiseToRupeeInput(paise: Paise | null | undefined): string {
  if (paise === null || paise === undefined) return "";
  const negative = paise < 0;
  const abs = Math.abs(Math.trunc(paise));
  const rupees = Math.floor(abs / 100);
  const fraction = abs % 100;
  const body = fraction === 0 ? String(rupees) : `${rupees}.${String(fraction).padStart(2, "0")}`;
  return negative ? `-${body}` : body;
}

// Percent -----------------------------------------------------------------------

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${Number(value.toFixed(digits))}%`;
}

export function formatSignedPercent(value: number, digits = 1): string {
  const v = Number(value.toFixed(digits));
  return `${v > 0 ? "+" : ""}${v}%`;
}

// Dates ----------------------------------------------------------------------
// Transaction dates are user-local calendar dates (YYYY-MM-DD). They are parsed
// as plain parts, never through Date(), so no timezone shift can occur.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function parseISODate(iso: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

export function formatDate(iso: string | null | undefined, format: DateFormat = "DD MMM YYYY"): string {
  if (!iso) return "—";
  const p = parseISODate(iso);
  if (!p) return iso;
  const dd = String(p.d).padStart(2, "0");
  const mm = String(p.m).padStart(2, "0");
  switch (format) {
    case "DD/MM/YYYY":
      return `${dd}/${mm}/${p.y}`;
    case "MM/DD/YYYY":
      return `${mm}/${dd}/${p.y}`;
    case "YYYY-MM-DD":
      return `${p.y}-${mm}-${dd}`;
    default:
      return `${dd} ${MONTHS[p.m - 1]} ${p.y}`;
  }
}

export function formatMonth(month: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(month);
  if (!match) return month;
  return `${MONTHS[Number(match[2]) - 1]} ${match[1]}`;
}

/** Today's local calendar date as YYYY-MM-DD in the given IANA time zone. */
export function todayISO(timeZone?: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat("en-CA").format(new Date());
  }
}

export function currentMonth(timeZone?: string): string {
  return todayISO(timeZone).slice(0, 7);
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const idx = y * 12 + (m - 1) + delta;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}

export function relativeDays(days: number): string {
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days > 1) return `Due in ${days} days`;
  if (days === -1) return "1 day overdue";
  return `${Math.abs(days)} days overdue`;
}
