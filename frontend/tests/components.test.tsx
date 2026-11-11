import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = {
  getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "tok" } } }),
  refreshSession: vi.fn(),
  signOut: vi.fn(),
};
vi.mock("@/lib/supabase/client", () => ({ getSupabase: () => ({ auth }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(),
}));

import { ChartFrame } from "@/components/charts/chart-frame";
import { DonutChart } from "@/components/charts/donut-chart";
import { StatCard } from "@/components/dashboard/stat-card";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { TestPreferencesProvider } from "@/components/providers/preferences-provider";
import { TransactionFormDialog } from "@/components/transactions/transaction-form-dialog";
import type { Summary } from "@/types/api";

function wrap(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TestPreferencesProvider>{ui}</TestPreferencesProvider>
    </QueryClientProvider>,
  );
}

const range = {
  period: "this_month" as const,
  start_date: "2026-10-01",
  end_date: "2026-10-24",
  previous_start_date: "2026-09-01",
  previous_end_date: "2026-09-24",
  days: 24,
};

function summary(overrides: Partial<Summary> = {}): Summary {
  return {
    range,
    balance: { net_worth: 12_500_000, assets: 13_000_000, liabilities: 500_000, period_change: 2_000_000, accounts: [] },
    income: { current: 8_000_000, previous: 7_000_000, change_percent: 14.3 },
    expenses: { current: 6_000_000, previous: 5_000_000, change_percent: 20 },
    refunds: { current: 0 },
    net_cash_flow: { current: 2_000_000, previous: 2_000_000 },
    savings_rate: { current: 25, previous: 28.6, change_points: -3.6 },
    average_daily_spending: 250_000,
    largest_expense: null,
    top_category: null,
    transaction_count: 12,
    has_previous_data: true,
    budget_utilization: null,
    ...overrides,
  };
}

describe("StatCard", () => {
  it("shows a comparison only when a delta is provided", () => {
    const { rerender } = wrap(<StatCard label="Income" value="₹80,000" footnote="No earlier data to compare" />);
    expect(screen.queryByText(/vs /)).not.toBeInTheDocument();
    expect(screen.getByText("No earlier data to compare")).toBeInTheDocument();
    rerender(
      <TestPreferencesProvider>
        <StatCard label="Income" value="₹80,000" delta={{ value: 12.5, upIsGood: true, comparedTo: "last month" }} />
      </TestPreferencesProvider>,
    );
    expect(screen.getByText("+12.5%")).toBeInTheDocument();
    expect(screen.getByText("vs last month")).toBeInTheDocument();
  });
});

describe("SummaryCards", () => {
  it("renders INR values and comparisons from the API", () => {
    wrap(<SummaryCards summary={summary()} isLoading={false} />);
    expect(screen.getByText("₹1,25,000")).toBeInTheDocument();
    expect(screen.getByText("₹80,000")).toBeInTheDocument();
    expect(screen.getByText("+20%")).toBeInTheDocument();
    expect(screen.getByText("-3.6 pts")).toBeInTheDocument();
  });

  it("hides comparisons when there is no previous data", () => {
    wrap(
      <SummaryCards
        summary={summary({
          has_previous_data: false,
          income: { current: 8_000_000, previous: null, change_percent: null },
          expenses: { current: 6_000_000, previous: null, change_percent: null },
          savings_rate: { current: 25, previous: null, change_points: null },
        })}
        isLoading={false}
      />,
    );
    expect(screen.queryByText(/^vs /)).not.toBeInTheDocument();
    expect(screen.getAllByText("No earlier data to compare")).toHaveLength(2);
  });

  it("shows a dash for savings rate without income", () => {
    wrap(<SummaryCards summary={summary({ savings_rate: { current: null, previous: null, change_points: null } })} isLoading={false} />);
    expect(screen.getByText("Needs income in this period")).toBeInTheDocument();
  });
});

