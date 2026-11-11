"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { PreferencesProvider } from "@/components/providers/preferences-provider";
import { TransactionDialogProvider } from "@/components/providers/transaction-dialog-provider";
import { getSupabase } from "@/lib/supabase/client";
import { DemoBanner } from "./demo-banner";
import { MobileBottomBar, MobileMenuSheet, MobileTopBar } from "./mobile-nav";
import { Sidebar } from "./sidebar";

const COLLAPSE_KEY = "fintrack.sidebar.collapsed";

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate a per-device UI preference
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* storage unavailable */
    }
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !c;
    });
  }, []);

  // React to sign-out in another tab or a revoked session.
  useEffect(() => {
    const { data } = getSupabase().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.replace("/login");
    });
    return () => data.subscription.unsubscribe();
  }, [router]);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  return (
    <PreferencesProvider>
      <TransactionDialogProvider>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm"
        >
          Skip to content
        </a>
        <div className="flex min-h-dvh">
          <Sidebar collapsed={collapsed} onToggle={toggle} />
          <div className="flex min-w-0 flex-1 flex-col">
            <MobileTopBar onMenu={() => setMenuOpen(true)} />
            <main id="main" className="mx-auto w-full max-w-[1400px] flex-1 px-4 pt-5 pb-24 sm:px-6 lg:px-8 lg:pt-7 lg:pb-10">
              <DemoBanner />
              {children}
            </main>
          </div>
        </div>
        <MobileBottomBar onMore={() => setMenuOpen(true)} />
        <MobileMenuSheet open={menuOpen} onClose={closeMenu} />
      </TransactionDialogProvider>
    </PreferencesProvider>
  );
}
