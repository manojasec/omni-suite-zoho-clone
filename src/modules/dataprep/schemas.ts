import { z } from "zod";

export const DATA_PREP_RULE_KINDS = [
  "TRIM",
  "LOWERCASE",
  "UPPERCASE",
  "REMOVE_DUPLICATES",
  "FILL_MISSING",
  "REPLACE",
  "DROP_COLUMN",
  "RENAME_COLUMN",
] as const;

export const DATA_PREP_RULE_LABELS: Record<
  (typeof DATA_PREP_RULE_KINDS)[number],
  string
> = {
  TRIM: "Trim whitespace",
  LOWERCASE: "Lowercase",
  UPPERCASE: "Uppercase",
  REMOVE_DUPLICATES: "Remove duplicates",
  FILL_MISSING: "Fill missing values",
  REPLACE: "Find & replace",
  DROP_COLUMN: "Drop column",
  RENAME_COLUMN: "Rename column",
};

export const datasetSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  sourceType: z.enum(["csv", "excel", "json", "api"]).default("csv"),
});
export type DatasetInput = z.infer<typeof datasetSchema>;

export const ruleSchema = z.object({
  kind: z.enum(DATA_PREP_RULE_KINDS),
  column: z.string().trim().max(120).optional().or(z.literal("")),
});
export type RuleInput = z.infer<typeof ruleSchema>;
