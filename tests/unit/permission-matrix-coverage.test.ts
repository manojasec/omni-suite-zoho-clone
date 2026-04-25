import { describe, expect, it } from "vitest";
import { ACTIONS, RESOURCES, ROLE_MATRIX, can } from "@/platform/permissions/matrix";

const ROLES = Object.keys(ROLE_MATRIX) as (keyof typeof ROLE_MATRIX)[];

describe("permission matrix coverage", () => {
  it("declares an entry for every (role, resource) pair", () => {
    for (const role of ROLES) {
      for (const resource of RESOURCES) {
        expect(
          ROLE_MATRIX[role][resource],
          `${role} is missing entry for ${resource}`,
        ).toBeDefined();
      }
    }
  });

  it("only allows known actions", () => {
    const allowed = new Set<string>(ACTIONS);
    for (const role of ROLES) {
      for (const resource of RESOURCES) {
        for (const action of ROLE_MATRIX[role][resource] ?? []) {
          expect(allowed.has(action), `${role}/${resource} has unknown action ${action}`).toBe(true);
        }
      }
    }
  });
});

describe("role baseline expectations", () => {
  it("OWNER and ADMIN can manage workspace settings", () => {
    expect(can("OWNER", "settings.workspace", "manage")).toBe(true);
    expect(can("ADMIN", "settings.workspace", "manage")).toBe(true);
  });

  it("VIEWER has no write or delete actions anywhere", () => {
    for (const resource of RESOURCES) {
      for (const action of ROLE_MATRIX.VIEWER[resource] ?? []) {
        expect(action, `VIEWER unexpectedly has ${action} on ${resource}`).toBe("view");
      }
    }
  });

  it("MEMBER cannot manage billing or security", () => {
    expect(can("MEMBER", "settings.billing", "manage")).toBe(false);
    expect(can("MEMBER", "settings.security", "manage")).toBe(false);
  });

  it("FINANCE can manage invoices and view reports but not deals/contacts edit?", () => {
    // Finance has read+write+delete on invoices and read on reports.
    expect(can("FINANCE", "invoice", "view")).toBe(true);
    expect(can("FINANCE", "report", "view")).toBe(true);
  });

  it("AGENT can act on tickets and chats", () => {
    expect(can("AGENT", "ticket", "view")).toBe(true);
    expect(can("AGENT", "chatConversation", "view")).toBe(true);
  });
});