describe("ChartFrame", () => {
  it("shows a meaningful empty state instead of a chart", () => {
    wrap(
      <ChartFrame title="Where your money goes" isEmpty emptyTitle="No spending yet">
        <div>chart-body</div>
      </ChartFrame>,
    );
    expect(screen.getByText("No spending yet")).toBeInTheDocument();
    expect(screen.queryByText("chart-body")).not.toBeInTheDocument();
  });

  it("offers a data table view", async () => {
    wrap(
      <ChartFrame title="Trend" table={{ columns: ["Period", "Spent"], rows: [["1 Oct", "₹450"]] }}>
        <div>chart-body</div>
      </ChartFrame>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Show data table" }));
    expect(screen.getByRole("cell", { name: "₹450" })).toBeInTheDocument();
  });
});

describe("DonutChart", () => {
  it("re-renders its legend when the data changes", () => {
    const first = [{ key: "a", name: "Food & Dining", amount: 500_000, percent: 100, color: "#f97316" }];
    const second = [
      { key: "a", name: "Food & Dining", amount: 300_000, percent: 60, color: "#f97316" },
      { key: "b", name: "Travel", amount: 200_000, percent: 40, color: "#06b6d4" },
    ];
    const { rerender } = wrap(<DonutChart items={first} total={500_000} />);
    expect(screen.getAllByText("₹5,000").length).toBeGreaterThan(0);
    expect(screen.queryByText("Travel")).not.toBeInTheDocument();
    rerender(
      <TestPreferencesProvider>
        <DonutChart items={second} total={500_000} />
      </TestPreferencesProvider>,
    );
    expect(screen.getByText("Travel")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
    expect(screen.getByText("₹3,000")).toBeInTheDocument();
  });

  it("calls onSelect when a legend item is chosen", async () => {
    const onSelect = vi.fn();
    wrap(
      <DonutChart
        items={[{ key: "cat-1", name: "Groceries", amount: 100, percent: 100, color: "#84cc16" }]}
        total={100}
        onSelect={onSelect}
        selectLabel={(i) => `View ${i.name} transactions`}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "View Groceries transactions" }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ key: "cat-1" }));
  });
});

describe("TransactionFormDialog", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const body = (b: unknown, status = 200) =>
        new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
      if (url.includes("/api/accounts"))
        return body({
          items: [
            { id: "acc-1", name: "HDFC Savings", type: "savings", is_archived: false },
            { id: "acc-2", name: "Cash", type: "cash", is_archived: false },
          ],
          totals: { assets: 0, liabilities: 0, net_worth: 0 },
        });
      if (url.includes("/api/categories")) return body([{ id: "c1", name: "Groceries", kind: "expense", is_archived: false }]);
      if (url.includes("/api/transactions") && init?.method === "POST") return body({ id: "t1", description: "x" }, 201);
      return body({});
    });
  });
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("shows validation messages and does not submit invalid input", async () => {
    wrap(<TransactionFormDialog open onClose={() => {}} />);
    await screen.findByRole("option", { name: "HDFC Savings" });
    await userEvent.click(screen.getByRole("button", { name: "Add transaction" }));
    expect(await screen.findByText("Enter an amount")).toBeInTheDocument();
    expect(screen.getByText("Add a short description")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });

  it("submits amounts in paise with an idempotency key", async () => {
    const onClose = vi.fn();
    wrap(<TransactionFormDialog open onClose={onClose} />);
    await screen.findByRole("option", { name: "HDFC Savings" });
    await userEvent.type(screen.getByLabelText("Amount"), "1250.50");
    await userEvent.type(screen.getByLabelText("Description"), "Weekly groceries");
    await userEvent.click(screen.getByRole("button", { name: "Add transaction" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST")!;
    const sent = JSON.parse(post[1].body);
    expect(sent).toMatchObject({ type: "expense", amount: 125_050, description: "Weekly groceries", account_id: "acc-1" });
    expect(sent.client_request_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("requires a destination account for transfers", async () => {
    wrap(<TransactionFormDialog open onClose={() => {}} />);
    await screen.findByRole("option", { name: "HDFC Savings" });
    await userEvent.click(screen.getByRole("radio", { name: "Transfer" }));
    await userEvent.type(screen.getByLabelText("Amount"), "500");
    await userEvent.type(screen.getByLabelText("Description"), "Move to cash");
    await userEvent.click(screen.getByRole("button", { name: "Add transaction" }));
    expect(await screen.findByText("Choose the destination account")).toBeInTheDocument();
  });
});
