import { describe, expect, it } from "vitest";
import { toTransactionInput, transactionFormSchema, type TransactionFormValues } from "@/lib/validations/transaction";

const base: TransactionFormValues = {
  type: "expense",
  amount: "450",
  description: "Lunch",
  category_id: "",
  account_id: "acc-1",
  to_account_id: "",
  occurred_on: "2026-10-24",
  occurred_time: "",
  payment_method: "upi",
  notes: "",
  tags: "",
};

const errorsFor = (v: Partial<TransactionFormValues>) => {
  const r = transactionFormSchema.safeParse({ ...base, ...v });
  return r.success ? {} : Object.fromEntries(r.error.issues.map((i) => [i.path.join("."), i.message]));
};

describe("transaction form schema", () => {
  it("accepts a valid expense", () => {
    expect(transactionFormSchema.safeParse(base).success).toBe(true);
  });

  it.each(["", "0", "0.00", "-10", "abc", "1.234"])("rejects invalid amount %j", (amount) => {
    expect(errorsFor({ amount })).toHaveProperty("amount");
  });

  it("requires description and account", () => {
    const e = errorsFor({ description: "  ", account_id: "" });
    expect(e).toHaveProperty("description");
    expect(e).toHaveProperty("account_id");
  });

  it("requires a distinct destination for transfers", () => {
    expect(errorsFor({ type: "transfer", to_account_id: "" })).toHaveProperty("to_account_id");
    expect(errorsFor({ type: "transfer", to_account_id: "acc-1" })["to_account_id"]).toMatch(/differ/);
    expect(errorsFor({ type: "transfer", to_account_id: "acc-2" })).toEqual({});
  });

  it("limits tags", () => {
    expect(errorsFor({ tags: Array.from({ length: 11 }, (_, i) => `t${i}`).join(",") })).toHaveProperty("tags");
  });

  it("maps form values to the API payload in paise", () => {
    const input = toTransactionInput({ ...base, amount: "1,250.50", tags: "work, trip, work", notes: " ", category_id: "cat" });
    expect(input).toMatchObject({ amount: 125_050, tags: ["work", "trip"], notes: null, category_id: "cat", to_account_id: null });
  });

  it("drops category and payment method for transfers", () => {
    const input = toTransactionInput({ ...base, type: "transfer", to_account_id: "acc-2", category_id: "cat", payment_method: "" });
    expect(input).toMatchObject({ category_id: null, to_account_id: "acc-2", payment_method: null });
  });
});
