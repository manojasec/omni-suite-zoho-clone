import { describe, expect, it } from "vitest";
import { fieldDefSchema, formSchema, buildSubmissionSchema } from "@/modules/forms/schemas";

describe("forms/schemas — fieldDefSchema", () => {
  it("requires a valid field name (identifier-like)", () => {
    expect(fieldDefSchema.safeParse({ id: "1", type: "text", label: "X", name: "first name" }).success).toBe(false);
    expect(fieldDefSchema.safeParse({ id: "1", type: "text", label: "X", name: "first_name" }).success).toBe(true);
  });
  it("rejects unknown field types", () => {
    expect(fieldDefSchema.safeParse({ id: "1", type: "magic", label: "X", name: "x" }).success).toBe(false);
  });
});

describe("forms/schemas — formSchema", () => {
  it("requires at least one field", () => {
    expect(formSchema.safeParse({ name: "x", fields: [] }).success).toBe(false);
  });
  it("accepts a minimal valid form", () => {
    const r = formSchema.parse({
      name: "Contact us",
      fields: [{ id: "1", type: "text", label: "Name", name: "name" }],
    });
    expect(r.destination).toBe("submission");
    expect(r.isPublished).toBe(false);
  });
});

describe("forms/buildSubmissionSchema", () => {
  it("validates emails when type=email", () => {
    const s = buildSubmissionSchema([
      { id: "1", type: "email", label: "Email", name: "email", required: true, placeholder: "", options: [] },
    ]);
    expect(s.safeParse({ email: "nope" }).success).toBe(false);
    expect(s.safeParse({ email: "a@b.co" }).success).toBe(true);
  });

  it("enforces required text fields", () => {
    const s = buildSubmissionSchema([
      { id: "1", type: "text", label: "Name", name: "name", required: true, placeholder: "", options: [] },
    ]);
    expect(s.safeParse({ name: "" }).success).toBe(false);
    expect(s.safeParse({ name: "Ada" }).success).toBe(true);
  });

  it("only accepts whitelisted choices for select fields", () => {
    const s = buildSubmissionSchema([
      { id: "1", type: "select", label: "Plan", name: "plan", required: true, placeholder: "", options: ["free", "pro"] },
    ]);
    expect(s.safeParse({ plan: "enterprise" }).success).toBe(false);
    expect(s.safeParse({ plan: "pro" }).success).toBe(true);
  });

  it("coerces numbers from string values", () => {
    const s = buildSubmissionSchema([
      { id: "1", type: "number", label: "Qty", name: "qty", required: true, placeholder: "", options: [] },
    ]);
    const r = s.safeParse({ qty: "42" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.qty).toBe(42);
  });
});
