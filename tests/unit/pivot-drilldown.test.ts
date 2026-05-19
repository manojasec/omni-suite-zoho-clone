import { describe, it, expect } from "vitest";
import { pivotToCsv, resolveDrill, type PivotResultLite } from "@/modules/pivots/drilldown";

const result: PivotResultLite = {
  rows: [
    { key: "NEW", total: 50 },
    { key: "WON", total: 30 },
  ],
  cols: [
    { key: "alice", total: 40 },
    { key: "bob", total: 40 },
  ],
  cells: {
    NEW: { alice: 20, bob: 30 },
    WON: { alice: 20, bob: 10 },
  },
  grandTotal: 80,
  hasColField: true,
};

const flat: PivotResultLite = {
  rows: [
    { key: "NEW", total: 50 },
    { key: "WON", total: 30 },
  ],
  cols: [],
  cells: { NEW: { _total: 50 }, WON: { _total: 30 } },
  grandTotal: 80,
  hasColField: false,
};

describe("pivot drill-down", () => {
  it("resolves a cell drill into a two-field filter", () => {
    const f = resolveDrill(result, { kind: "cell", rowKey: "NEW", colKey: "alice" }, {
      rowField: "stage",
      colField: "ownerId",
    });
    expect(f).toEqual({
      rowField: "stage",
      rowValue: "NEW",
      colField: "ownerId",
      colValue: "alice",
      value: 20,
    });
  });

  it("resolves a row drill", () => {
    const f = resolveDrill(result, { kind: "row", rowKey: "WON" }, { rowField: "stage", colField: "ownerId" });
    expect(f?.value).toBe(30);
    expect(f?.colValue).toBeUndefined();
  });

  it("resolves a col drill", () => {
    const f = resolveDrill(result, { kind: "col", colKey: "bob" }, { rowField: "stage", colField: "ownerId" });
    expect(f?.colValue).toBe("bob");
    expect(f?.value).toBe(40);
  });

  it("returns null for unknown coords", () => {
    expect(resolveDrill(result, { kind: "row", rowKey: "GHOST" }, { rowField: "stage" })).toBeNull();
    expect(
      resolveDrill(result, { kind: "cell", rowKey: "NEW", colKey: "ghost" }, { rowField: "stage", colField: "ownerId" }),
    ).toBeNull();
  });

  it("col drill is null when pivot has no column field", () => {
    expect(resolveDrill(flat, { kind: "col", colKey: "anything" }, { rowField: "stage" })).toBeNull();
  });

  it("cell drill on flat pivot uses _total", () => {
    const f = resolveDrill(flat, { kind: "cell", rowKey: "NEW", colKey: "_total" }, { rowField: "stage" });
    expect(f?.value).toBe(50);
    expect(f?.colField).toBeUndefined();
  });
});

describe("pivot CSV export", () => {
  it("serializes 2D pivot with totals", () => {
    const csv = pivotToCsv(result, { rowHeader: "Stage" });
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("Stage,alice,bob,Total");
    expect(lines[1]).toBe("NEW,20,30,50");
    expect(lines[2]).toBe("WON,20,10,30");
    expect(lines[3]).toBe("Total,40,40,80");
  });

  it("serializes flat pivot", () => {
    const csv = pivotToCsv(flat, { rowHeader: "Stage" });
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("Stage,Total");
    expect(lines[1]).toBe("NEW,50");
    expect(lines[3]).toBe("Total,80");
  });

  it("can omit totals", () => {
    const csv = pivotToCsv(result, { rowHeader: "Stage", includeTotals: false });
    expect(csv.split("\r\n").length).toBe(3); // header + 2 rows
    expect(csv).not.toContain("Total");
  });

  it("escapes commas/quotes/newlines in row keys", () => {
    const tricky: PivotResultLite = {
      rows: [{ key: 'hi, "there"', total: 1 }],
      cols: [],
      cells: { 'hi, "there"': { _total: 1 } },
      grandTotal: 1,
      hasColField: false,
    };
    const csv = pivotToCsv(tricky);
    expect(csv).toContain('"hi, ""there"""');
  });
});
