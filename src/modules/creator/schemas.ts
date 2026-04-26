import { z } from "zod";

export const CREATOR_APP_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
export type CreatorAppStatus = (typeof CREATOR_APP_STATUSES)[number];

export const CREATOR_APP_STATUS_LABELS: Record<CreatorAppStatus, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

export const CREATOR_FIELD_KINDS = [
  "TEXT",
  "TEXTAREA",
  "NUMBER",
  "DATE",
  "BOOLEAN",
  "SELECT",
  "EMAIL",
  "URL",
] as const;
export type CreatorFieldKind = (typeof CREATOR_FIELD_KINDS)[number];

export const CREATOR_FIELD_KIND_LABELS: Record<CreatorFieldKind, string> = {
  TEXT: "Text",
  TEXTAREA: "Long text",
  NUMBER: "Number",
  DATE: "Date",
  BOOLEAN: "Yes/No",
  SELECT: "Select",
  EMAIL: "Email",
  URL: "URL",
};

const KEY_REGEX = /^[a-z][a-z0-9_]{0,63}$/;
const SLUG_REGEX = /^[a-z][a-z0-9-]{0,79}$/;

const optionalString = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .transform((v) => (v && v.trim().length > 0 ? v.trim() : undefined));

export const creatorAppSchema = z.object({
  name: z.string().min(1).max(160),
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(SLUG_REGEX, "Slug must be lowercase letters, digits, or hyphens"),
  description: optionalString(500),
  icon: optionalString(40),
  status: z.enum(CREATOR_APP_STATUSES).default("DRAFT"),
});

export const creatorEntitySchema = z.object({
  key: z
    .string()
    .min(1)
    .max(64)
    .regex(KEY_REGEX, "Key must be a lowercase identifier"),
  label: z.string().min(1).max(160),
  description: optionalString(500),
});

export const creatorFieldSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(64)
    .regex(KEY_REGEX, "Key must be a lowercase identifier"),
  label: z.string().min(1).max(160),
  kind: z.enum(CREATOR_FIELD_KINDS),
  required: z.coerce.boolean().default(false),
  helpText: optionalString(300),
  options: optionalString(2000), // newline-separated when SELECT
});

export const CREATOR_APP_TRANSITIONS: Record<CreatorAppStatus, CreatorAppStatus[]> = {
  DRAFT: ["PUBLISHED"],
  PUBLISHED: ["DRAFT", "ARCHIVED"],
  ARCHIVED: [],
};

export function canTransitionApp(
  from: CreatorAppStatus,
  to: CreatorAppStatus,
): boolean {
  return CREATOR_APP_TRANSITIONS[from].includes(to);
}

export function parseSelectOptions(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export type FieldDef = {
  key: string;
  label: string;
  kind: CreatorFieldKind;
  required: boolean;
  options?: string[] | null;
};

export type RecordValidationIssue = {
  field: string;
  message: string;
};

export function validateRecordData(
  fields: FieldDef[],
  data: Record<string, unknown>,
): RecordValidationIssue[] {
  const issues: RecordValidationIssue[] = [];
  for (const f of fields) {
    const raw = data[f.key];
    const isEmpty =
      raw === undefined ||
      raw === null ||
      (typeof raw === "string" && raw.trim() === "");
    if (isEmpty) {
      if (f.required) issues.push({ field: f.key, message: "Required" });
      continue;
    }
    const value = typeof raw === "string" ? raw.trim() : raw;
    switch (f.kind) {
      case "NUMBER": {
        const n = Number(value);
        if (!Number.isFinite(n))
          issues.push({ field: f.key, message: "Must be a number" });
        break;
      }
      case "DATE": {
        const d = new Date(String(value));
        if (Number.isNaN(d.getTime()))
          issues.push({ field: f.key, message: "Must be a valid date" });
        break;
      }
      case "BOOLEAN": {
        if (
          typeof value !== "boolean" &&
          !["true", "false", "on", "off", "1", "0"].includes(String(value))
        )
          issues.push({ field: f.key, message: "Must be true/false" });
        break;
      }
      case "EMAIL": {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value)))
          issues.push({ field: f.key, message: "Must be a valid email" });
        break;
      }
      case "URL": {
        try {
          new URL(String(value));
        } catch {
          issues.push({ field: f.key, message: "Must be a valid URL" });
        }
        break;
      }
      case "SELECT": {
        const opts = f.options ?? [];
        if (opts.length > 0 && !opts.includes(String(value)))
          issues.push({ field: f.key, message: "Not a valid option" });
        break;
      }
    }
  }
  return issues;
}

export function coerceRecordData(
  fields: FieldDef[],
  formData: Record<string, string | undefined>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const raw = formData[f.key];
    if (raw === undefined || raw === "") {
      if (f.kind === "BOOLEAN") out[f.key] = false;
      continue;
    }
    switch (f.kind) {
      case "NUMBER":
        out[f.key] = Number(raw);
        break;
      case "BOOLEAN":
        out[f.key] = raw === "on" || raw === "true" || raw === "1";
        break;
      default:
        out[f.key] = raw.trim();
    }
  }
  return out;
}

export function formatRecordValue(
  field: FieldDef,
  value: unknown,
): string {
  if (value === undefined || value === null || value === "") return "—";
  switch (field.kind) {
    case "BOOLEAN":
      return value ? "Yes" : "No";
    case "DATE": {
      const d = new Date(String(value));
      return Number.isNaN(d.getTime())
        ? String(value)
        : d.toLocaleDateString();
    }
    default:
      return String(value);
  }
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function summarizeApps(
  apps: { status: CreatorAppStatus }[],
): Record<CreatorAppStatus, number> & { total: number } {
  const out = { DRAFT: 0, PUBLISHED: 0, ARCHIVED: 0, total: apps.length };
  for (const a of apps) out[a.status] += 1;
  return out;
}
