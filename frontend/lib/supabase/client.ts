"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

let client: SupabaseClient | null = null;

/** Browser Supabase client (anon/publishable key only). Session lives in cookies. */
export function getSupabase(): SupabaseClient {
  if (!client) client = createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
  return client;
}
