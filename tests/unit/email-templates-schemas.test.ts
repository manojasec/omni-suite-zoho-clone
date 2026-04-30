import { describe, expect, it } from "vitest";
import {
  EMAIL_TEMPLATE_CATEGORIES,
  emailTemplateSchema,
  extractTemplateVariables,
  formatEmailCategory,
  renderEmailTemplate,
} from "@/modules/email-templates/schemas";

describe("email-templates/schemas", () => {
  it("exposes the expected categories", () => {
    expect(EMAIL_TEMPLATE_CATEGORIES).toContain("transactional");
    expect(EMAIL_TEMPLATE_CATEGORIES).toContain("marketing");
    expect(EMAIL_TEMPLATE_CATEGORIES).toContain("other");
  });

  it("formatEmailCategory capitalises the first letter", () => {
    expect(formatEmailCategory("invoice")).toBe("Invoice");
  });

  it("renders {{var}} placeholders", () => {
    const out = renderEmailTemplate("Hi {{name}}, balance: {{amount}}", {
      name: "Ada",
      amount: 42,
    });
    expect(out).toBe("Hi Ada, balance: 42");
  });

  it("tolerates whitespace inside placeholders", () => {
    expect(
      renderEmailTemplate("Hello {{ name }}!", { name: "World" }),
    ).toBe("Hello World!");
  });

  it("leaves unknown placeholders untouched so they are visible in preview", () => {
    expect(
      renderEmailTemplate("Hi {{name}} ({{missing}})", { name: "Ada" }),
    ).toBe("Hi Ada ({{missing}})");
  });

  it("replaces multiple occurrences of the same placeholder", () => {
    expect(
      renderEmailTemplate("{{x}}-{{x}}-{{x}}", { x: "z" }),
    ).toBe("z-z-z");
  });

  it("ignores invalid placeholder names", () => {
    expect(renderEmailTemplate("{{ 1bad }}", { "1bad": "y" })).toBe(
      "{{ 1bad }}",
    );
  });

  it("extractTemplateVariables returns the unique set of placeholders", () => {
    const vars = extractTemplateVariables(
      "Hello {{name}}, your order {{orderId}} ships to {{name}}.",
    );
    expect(vars.sort()).toEqual(["name", "orderId"]);
  });

  it("extractTemplateVariables returns empty for a plain template", () => {
    expect(extractTemplateVariables("hello world")).toEqual([]);
  });

  it("supports dotted placeholder names", () => {
    expect(
      renderEmailTemplate("{{user.name}}", { "user.name": "Ada" }),
    ).toBe("Ada");
  });

  it("validates a minimum template payload", () => {
    const r = emailTemplateSchema.safeParse({
      name: "Welcome",
      category: "transactional",
      subject: "Hi",
      bodyText: "Hello",
      bodyHtml: "",
      isActive: true,
    });
    expect(r.success).toBe(true);
  });

  it("rejects empty subject", () => {
    const r = emailTemplateSchema.safeParse({
      name: "x",
      category: "transactional",
      subject: "",
      bodyText: "x",
    });
    expect(r.success).toBe(false);
  });

  it("rejects unknown category", () => {
    const r = emailTemplateSchema.safeParse({
      name: "x",
      category: "spammy",
      subject: "x",
      bodyText: "x",
    });
    expect(r.success).toBe(false);
  });

  it("rejects empty body", () => {
    const r = emailTemplateSchema.safeParse({
      name: "x",
      category: "transactional",
      subject: "Hi",
      bodyText: "",
    });
    expect(r.success).toBe(false);
  });
});
