import {
  Baby,
  BookOpen,
  Briefcase,
  Building2,
  Bus,
  Car,
  Circle,
  Clapperboard,
  Coffee,
  Coins,
  CreditCard,
  Dumbbell,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  Landmark,
  Laptop,
  Music,
  PawPrint,
  Phone,
  PiggyBank,
  Pizza,
  Plane,
  Receipt,
  Repeat,
  Shield,
  Shirt,
  ShoppingBag,
  ShoppingBasket,
  Smartphone,
  Sparkles,
  TrendingUp,
  Utensils,
  Wallet,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type {
  AccountType,
  DateFormat,
  Frequency,
  NumberFormat,
  PaymentMethod,
  PresetPeriod,
  TransactionType,
} from "@/types/api";

export const TRANSACTION_TYPES: { value: TransactionType; label: string }[] = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "refund", label: "Refund" },
  { value: "transfer", label: "Transfer" },
];
export const TRANSACTION_TYPE_LABEL: Record<TransactionType, string> = {
  income: "Income",
  expense: "Expense",
  refund: "Refund",
  transfer: "Transfer",
};

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "upi", label: "UPI" },
  { value: "cash", label: "Cash" },
  { value: "debit_card", label: "Debit Card" },
  { value: "credit_card", label: "Credit Card" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "net_banking", label: "Net Banking" },
  { value: "other", label: "Other" },
];
export const PAYMENT_METHOD_LABEL = Object.fromEntries(PAYMENT_METHODS.map((p) => [p.value, p.label])) as Record<
  PaymentMethod,
  string
>;

export const ACCOUNT_TYPES: { value: AccountType; label: string; icon: LucideIcon }[] = [
  { value: "savings", label: "Savings Account", icon: PiggyBank },
  { value: "current", label: "Current Account", icon: Building2 },
  { value: "cash", label: "Cash", icon: Coins },
  { value: "credit_card", label: "Credit Card", icon: CreditCard },
  { value: "wallet", label: "Digital Wallet", icon: Smartphone },
  { value: "other", label: "Other", icon: Wallet },
];
export const ACCOUNT_TYPE_META = Object.fromEntries(ACCOUNT_TYPES.map((a) => [a.value, a])) as Record<
  AccountType,
  (typeof ACCOUNT_TYPES)[number]
>;

export const PERIODS: { value: PresetPeriod; label: string }[] = [
  { value: "this_week", label: "This week" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "last_3_months", label: "Last 3 months" },
  { value: "this_year", label: "This year" },
];

export const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];
export const FREQUENCY_LABEL = Object.fromEntries(FREQUENCIES.map((f) => [f.value, f.label])) as Record<
  Frequency,
  string
>;

export const DATE_FORMATS: { value: DateFormat; label: string }[] = [
  { value: "DD MMM YYYY", label: "24 Oct 2026" },
  { value: "DD/MM/YYYY", label: "24/10/2026" },
  { value: "MM/DD/YYYY", label: "10/24/2026" },
  { value: "YYYY-MM-DD", label: "2026-10-24" },
];

export const NUMBER_FORMATS: { value: NumberFormat; label: string }[] = [
  { value: "en-IN", label: "Indian (₹12,50,000)" },
  { value: "en-US", label: "International (₹1,250,000)" },
];

export const TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Australia/Sydney",
  "UTC",
];

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  utensils: Utensils,
  "shopping-basket": ShoppingBasket,
  car: Car,
  "shopping-bag": ShoppingBag,
  home: House,
  zap: Zap,
  clapperboard: Clapperboard,
  "heart-pulse": HeartPulse,
  "graduation-cap": GraduationCap,
  plane: Plane,
  repeat: Repeat,
  sparkles: Sparkles,
  "trending-up": TrendingUp,
  circle: Circle,
  briefcase: Briefcase,
  laptop: Laptop,
  landmark: Landmark,
  gift: Gift,
  coffee: Coffee,
  pizza: Pizza,
  fuel: Fuel,
  bus: Bus,
  shirt: Shirt,
  dumbbell: Dumbbell,
  music: Music,
  "gamepad-2": Gamepad2,
  baby: Baby,
  "paw-print": PawPrint,
  wifi: Wifi,
  phone: Phone,
  shield: Shield,
  wrench: Wrench,
  "book-open": BookOpen,
  receipt: Receipt,
  wallet: Wallet,
};

export function categoryIcon(name?: string | null): LucideIcon {
  return (name && CATEGORY_ICONS[name]) || Circle;
}

export const CATEGORY_COLORS = [
  "#f97316",
  "#84cc16",
  "#0ea5e9",
  "#ec4899",
  "#8b5cf6",
  "#eab308",
  "#f43f5e",
  "#14b8a6",
  "#6366f1",
  "#06b6d4",
  "#a855f7",
  "#22c55e",
  "#64748b",
  "#b45309",
];

export const GOAL_COLORS = ["#16a34a", "#2563eb", "#9333ea", "#ea580c", "#0891b2", "#db2777", "#ca8a04", "#475569"];
