import { describe, expect, it } from "vitest";
import {
  CREATOR_APP_STATUSES,
  CREATOR_APP_TRANSITIONS,
  CREATOR_FIELD_KINDS,
  canTransitionApp,
  coerceRecordData,
  creatorAppSchema,
  creatorEntitySchema,
  creatorFieldSchema,
  formatRecordValue,
  parseSelectOptions,
  slugify,
  summarizeApps,
  validateRecordData,
  type FieldDef,
} from "@/modules/creator/schemas";

describe("creator constants", () => {
  it("includes the expected statuses and field kinds", () => {
    expect(CREATOR_APP_STATUSES).toEqual(["DRAFT", "PUBLISHED", "ARCHIVED"]);
    expect(CREATOR_FIELD_KINDS).toContain("TEXT");
    expect(CREATOR_FIELD_KINDS).toContain("SELECT");
    expect(CREATOR_FIELD_KINDS).toContain("BOOLEAN");
  });
});

describe("creatorAppSchema", () => {
  it("requires a slug-shaped slug", () => {
    expect(() =>
      creatorAppSchema.parse({ name: "x", slug: "Bad Slug" }),
    ).toThrow();
    expect(
      creatorAppSchema.parse({ name: "Inventory", slug: "inventory-tracker" })
        .slug,
    ).toBe("inventory-tracker");
  });

  it("defaults status to DRAFT and trims optional fields", () => {
    const r = creatorAppSchema.parse({
      name: "x",
      slug: "x",
      description: "  ",
    });
    expect(r.status).toBe("DRAFT");
    expect(r.description).toBeUndefined();
  });
});

describe("creatorEntitySchema", () => {
  it("rejects non-identifier keys", () => {
    expect(() =>
      creatorEntitySchema.parse({ key: "Orders", label: "x" }),
    ).toThrow();
  });
  it("accepts identifier keys", () => {
    expect(
      creatorEntitySchema.parse({ key: "orders", label: "Orders" }).key,
    ).toBe("orders");
  });
});

describe("creatorFieldSchema", () => {
  it("coerces required from form values", () => {
    expect(
      creatorFieldSchema.parse({
        key: "name",
        label: "Name",
        kind: "TEXT",
        required: "on",
      }).required,
    ).toBe(true);
    expect(
      creatorFieldSchema.parse({ key: "name", label: "Name", kind: "TEXT" })
        .required,
    ).toBe(false);
  });

  it("rejects unknown kinds", () => {
    expect(() =>
      creatorFieldSchema.parse({
        key: "x",
        label: "x",
        kind: "FILE" as unknown as "TEXT",
      }),
    ).toThrow();
  });
});

describe("status transitions", () => {
  it("matches the documented matrix", () => {
    expect(CREATOR_APP_TRANSITIONS.ARCHIVED).toEqual([]);
    expect(canTransitionApp("DRAFT", "PUBLISHED")).toBe(true);
    expect(canTransitionApp("DRAFT", "ARCHIVED")).toBe(false);
    expect(canTransitionApp("PUBLISHED", "DRAFT")).toBe(true);
    expect(canTransitionApp("PUBLISHED", "ARCHIVED")).toBe(true);
    expect(canTransitionApp("ARCHIVED", "PUBLISHED")).toBe(false);
  });
});

describe("parseSelectOptions", () => {
  it("trims, splits, and drops blanks", () => {
    expect(parseSelectOptions("  a\n b \n\n c \n")).toEqual(["a", "b", "c"]);
    expect(parseSelectOptions(null)).toEqual([]);
    expect(parseSelectOptions("")).toEqual([]);
  });
});

describe("slugify", () => {
  it("normalizes arbitrary input", () => {
    expect(slugify("My App!")).toBe("my-app");
    expect(slugify("--Edge   case--")).toBe("edge-case");
    expect(slugify("Already-Good")).toBe("already-good");
  });
});

describe("validateRecordData", () => {
  const fields: FieldDef[] = [
    { key: "name", label: "Name", kind: "TEXT", required: true },
    { key: "qty", label: "Qty", kind: "NUMBER", required: false },
    { key: "due", label: "Due", kind: "DATE", required: false },
    { key: "active", label: "Active", kind: "BOOLEAN", required: false },
    { key: "email", label: "Email", kind: "EMAIL", required: false },
    { key: "url", label: "URL", kind: "URL", required: false },
    {
      key: "tier",
      label: "Tier",
      kind: "SELECT",
      required: false,
      options: ["A", "B"],
    },
  ];

  it("flags missing required fields", () => {
    const issues = validateRecordData(fields, {});
    expect(issues.find((i) => i.field === "name")).toBeDefined();
  });

  it("validates type constraints", () => {
    const issues = validateRecordData(fields, {
      name: "ok",
      qty: "not-a-number",
      due: "not-a-date",
      email: "nope",
      url: "not a url",
      tier: "Z",
    });
    const fieldsWithIssues = issues.map((i) => i.field);
    expect(fieldsWithIssues).toContain("qty");
    expect(fieldsWithIssues).toContain("due");
    expect(fieldsWithIssues).toContain("email");
    expect(fieldsWithIssues).toContain("url");
    expect(fieldsWithIssues).toContain("tier");
  });

  it("accepts valid values", () => {
    const issues = validateRecordData(fields, {
      name: "Widget",
      qty: 5,
      due: "2026-01-15",
      active: true,
      email: "a@b.co",
      url: "https://example.com",
      tier: "A",
    });
    expect(issues).toEqual([]);
  });
});

describe("coerceRecordData", () => {
  const fields: FieldDef[] = [
    { key: "name", label: "Name", kind: "TEXT", required: false },
    { key: "qty", label: "Qty", kind: "NUMBER", required: false },
    { key: "active", label: "Active", kind: "BOOLEAN", required: false },
  ];

  it("coerces numbers and booleans", () => {
    expect(coerceRecordData(fields, { name: "x", qty: "12", active: "on" })).toEqual({
      name: "x",
      qty: 12,
      active: true,
    });
  });

  it("defaults missing booleans to false", () => {
    expect(coerceRecordData(fields, { name: "x" })).toEqual({
      name: "x",
      active: false,
    });
  });
});

describe("formatRecordValue", () => {
  it("formats booleans, dates, and empties", () => {
    const f: FieldDef = {
      key: "x",
      label: "x",
      kind: "BOOLEAN",
      required: false,
    };
    expect(formatRecordValue(f, true)).toBe("Yes");
    expect(formatRecordValue(f, false)).toBe("No");
    expect(
      formatRecordValue(
        { key: "d", label: "d", kind: "DATE", required: false },
        "2026-04-26",
      ),
    ).not.toBe("—");
    expect(
      formatRecordValue(
        { key: "n", label: "n", kind: "TEXT", required: false },
        null,
      ),
    ).toBe("—");
  });
});

describe("summarizeApps", () => {
  it("counts by status", () => {
    const r = summarizeApps([
      { status: "DRAFT" },
      { status: "PUBLISHED" },
      { status: "PUBLISHED" },
      { status: "ARCHIVED" },
    ]);
    expect(r.total).toBe(4);
    expect(r.PUBLISHED).toBe(2);
    expect(r.DRAFT).toBe(1);
    expect(r.ARCHIVED).toBe(1);
  });
});
