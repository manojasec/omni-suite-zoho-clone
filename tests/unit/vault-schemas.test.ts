import { describe, it, expect } from "vitest";
import {
  vaultFolderSchema,
  vaultItemSchema,
  vaultItemUpdateSchema,
  generatePassword,
  estimateStrength,
  VAULT_ITEM_TYPES,
} from "@/modules/vault/schemas";

describe("vault schemas", () => {
  it("validates a folder name", () => {
    expect(vaultFolderSchema.safeParse({ name: "Personal" }).success).toBe(true);
    expect(vaultFolderSchema.safeParse({ name: "" }).success).toBe(false);
    expect(vaultFolderSchema.safeParse({ name: "x".repeat(161) }).success).toBe(false);
  });

  it("requires name and secret on create", () => {
    const ok = vaultItemSchema.safeParse({ name: "GitHub", secret: "pw" });
    expect(ok.success).toBe(true);
    expect(vaultItemSchema.safeParse({ name: "", secret: "pw" }).success).toBe(false);
    expect(vaultItemSchema.safeParse({ name: "GitHub", secret: "" }).success).toBe(false);
  });

  it("coerces empty strings to undefined for optional fields", () => {
    const r = vaultItemSchema.safeParse({
      name: "GitHub",
      secret: "pw",
      username: "",
      url: "",
      notes: "",
      folderId: "",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.username).toBeUndefined();
      expect(r.data.url).toBeUndefined();
      expect(r.data.notes).toBeUndefined();
      expect(r.data.folderId).toBeUndefined();
    }
  });

  it("allows blank secret on update (keep existing)", () => {
    const r = vaultItemUpdateSchema.safeParse({ name: "x", secret: "" });
    expect(r.success).toBe(true);
  });

  it("rejects invalid item type", () => {
    expect(vaultItemSchema.safeParse({ name: "x", secret: "pw", type: "BOGUS" }).success).toBe(false);
  });

  it("exposes the expected item types", () => {
    expect(VAULT_ITEM_TYPES).toEqual(["LOGIN", "NOTE", "CARD"]);
  });

  it("generates passwords of the requested length", () => {
    expect(generatePassword(16).length).toBe(16);
    expect(generatePassword(32).length).toBe(32);
  });

  it("scores password strength", () => {
    expect(estimateStrength("a").score).toBeLessThanOrEqual(1);
    expect(estimateStrength("Abcdefgh1!XyZ").score).toBeGreaterThanOrEqual(3);
  });
});
