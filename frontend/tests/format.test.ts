import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatINR,
  formatINRCompact,
  formatPercent,
  paiseToRupeeInput,
  rupeesToPaise,
  shiftMonth,
} from "@/lib/format";

describe("formatINR", () => {
  it("uses Indian digit grouping", () => {
    expect(formatINR(125_000)).toBe("₹1,250");
    expect(formatINR(1_250_000)).toBe("₹12,500");
    expect(formatINR(12_500_000)).toBe("₹1,25,000");
    expect(formatINR(125_000_000)).toBe("₹12,50,000");
  });

  it("shows paise only when present (auto)", () => {
    expect(formatINR(125_050)).toBe("₹1,250.50");
    expect(formatINR(125_005)).toBe("₹1,250.05");
    expect(formatINR(125_000, { decimals: "always" })).toBe("₹1,250.00");
    expect(formatINR(125_050, { decimals: "never" })).toBe("₹1,251");
  });

  it("formats negatives and signed values", () => {
    expect(formatINR(-1_250_000)).toBe("-₹12,500");
    expect(formatINR(45_000, { signed: true })).toBe("+₹450");
    expect(formatINR(0, { signed: true })).toBe("₹0");
  });

  it("supports international grouping", () => {
    expect(formatINR(125_000_000, { locale: "en-US" })).toBe("₹1,250,000");
  });

  it("compacts axis values", () => {
    expect(formatINRCompact(12_500_000)).toBe("₹1.3L");
    expect(formatINRCompact(4_500_000)).toBe("₹45K");
    expect(formatINRCompact(2_500_000_000)).toBe("₹2.5Cr");
    expect(formatINRCompact(-50_000)).toBe("-₹500");
  });
});

describe("paise conversion", () => {
  it("parses rupee input without float drift", () => {
    expect(rupeesToPaise("1250.50")).toBe(125_050);
    expect(rupeesToPaise("₹ 1,25,000")).toBe(12_500_000);
    expect(rupeesToPaise("0.1")).toBe(10);
    expect(rupeesToPaise("0.29")).toBe(29); // 0.29 * 100 = 28.999… in floats
    expect(rupeesToPaise("19.99")).toBe(1999);
  });

  it("rejects invalid input", () => {
    expect(rupeesToPaise("")).toBeNull();
    expect(rupeesToPaise("abc")).toBeNull();
    expect(rupeesToPaise("1.234")).toBeNull();
    expect(rupeesToPaise("-5")).toBeNull();
    expect(rupeesToPaise("1e5")).toBeNull();
  });

  it("round-trips paise to editable strings", () => {
    expect(paiseToRupeeInput(125_050)).toBe("1250.50");
    expect(paiseToRupeeInput(125_000)).toBe("1250");
    expect(paiseToRupeeInput(5)).toBe("0.05");
    expect(paiseToRupeeInput(-125_000)).toBe("-1250");
    for (const p of [1, 99, 100, 12_345, 9_999_999]) expect(rupeesToPaise(paiseToRupeeInput(p))).toBe(p);
  });
});

describe("dates and percents", () => {
  it("formats ISO dates without timezone shifts", () => {
    expect(formatDate("2026-01-01")).toBe("01 Jan 2026");
    expect(formatDate("2026-10-24", "DD/MM/YYYY")).toBe("24/10/2026");
    expect(formatDate("2026-10-24", "MM/DD/YYYY")).toBe("10/24/2026");
    expect(formatDate(null)).toBe("—");
  });

  it("shifts months across year boundaries", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });

  it("formats percentages", () => {
    expect(formatPercent(31.234)).toBe("31.2%");
    expect(formatPercent(null)).toBe("—");
  });
});
