import { describe, it, expect } from "vitest";
import {
  ledgerAccountSchema,
  journalLineSchema,
  journalEntrySchema,
  bankAccountSchema,
  bankTransactionSchema,
  normalBalance,
  aggregateLines,
} from "@/modules/accounting/schemas";

describe("ledgerAccountSchema", () => {
  it("accepts valid input", () => {
    expect(ledgerAccountSchema.safeParse({ code: "1010", name: "Cash", type: "ASSET" }).success).toBe(true);
    expect(ledgerAccountSchema.safeParse({ code: "A-1.0", name: "Cash", type: "ASSET" }).success).toBe(true);
  });
  it("rejects invalid code chars", () => {
    expect(ledgerAccountSchema.safeParse({ code: "1010 Cash", name: "Cash", type: "ASSET" }).success).toBe(false);
    expect(ledgerAccountSchema.safeParse({ code: "", name: "Cash", type: "ASSET" }).success).toBe(false);
  });
  it("rejects unknown type", () => {
    expect(ledgerAccountSchema.safeParse({ code: "1010", name: "Cash", type: "FOO" as never }).success).toBe(false);
  });
});

describe("journalLineSchema", () => {
  it("rejects both debit and credit", () => {
    expect(journalLineSchema.safeParse({ accountId: "a", debit: 5, credit: 5 }).success).toBe(false);
  });
  it("rejects all-zero", () => {
    expect(journalLineSchema.safeParse({ accountId: "a", debit: 0, credit: 0 }).success).toBe(false);
  });
  it("accepts debit-only and credit-only", () => {
    expect(journalLineSchema.safeParse({ accountId: "a", debit: 5, credit: 0 }).success).toBe(true);
    expect(journalLineSchema.safeParse({ accountId: "a", debit: 0, credit: 5 }).success).toBe(true);
  });
});

describe("journalEntrySchema", () => {
  const base = { reference: "JE-1", date: "2025-01-01", memo: "" };
  it("rejects unbalanced via cents", () => {
    const r = journalEntrySchema.safeParse({
      ...base,
      lines: [
        { accountId: "a", debit: 100.10, credit: 0 },
        { accountId: "b", debit: 0, credit: 100.11 },
      ],
    });
    expect(r.success).toBe(false);
  });
  it("accepts balanced multi-line", () => {
    const r = journalEntrySchema.safeParse({
      ...base,
      lines: [
        { accountId: "a", debit: 100, credit: 0 },
        { accountId: "b", debit: 50, credit: 0 },
        { accountId: "c", debit: 0, credit: 150 },
      ],
    });
    expect(r.success).toBe(true);
  });
  it("rejects fewer than 2 lines", () => {
    const r = journalEntrySchema.safeParse({
      ...base,
      lines: [{ accountId: "a", debit: 10, credit: 0 }],
    });
    expect(r.success).toBe(false);
  });
});

describe("normalBalance", () => {
  it("debit-normal types", () => {
    expect(normalBalance({ accountId: "a", type: "ASSET", debit: 100, credit: 30 })).toBe(70);
    expect(normalBalance({ accountId: "a", type: "EXPENSE", debit: 50, credit: 0 })).toBe(50);
  });
  it("credit-normal types", () => {
    expect(normalBalance({ accountId: "a", type: "LIABILITY", debit: 10, credit: 40 })).toBe(30);
    expect(normalBalance({ accountId: "a", type: "EQUITY", debit: 0, credit: 100 })).toBe(100);
    expect(normalBalance({ accountId: "a", type: "INCOME", debit: 5, credit: 25 })).toBe(20);
  });
});

describe("aggregateLines", () => {
  it("sums per account", () => {
    const m = aggregateLines([
      { accountId: "a", debit: 10, credit: 0 },
      { accountId: "a", debit: 5, credit: 2 },
      { accountId: "b", debit: 0, credit: 7 },
    ]);
    expect(m.get("a")).toEqual({ debit: 15, credit: 2 });
    expect(m.get("b")).toEqual({ debit: 0, credit: 7 });
  });
});

describe("bankAccountSchema", () => {
  it("accepts valid currency", () => {
    expect(bankAccountSchema.safeParse({ ledgerAccountId: "x", name: "Op", currency: "USD" }).success).toBe(true);
  });
  it("rejects bad currency", () => {
    expect(bankAccountSchema.safeParse({ ledgerAccountId: "x", name: "Op", currency: "usd" }).success).toBe(false);
    expect(bankAccountSchema.safeParse({ ledgerAccountId: "x", name: "Op", currency: "DOLLAR" }).success).toBe(false);
  });
  it("rejects long account number suffix", () => {
    expect(bankAccountSchema.safeParse({ ledgerAccountId: "x", name: "Op", currency: "USD", accountNumberLast4: "12345" }).success).toBe(false);
  });
});

describe("bankTransactionSchema", () => {
  it("rejects zero amount", () => {
    expect(bankTransactionSchema.safeParse({ date: "2025-01-01", description: "x", amount: 0 }).success).toBe(false);
  });
  it("accepts negative", () => {
    expect(bankTransactionSchema.safeParse({ date: "2025-01-01", description: "x", amount: -42.5 }).success).toBe(true);
  });
});
