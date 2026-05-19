import { describe, it, expect } from "vitest";
import { DEFAULT_ACCOUNTS } from "@/modules/accounting/posting";

describe("accounting posting — defaults", () => {
  it("exposes a stable chart-of-accounts code map", () => {
    expect(DEFAULT_ACCOUNTS.CASH).toBe("1000");
    expect(DEFAULT_ACCOUNTS.AR).toBe("1100");
    expect(DEFAULT_ACCOUNTS.AP).toBe("2100");
    expect(DEFAULT_ACCOUNTS.TAX_PAYABLE).toBe("2200");
    expect(DEFAULT_ACCOUNTS.SALES).toBe("4000");
    expect(DEFAULT_ACCOUNTS.EXPENSE).toBe("6000");
  });

  it("all default codes are unique", () => {
    const values = Object.values(DEFAULT_ACCOUNTS);
    expect(new Set(values).size).toBe(values.length);
  });
});

// Note: full posting flow tests require a Prisma test DB.
// Those are covered by integration tests under tests/integration/.
