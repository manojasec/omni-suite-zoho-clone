import { z } from "zod";

export const EMAIL_TEMPLATE_CATEGORIES = [
  "transactional",
  "marketing",
  "notification",
  "invoice",
  "support",
  "other",
] as const;
export type EmailTemplateCategory =
  (typeof EMAIL_TEMPLATE_CATEGORIES)[number];

export function formatEmailCategory(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const emailTemplateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.enum(EMAIL_TEMPLATE_CATEGORIES),
  subject: z.string().trim().min(1).max(200),
  bodyText: z.string().trim().min(1).max(20_000),
  bodyHtml: z
    .string()
    .trim()
    .max(50_000)
    .optional()
    .or(z.literal("")),
  isActive: z.coerce.boolean().default(true),
});
export type EmailTemplateInput = z.infer<typeof emailTemplateSchema>;

const VAR = /\{\{\s*([a-zA-Z_][\w.]*)\s*\}\}/g;

/**
 * Render a template by replacing `{{var}}` and `{{ var }}` placeholders.
 * Unknown variables are left as the literal placeholder so missing data is
 * obvious when previewing.
 */
export function renderEmailTemplate(
  template: string,
  vars: Record<string, string | number | undefined | null>,
): string {
  return template.replace(VAR, (whole, key) => {
    const value = vars[key];
    if (value === undefined || value === null) return whole;
    return String(value);
  });
}

/** Extract the unique set of placeholder names found in a template body. */
export function extractTemplateVariables(template: string): string[] {
  const seen = new Set<string>();
  const re = new RegExp(VAR.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(template)) !== null) {
    seen.add(m[1]);
  }
  return [...seen];
}
