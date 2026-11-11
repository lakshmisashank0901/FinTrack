import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { ConfigError } from "@/components/layout/config-error";
import { AppProviders } from "@/components/providers/app-providers";
import { missingEnv } from "@/lib/env";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "FinTrack", template: "%s · FinTrack" },
  description: "Track smarter. Spend better. Save more.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f6" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0c0d" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const missing = missingEnv();
  return (
    <html lang="en-IN" suppressHydrationWarning className={`${inter.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full">
        <AppProviders>{missing.length ? <ConfigError missing={missing} /> : children}</AppProviders>
      </body>
    </html>
  );
}
