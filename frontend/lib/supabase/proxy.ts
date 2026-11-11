import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env, isConfigured } from "@/lib/env";

export const AUTH_ROUTES = ["/login", "/signup", "/forgot-password"];
export const APP_ROUTES = [
  "/dashboard",
  "/transactions",
  "/accounts",
  "/budgets",
  "/analytics",
  "/savings",
  "/recurring",
  "/settings",
];

const matches = (path: string, routes: string[]) =>
  routes.some((r) => path === r || path.startsWith(`${r}/`));

/** Refreshes the Supabase session cookie and applies optimistic route guards. */
export async function updateSession(request: NextRequest) {
  if (!isConfigured()) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getUser() validates the token with Supabase Auth (getSession() would not).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  const redirect = (to: string, keepNext = false) => {
    const url = request.nextUrl.clone();
    url.pathname = to;
    url.search = "";
    if (keepNext) url.searchParams.set("next", path + request.nextUrl.search);
    const res = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

  if (!user && matches(path, APP_ROUTES)) return redirect("/login", true);
  if (user && (matches(path, AUTH_ROUTES) || path === "/")) return redirect("/dashboard");
  return response;
}
