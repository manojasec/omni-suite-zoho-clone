import { describe, expect, it } from "vitest";
import {
  ROLE_MATRIX,
  RESOURCES,
  ACTIONS,
  can,
  assertCan,
  PermissionError,
} from "@/platform/permissions/matrix";
import type { SystemRole } from "@prisma/client";

const ROLES: SystemRole[] = [
  "OWNER",
  "ADMIN",
  "MANAGER",
  "SALES",
  "FINANCE",
  "AGENT",
  "MEMBER",
  "VIEWER",
];

describe("permission matrix", () => {
  it("defines an entry for every (role × resource) pair", () => {
    for (const role of ROLES) {
      for (const resource of RESOURCES) {
        expect(
          ROLE_MATRIX[role][resource],
          `missing entry: ${role} × ${resource}`,
        ).toBeDefined();
      }
    }
  });

  it("OWNER has every action on every resource", () => {
    for (const resource of RESOURCES) {
      for (const action of ACTIONS) {
        expect(can("OWNER", resource, action)).toBe(true);
      }
    }
  });

  it("VIEWER can never write", () => {
    const writes = ["create", "edit", "delete", "send", "assign", "manage"] as const;
    for (const resource of RESOURCES) {
      for (const action of writes) {
        expect(can("VIEWER", resource, action)).toBe(false);
      }
    }
  });

  it("VIEWER cannot view billing or audit logs", () => {
    expect(can("VIEWER", "settings.billing", "view")).toBe(false);
    expect(can("VIEWER", "auditLog", "view")).toBe(false);
  });

  it("SALES has full deal CRUD but no billing access", () => {
    expect(can("SALES", "deal", "create")).toBe(true);
    expect(can("SALES", "deal", "edit")).toBe(true);
    expect(can("SALES", "deal", "delete")).toBe(true);
    expect(can("SALES", "deal", "assign")).toBe(true);
    expect(can("SALES", "settings.billing", "view")).toBe(false);
    expect(can("SALES", "settings.users", "view")).toBe(false);
  });

  it("FINANCE owns invoices but cannot manage users", () => {
    expect(can("FINANCE", "invoice", "create")).toBe(true);
    expect(can("FINANCE", "invoice", "send")).toBe(true);
    expect(can("FINANCE", "settings.billing", "manage")).toBe(true);
    expect(can("FINANCE", "settings.users", "view")).toBe(false);
    expect(can("FINANCE", "deal", "edit")).toBe(false);
  });

  it("AGENT manages tickets, cannot touch deals or invoices", () => {
    expect(can("AGENT", "ticket", "create")).toBe(true);
    expect(can("AGENT", "ticket", "assign")).toBe(true);
    expect(can("AGENT", "ticket", "send")).toBe(true);
    expect(can("AGENT", "deal", "view")).toBe(false);
    expect(can("AGENT", "invoice", "view")).toBe(false);
  });

  it("MANAGER cannot edit billing", () => {
    expect(can("MANAGER", "settings.billing", "edit")).toBe(false);
    expect(can("MANAGER", "settings.billing", "view")).toBe(true);
    expect(can("MANAGER", "deal", "delete")).toBe(true);
  });

  it("assertCan throws PermissionError for forbidden actions", () => {
    expect(() => assertCan("VIEWER", "contact", "create")).toThrow(PermissionError);
    expect(() => assertCan("OWNER", "contact", "create")).not.toThrow();
  });

  it("PermissionError carries the resource, action, and role", () => {
    try {
      assertCan("VIEWER", "invoice", "delete");
    } catch (e) {
      expect(e).toBeInstanceOf(PermissionError);
      const err = e as PermissionError;
      expect(err.resource).toBe("invoice");
      expect(err.action).toBe("delete");
      expect(err.role).toBe("VIEWER");
    }
  });
});
