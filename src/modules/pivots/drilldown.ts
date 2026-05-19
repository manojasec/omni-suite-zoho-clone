/**
 * Pivot drill-down + CSV export — pure helpers operating on the in-memory
 * `PivotResult` shape produced by `pivots/runtime.ts`. No DB access.
 */

export type PivotResultLite = {
  rows: Array<{ key: string; total: number }>;
  cols: Array<{ key: string; total: number }>;
  cells: Record<string, Record<string, number>>;
  grandTotal: number;
  hasColField: boolean;
};

export type DrillCoord =
  | { kind: "cell"; rowKey: string; colKey: string }
  | { kind: "row"; rowKey: string }
  | { kind: "col"; colKey: string };

export type DrillFilter = {
  rowField: string;
  rowValue?: string;
  colField?: string;
  colValue?: string;
  /** Resolved cell value (or row/col total) at the drill coordinate. */
  value: number;
};

/**
 * Resolve a drill click into the filter spec needed to fetch underlying rows.
 * Returns null when the coordinate isn't present in the result, or when a
 * cell drill is attempted on a pivot that has no column field.
 */
export function resolveDrill(
  result: PivotResultLite,
  coord: DrillCoord,
  fields: { rowField: string; colField?: string | null },
): DrillFilter | null {
  if (coord.kind === "row") {
    const row = result.rows.find((r) => r.key === coord.rowKey);
    if (!row) return null;
    return { rowField: fields.rowField, rowValue: row.key, value: row.total };
  }
  if (coord.kind === "col") {
    if (!result.hasColField || !fields.colField) return null;
    const col = result.cols.find((c) => c.key === coord.colKey);
    if (!col) return null;
    return { rowField: fields.rowField, colField: fields.colField, colValue: col.key, value: col.total };
  }
  // cell
  const rowBucket = result.cells[coord.rowKey];
  if (!rowBucket) return null;
  if (!result.hasColField) {
    const v = rowBucket["_total"];
    if (v === undefined) return null;
    return { rowField: fields.rowField, rowValue: coord.rowKey, value: v };
  }
  if (!fields.colField) return null;
  const v = rowBucket[coord.colKey];
  if (v === undefined) return null;
  return {
    rowField: fields.rowField,
    rowValue: coord.rowKey,
    colField: fields.colField,
    colValue: coord.colKey,
    value: v,
  };
}

function csvEscape(value: string | number): string {
  const s = String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Serialize a `PivotResult` to CSV. Includes a row/col total row+column and
 * a grand-total cell.
 */
export function pivotToCsv(
  result: PivotResultLite,
  options: { rowHeader?: string; includeTotals?: boolean } = {},
): string {
  const rowHeader = options.rowHeader ?? "Row";
  const includeTotals = options.includeTotals !== false;

  const colKeys = result.hasColField ? result.cols.map((c) => c.key) : ["_total"];
  const headerCols = result.hasColField ? colKeys : ["Total"];

  const lines: string[] = [];
  const header = [csvEscape(rowHeader), ...headerCols.map(csvEscape)];
  if (includeTotals && result.hasColField) header.push(csvEscape("Total"));
  lines.push(header.join(","));

  for (const r of result.rows) {
    const cells = result.cells[r.key] ?? {};
    const out: string[] = [csvEscape(r.key)];
    for (const ck of colKeys) {
      out.push(csvEscape(cells[ck] ?? 0));
    }
    if (includeTotals && result.hasColField) out.push(csvEscape(r.total));
    lines.push(out.join(","));
  }

  if (includeTotals) {
    const totals: string[] = [csvEscape("Total")];
    if (result.hasColField) {
      for (const c of result.cols) totals.push(csvEscape(c.total));
      totals.push(csvEscape(result.grandTotal));
    } else {
      totals.push(csvEscape(result.grandTotal));
    }
    lines.push(totals.join(","));
  }
  return lines.join("\r\n");
}
