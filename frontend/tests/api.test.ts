import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = {
  getSession: vi.fn(),
  refreshSession: vi.fn(),
  signOut: vi.fn(),
};
vi.mock("@/lib/supabase/client", () => ({ getSupabase: () => ({ auth }) }));

import { ApiError, api, buildQuery } from "@/lib/api";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("api client", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    auth.getSession.mockResolvedValue({ data: { session: { access_token: "tok-1" } } });
    auth.refreshSession.mockResolvedValue({ data: { session: null }, error: new Error("no") });
    auth.signOut.mockResolvedValue({});
  });
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("sends the bearer token and parses JSON", async () => {
    fetchMock.mockResolvedValue(json(200, { items: [], totals: { assets: 0, liabilities: 0, net_worth: 0 } }));
    const res = await api.accounts.list();
    expect(res.items).toEqual([]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:8000/api/accounts?include_archived=false");
    expect(init.headers.Authorization).toBe("Bearer tok-1");
  });

  it("serialises repeatable filters", () => {
    expect(buildQuery({ type: ["income", "refund"], search: "", page: 2, x: undefined })).toBe("?type=income&type=refund&page=2");
  });

  it("maps error envelopes to ApiError", async () => {
    fetchMock.mockResolvedValue(json(409, { error: { code: "account_in_use", message: "Account has transactions" } }));
    const err = await api.accounts.remove("a1").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 409, code: "account_in_use", message: "Account has transactions" });
  });

  it("exposes validation details", async () => {
    fetchMock.mockResolvedValue(
      json(422, { error: { code: "validation_error", message: "Invalid", details: [{ loc: ["body", "amount"], msg: "must be > 0" }] } }),
    );
    const err = (await api.transactions.create({} as never).catch((e) => e)) as ApiError;
    expect(err.details?.[0]).toEqual({ loc: ["body", "amount"], msg: "must be > 0" });
  });

  it("refreshes once on 401 and retries with the new token", async () => {
    auth.refreshSession.mockResolvedValue({ data: { session: { access_token: "tok-2" } }, error: null });
    fetchMock.mockResolvedValueOnce(json(401, { error: { code: "unauthorized", message: "expired" } }));
    fetchMock.mockResolvedValueOnce(json(200, { loaded: false }));
    await expect(api.demo.status()).resolves.toEqual({ loaded: false });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe("Bearer tok-2");
  });

  it("signs out when the session can't be refreshed", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign, pathname: "/budgets", search: "" });
    fetchMock.mockResolvedValue(json(401, {}));
    const err = await api.demo.status().catch((e) => e);
    expect(err).toMatchObject({ status: 401, code: "unauthorized" });
    expect(auth.signOut).toHaveBeenCalled();
    expect(assign).toHaveBeenCalledWith(expect.stringContaining("/login?next=%2Fbudgets"));
  });

  it("reports network failures clearly", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(api.profile.get()).rejects.toMatchObject({ code: "network_error" });
  });
});
