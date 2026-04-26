import { z } from "zod";

export const SHEET_STATUSES = ["ACTIVE", "ARCHIVED"] as const;
export type SheetStatus = (typeof SHEET_STATUSES)[number];

export const SHEET_STATUS_LABELS: Record<SheetStatus, string> = {
  ACTIVE: "Active",
  ARCHIVED: "Archived",
};

export const MAX_ROWS = 200;
export const MAX_COLS = 26;

export const sheetSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  rowCount: z.coerce.number().int().min(1).max(MAX_ROWS).default(50),
  colCount: z.coerce.number().int().min(1).max(MAX_COLS).default(10),
});
export type SheetInput = z.infer<typeof sheetSchema>;

export const sheetCellSchema = z.object({
  row: z.coerce.number().int().min(0).max(MAX_ROWS - 1),
  col: z.coerce.number().int().min(0).max(MAX_COLS - 1),
  value: z.string().max(2000).optional().default(""),
});
export type SheetCellInput = z.infer<typeof sheetCellSchema>;

/** Convert column index (0-based) to letter (A, B, ..., Z). */
export function colToLetter(col: number): string {
  if (col < 0 || col >= 26) return "";
  return String.fromCharCode(65 + col);
}

/** Convert letter (A..Z) to 0-based column index. -1 if invalid. */
export function letterToCol(letter: string): number {
  if (!letter || letter.length !== 1) return -1;
  const code = letter.toUpperCase().charCodeAt(0);
  if (code < 65 || code > 90) return -1;
  return code - 65;
}

/** Parse "A1" → {row:0, col:0}; null on invalid. */
export function parseRef(ref: string): { row: number; col: number } | null {
  const m = /^([A-Za-z])(\d+)$/.exec(ref.trim());
  if (!m) return null;
  const col = letterToCol(m[1]);
  const row = Number.parseInt(m[2], 10) - 1;
  if (col < 0 || row < 0) return null;
  return { row, col };
}

/** Parse range "A1:B3" into list of refs. */
export function parseRange(
  range: string,
): { row: number; col: number }[] | null {
  const parts = range.split(":");
  if (parts.length !== 2) {
    const single = parseRef(range);
    return single ? [single] : null;
  }
  const a = parseRef(parts[0]);
  const b = parseRef(parts[1]);
  if (!a || !b) return null;
  const r1 = Math.min(a.row, b.row);
  const r2 = Math.max(a.row, b.row);
  const c1 = Math.min(a.col, b.col);
  const c2 = Math.max(a.col, b.col);
  const out: { row: number; col: number }[] = [];
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) out.push({ row: r, col: c });
  }
  return out;
}

export type CellRecord = { row: number; col: number; value: string | null };

/** Build row→col→value map for fast lookup. */
export function indexCells(cells: CellRecord[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of cells) {
    if (c.value !== null && c.value !== undefined) {
      map.set(`${c.row}:${c.col}`, c.value);
    }
  }
  return map;
}

function toNumber(s: string | undefined): number | null {
  if (s === undefined || s === null) return null;
  const t = s.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * Evaluate a formula starting with "=". Supports:
 * - =SUM(A1:B3)
 * - =AVG(A1:A10) or =AVERAGE(...)
 * - =COUNT(A1:A10)
 * - =MIN(...), =MAX(...)
 * - =A1 (cell reference)
 * - =123 (literal number)
 * Returns the computed string, or "#ERR" on parse failure, "#CYC" on cycles.
 */
export function evaluateFormula(
  formula: string,
  values: Map<string, string>,
  visiting: Set<string> = new Set(),
): string {
  const trimmed = formula.trim();
  if (!trimmed.startsWith("=")) return trimmed;
  const expr = trimmed.slice(1).trim();
  if (expr === "") return "";

  // Function call: NAME(args)
  const fnMatch = /^([A-Za-z]+)\(([^)]*)\)$/.exec(expr);
  if (fnMatch) {
    const fn = fnMatch[1].toUpperCase();
    const arg = fnMatch[2].trim();
    const refs = parseRange(arg);
    if (!refs) return "#ERR";
    const nums: number[] = [];
    for (const r of refs) {
      const key = `${r.row}:${r.col}`;
      if (visiting.has(key)) return "#CYC";
      const raw = values.get(key);
      if (raw === undefined) continue;
      let n: number | null;
      if (raw.startsWith("=")) {
        const next = new Set(visiting);
        next.add(key);
        const evaluated = evaluateFormula(raw, values, next);
        if (evaluated === "#CYC" || evaluated === "#ERR") return evaluated;
        n = toNumber(evaluated);
      } else {
        n = toNumber(raw);
      }
      if (n !== null) nums.push(n);
    }
    switch (fn) {
      case "SUM":
        return String(nums.reduce((a, b) => a + b, 0));
      case "AVG":
      case "AVERAGE":
        return nums.length === 0
          ? "0"
          : String(nums.reduce((a, b) => a + b, 0) / nums.length);
      case "COUNT":
        return String(nums.length);
      case "MIN":
        return nums.length === 0 ? "0" : String(Math.min(...nums));
      case "MAX":
        return nums.length === 0 ? "0" : String(Math.max(...nums));
      default:
        return "#ERR";
    }
  }

  // Single cell ref
  const ref = parseRef(expr);
  if (ref) {
    const key = `${ref.row}:${ref.col}`;
    if (visiting.has(key)) return "#CYC";
    const raw = values.get(key);
    if (raw === undefined) return "";
    if (raw.startsWith("=")) {
      const next = new Set(visiting);
      next.add(key);
      return evaluateFormula(raw, values, next);
    }
    return raw;
  }

  // Numeric literal
  const n = toNumber(expr);
  if (n !== null) return String(n);

  return "#ERR";
}

/** Compute display values for all cells, evaluating formulas. */
export function renderCells(cells: CellRecord[]): Map<string, string> {
  const raw = indexCells(cells);
  const out = new Map<string, string>();
  for (const [key, val] of raw) {
    if (val.startsWith("=")) {
      out.set(key, evaluateFormula(val, raw));
    } else {
      out.set(key, val);
    }
  }
  return out;
}

export function summarizeSheets(
  sheets: { status: SheetStatus }[],
): Record<SheetStatus, number> & { total: number } {
  const out = {
    ACTIVE: 0,
    ARCHIVED: 0,
    total: sheets.length,
  } as Record<SheetStatus, number> & { total: number };
  for (const s of sheets) out[s.status]++;
  return out;
}

export function formatDate(date: Date | string | number): string {
  const d = typeof date === "object" ? date : new Date(date);
  return d.toLocaleDateString();
}

export function formatDateTime(date: Date | string | number): string {
  const d = typeof date === "object" ? date : new Date(date);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}
