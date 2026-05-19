import type { DATA_PREP_RULE_KINDS } from "./schemas";

export type DataPrepRule = {
  kind: (typeof DATA_PREP_RULE_KINDS)[number];
  column?: string;
  /** Used by REPLACE. */
  find?: string;
  /** Used by FILL_MISSING (fill value), REPLACE (replacement), RENAME_COLUMN (new name). */
  value?: string;
};
