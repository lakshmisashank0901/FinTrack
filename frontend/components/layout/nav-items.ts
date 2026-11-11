import {
  ArrowLeftRight,
  CalendarClock,
  ChartColumn,
  LayoutDashboard,
  PiggyBank,
  Settings,
  Target,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/accounts", label: "Accounts", icon: Wallet },
  { href: "/budgets", label: "Budgets", icon: Target },
  { href: "/analytics", label: "Analytics", icon: ChartColumn },
  { href: "/savings", label: "Savings Goals", icon: PiggyBank },
  { href: "/recurring", label: "Recurring Payments", icon: CalendarClock },
  { href: "/settings", label: "Settings", icon: Settings },
];

export const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);
