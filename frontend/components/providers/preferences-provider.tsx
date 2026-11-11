"use client";

import { useTheme } from "next-themes";
import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useProfile } from "@/hooks/queries";
import { formatDate, formatINR, formatINRCompact, todayISO, type MoneyOptions } from "@/lib/format";
import type { Preferences } from "@/types/api";

export const DEFAULT_PREFERENCES: Preferences = {
  currency: "INR",
  default_period: "this_month",
  theme: "system",
  date_format: "DD MMM YYYY",
  number_format: "en-IN",
  timezone: "Asia/Kolkata",
  onboarding_dismissed: false,
};

interface PreferencesContextValue {
  prefs: Preferences;
  loaded: boolean;
  money: (paise: number, opts?: Omit<MoneyOptions, "locale">) => string;
  compact: (paise: number) => string;
  date: (iso: string | null | undefined) => string;
  today: () => string;
}

const defaultValue: PreferencesContextValue = {
  prefs: DEFAULT_PREFERENCES,
  loaded: false,
  money: (p, o) => formatINR(p, { ...o, locale: "en-IN" }),
  compact: (p) => formatINRCompact(p, "en-IN"),
  date: (d) => formatDate(d, "DD MMM YYYY"),
  today: () => todayISO("Asia/Kolkata"),
};

const PreferencesContext = createContext<PreferencesContextValue>(defaultValue);

export function usePreferences() {
  return useContext(PreferencesContext);
}

/** Loads the user's preferences once and applies them app-wide. */
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { data } = useProfile();
  const { setTheme } = useTheme();
  const appliedTheme = useRef(false);

  useEffect(() => {
    if (data && !appliedTheme.current) {
      appliedTheme.current = true;
      setTheme(data.preferences.theme);
    }
  }, [data, setTheme]);

  const value = useMemo<PreferencesContextValue>(() => {
    const prefs = data?.preferences ?? DEFAULT_PREFERENCES;
    return {
      prefs,
      loaded: !!data,
      money: (p, o) => formatINR(p, { ...o, locale: prefs.number_format }),
      compact: (p) => formatINRCompact(p, prefs.number_format),
      date: (d) => formatDate(d, prefs.date_format),
      today: () => todayISO(prefs.timezone),
    };
  }, [data]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function TestPreferencesProvider({ children, prefs }: { children: ReactNode; prefs?: Partial<Preferences> }) {
  const p = { ...DEFAULT_PREFERENCES, ...prefs };
  const value: PreferencesContextValue = {
    prefs: p,
    loaded: true,
    money: (v, o) => formatINR(v, { ...o, locale: p.number_format }),
    compact: (v) => formatINRCompact(v, p.number_format),
    date: (d) => formatDate(d, p.date_format),
    today: () => todayISO(p.timezone),
  };
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}
