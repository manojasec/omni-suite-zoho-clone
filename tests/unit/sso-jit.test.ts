import { describe, it, expect } from "vitest";
import { buildProvisionPlan, mapAttributesToRole } from "@/modules/sso/jit";

const baseCfg = {
  emailAttr: "email",
  nameAttr: "name",
  defaultRole: "MEMBER" as const,
};

describe("jit — buildProvisionPlan", () => {
  it("CREATE when no existing user", () => {
    const plan = buildProvisionPlan(
      { email: "Alice@Example.com", name: " Alice " },
      baseCfg,
      null,
    );
    expect(plan.action).toBe("CREATE");
    expect(plan.email).toBe("alice@example.com");
    expect(plan.name).toBe("Alice");
    expect(plan.role).toBe("MEMBER");
  });

  it("falls back to local-part when name attribute missing", () => {
    const plan = buildProvisionPlan({ email: "bob@example.com" }, baseCfg, null);
    expect(plan.name).toBe("bob");
  });

  it("NOOP when nothing changes", () => {
    const plan = buildProvisionPlan(
      { email: "alice@example.com", name: "Alice" },
      baseCfg,
      { id: "u1", email: "alice@example.com", name: "Alice", role: "MEMBER" },
    );
    expect(plan.action).toBe("NOOP");
    expect(plan.changedFields).toEqual([]);
  });

  it("UPDATE lists changed fields", () => {
    const plan = buildProvisionPlan(
      { email: "alice@example.com", name: "Alice Smith" },
      baseCfg,
      { id: "u1", email: "alice@example.com", name: "Alice", role: "MEMBER" },
    );
    expect(plan.action).toBe("UPDATE");
    expect(plan.changedFields).toEqual(["name"]);
  });

  it("throws when required email attribute is missing", () => {
    expect(() => buildProvisionPlan({ name: "Bob" }, baseCfg, null)).toThrow(/email/);
  });

  it("rejects disallowed domains", () => {
    expect(() =>
      buildProvisionPlan(
        { email: "carol@evil.com", name: "Carol" },
        { ...baseCfg, allowedDomains: ["example.com"] },
        null,
      ),
    ).toThrow(/domain/);
  });

  it("uses array attributes by taking the first value", () => {
    const plan = buildProvisionPlan(
      { email: ["dave@example.com"], name: ["Dave", "Davey"] },
      baseCfg,
      null,
    );
    expect(plan.email).toBe("dave@example.com");
    expect(plan.name).toBe("Dave");
  });
});

describe("jit — mapAttributesToRole", () => {
  const cfg = {
    ...baseCfg,
    groupsAttr: "groups",
    groupRoleMap: { "sales-team": "SALES" as const, "finance-team": "FINANCE" as const },
  };

  it("returns default role when no group match", () => {
    expect(mapAttributesToRole({ groups: ["other"] }, cfg)).toBe("MEMBER");
  });

  it("maps the first matching group", () => {
    expect(mapAttributesToRole({ groups: ["sales-team", "finance-team"] }, cfg)).toBe("SALES");
  });

  it("returns default role when groupsAttr missing", () => {
    expect(mapAttributesToRole({}, cfg)).toBe("MEMBER");
  });

  it("returns default role when group mapping not configured", () => {
    expect(mapAttributesToRole({ groups: ["x"] }, baseCfg)).toBe("MEMBER");
  });
});
