/**
 * DataPrep executor — applies a sequence of cleaning rules to an in-memory
 * row set. Pure & deterministic.
 *
 * Operates on `DataRow = Record<string, unknown>`. Rules mirror the
 * `DATA_PREP_RULE_KINDS` shipped in schemas.
 */

import type { DataPrepRule } from "./types";

export type DataRow = Record<string, unknown>;

export type ExecutionStep = {
  kind: DataPrepRule["kind"];
  column?: string;
  rowsBefore: number;
  rowsAfter: number;
};

export type ExecutionResult = {
  rows: DataRow[];
  steps: ExecutionStep[];
  /** Renamed columns: { old: new }. */
  columnRenames: Record<string, string>;
  /** Columns dropped from the original dataset. */
  droppedColumns: string[];
};

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function rowSignature(row: DataRow): string {
  const keys = Object.keys(row).sort();
  return JSON.stringify(keys.map((k) => [k, row[k]]));
}

function applyRule(rows: DataRow[], rule: DataPrepRule, state: { dropped: string[]; renames: Record<string, string> }): DataRow[] {
  switch (rule.kind) {
    case "TRIM":
      return rows.map((r) => transformColumn(r, rule.column, (v) => (isString(v) ? v.trim() : v)));
    case "LOWERCASE":
      return rows.map((r) => transformColumn(r, rule.column, (v) => (isString(v) ? v.toLowerCase() : v)));
    case "UPPERCASE":
      return rows.map((r) => transformColumn(r, rule.column, (v) => (isString(v) ? v.toUpperCase() : v)));
    case "REMOVE_DUPLICATES": {
      const seen = new Set<string>();
      const out: DataRow[] = [];
      for (const r of rows) {
        const sig = rule.column ? JSON.stringify(r[rule.column] ?? null) : rowSignature(r);
        if (seen.has(sig)) continue;
        seen.add(sig);
        out.push(r);
      }
      return out;
    }
    case "FILL_MISSING": {
      const fill = rule.value ?? "";
      return rows.map((r) =>
        transformColumn(r, rule.column, (v) => (v === undefined || v === null || v === "" ? fill : v)),
      );
    }
    case "REPLACE": {
      const find = rule.find ?? "";
      const replace = rule.value ?? "";
      if (find === "") return rows;
      return rows.map((r) =>
        transformColumn(r, rule.column, (v) => (isString(v) ? v.split(find).join(replace) : v)),
      );
    }
    case "DROP_COLUMN": {
      if (!rule.column) return rows;
      state.dropped.push(rule.column);
      return rows.map((r) => {
        const out: DataRow = {};
        for (const k of Object.keys(r)) if (k !== rule.column) out[k] = r[k];
        return out;
      });
    }
    case "RENAME_COLUMN": {
      if (!rule.column || !rule.value) return rows;
      const from = rule.column;
      const to = String(rule.value);
      state.renames[from] = to;
      return rows.map((r) => {
        const out: DataRow = {};
        for (const k of Object.keys(r)) {
          if (k === from) out[to] = r[k];
          else out[k] = r[k];
        }
        return out;
      });
    }
  }
}

function transformColumn(row: DataRow, column: string | undefined, fn: (v: unknown) => unknown): DataRow {
  if (column) {
    if (!(column in row)) return row;
    return { ...row, [column]: fn(row[column]) };
  }
  const out: DataRow = {};
  for (const k of Object.keys(row)) out[k] = fn(row[k]);
  return out;
}

/**
 * Execute a rule sequence. Stops early & throws if a rule references a
 * column that does not exist in the current state (after prior renames) —
 * with the exception of FILL_MISSING which is column-tolerant.
 */
export function executeRules(input: DataRow[], rules: DataPrepRule[]): ExecutionResult {
  let rows = input.map((r) => ({ ...r }));
  const steps: ExecutionStep[] = [];
  const state = { dropped: [] as string[], renames: {} as Record<string, string> };

  for (const rule of rules) {
    if (rule.column && rule.kind !== "FILL_MISSING") {
      const knownColumns = new Set<string>();
      for (const r of rows) for (const k of Object.keys(r)) knownColumns.add(k);
      if (knownColumns.size > 0 && !knownColumns.has(rule.column)) {
        throw new Error(`column "${rule.column}" not found`);
      }
    }
    const before = rows.length;
    rows = applyRule(rows, rule, state);
    steps.push({ kind: rule.kind, column: rule.column, rowsBefore: before, rowsAfter: rows.length });
  }

  return { rows, steps, columnRenames: state.renames, droppedColumns: state.dropped };
}

/**
 * Detect simple data-quality issues on the input rows. Returns counts per
 * column for missing values and detected duplicates.
 */
export function profileRows(rows: DataRow[]): {
  totalRows: number;
  columns: Array<{ name: string; missing: number; unique: number; type: "string" | "number" | "mixed" | "empty" }>;
  duplicateRows: number;
} {
  const columnMap = new Map<string, { missing: number; values: Set<string>; types: Set<string> }>();
  for (const r of rows) {
    for (const k of Object.keys(r)) {
      const entry = columnMap.get(k) ?? { missing: 0, values: new Set<string>(), types: new Set<string>() };
      const v = r[k];
      if (v === undefined || v === null || v === "") entry.missing += 1;
      else {
        entry.values.add(typeof v === "object" ? JSON.stringify(v) : String(v));
        entry.types.add(typeof v);
      }
      columnMap.set(k, entry);
    }
  }
  const columns = Array.from(columnMap.entries()).map(([name, info]) => {
    const types = Array.from(info.types);
    let type: "string" | "number" | "mixed" | "empty";
    if (types.length === 0) type = "empty";
    else if (types.length === 1 && types[0] === "string") type = "string";
    else if (types.length === 1 && types[0] === "number") type = "number";
    else type = "mixed";
    return { name, missing: info.missing, unique: info.values.size, type };
  });
  const seen = new Set<string>();
  let dupes = 0;
  for (const r of rows) {
    const sig = rowSignature(r);
    if (seen.has(sig)) dupes += 1;
    else seen.add(sig);
  }
  return { totalRows: rows.length, columns, duplicateRows: dupes };
}
