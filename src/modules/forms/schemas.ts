import { z } from "zod";

export const FIELD_TYPES = [
  "text",
  "email",
  "phone",
  "textarea",
  "select",
  "checkbox",
  "radio",
  "date",
  "number",
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

export const fieldDefSchema = z.object({
  id: z.string().min(1),
  type: z.enum(FIELD_TYPES),
  label: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1).max(80).regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, "Use letters, numbers, underscores"),
  required: z.boolean().default(false),
  placeholder: z.string().max(200).optional().default(""),
  options: z.array(z.string().max(100)).max(50).optional().default([]),
});
export type FieldDef = z.infer<typeof fieldDefSchema>;

export const formDestinations = ["contact", "lead", "ticket", "submission"] as const;
export type FormDestination = (typeof formDestinations)[number];

export const formSchemaShape = z.object({
  fields: z.array(fieldDefSchema).min(1, "Add at least one field"),
});
export type FormFieldsSchema = z.infer<typeof formSchemaShape>;

export const formSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  destination: z.enum(formDestinations).default("submission"),
  isPublished: z.preprocess((v) => v === "on" || v === true || v === "true", z.boolean()).default(false),
  fields: formSchemaShape.shape.fields,
});

/**
 * Build a per-form Zod schema from its field definitions for validating
 * submissions on the public page.
 */
export function buildSubmissionSchema(fields: FieldDef[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of fields) {
    let s: z.ZodTypeAny;
    switch (f.type) {
      case "email":
        s = z.string().trim().email("Invalid email");
        break;
      case "number":
        s = z.preprocess(
          (v) => (typeof v === "string" && v.length > 0 ? Number(v) : v === "" ? undefined : v),
          z.number(),
        );
        break;
      case "checkbox":
        s = z.preprocess((v) => v === "on" || v === true || v === "true", z.boolean());
        break;
      case "select":
      case "radio":
        s = z.string().trim().refine((v) => f.options?.includes(v), "Invalid choice");
        break;
      case "date":
        s = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date");
        break;
      case "phone":
        s = z.string().trim().min(3, "Too short").max(40);
        break;
      case "textarea":
      case "text":
      default:
        s = z.string().trim().max(8000);
    }
    if (!f.required && f.type !== "checkbox") {
      s = s.optional().or(z.literal(""));
    }
    if (f.required && f.type !== "checkbox") {
      s = s.refine((v) => v !== undefined && v !== null && v !== "", `${f.label} is required`);
    }
    shape[f.name] = s;
  }
  return z.object(shape);
}
