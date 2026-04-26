import { describe, expect, it } from "vitest";
import {
  SHEET_STATUSES,
  colToLetter,
  evaluateFormula,
  indexCells,
  letterToCol,
  parseRange,
  parseRef,
  renderCells,
  sheetCellSchema,
  sheetSchema,
  summarizeSheets,
} from "@/modules/sheet/schemas";

describe("sheet constants", () => {
  it("exposes statuses", () => {
    expect(SHEET_STATUSES).toEqual(["ACTIVE", "ARCHIVED"]);
  });
});

describe("sheetSchema", () => {
  it("applies defaults and trims", () => {
    const r = sheetSchema.parse({ name: " My sheet " });
    expect(r.name).toBe("My sheet");
    expect(r.rowCount).toBe(50);
    expect(r.colCount).toBe(10);
  });
  it("requires a name", () => {
    expect(() => sheetSchema.parse({ name: "" })).toThrow();
  });
  it("rejects out-of-range sizes", () => {
    expect(() =>
      sheetSchema.parse({ name: "X", rowCount: 5000 }),
    ).toThrow();
  });
});

describe("sheetCellSchema", () => {
  it("coerces row/col strings", () => {
    const r = sheetCellSchema.parse({ row: "3", col: "2", value: "hi" });
    expect(r.row).toBe(3);
    expect(r.col).toBe(2);
  });
  it("defaults value to empty", () => {
    const r = sheetCellSchema.parse({ row: 0, col: 0 });
    expect(r.value).toBe("");
  });
});

describe("column ↔ letter helpers", () => {
  it("converts column index to letter", () => {
    expect(colToLetter(0)).toBe("A");
    expect(colToLetter(25)).toBe("Z");
    expect(colToLetter(26)).toBe("");
  });
  it("converts letter to column index", () => {
    expect(letterToCol("A")).toBe(0);
    expect(letterToCol("z")).toBe(25);
    expect(letterToCol("AA")).toBe(-1);
    expect(letterToCol("1")).toBe(-1);
  });
});

describe("parseRef / parseRange", () => {
  it("parses A1-style refs", () => {
    expect(parseRef("A1")).toEqual({ row: 0, col: 0 });
    expect(parseRef("B3")).toEqual({ row: 2, col: 1 });
    expect(parseRef("AA1")).toBeNull();
    expect(parseRef("garbage")).toBeNull();
  });
  it("expands ranges", () => {
    const r = parseRange("A1:B2");
    expect(r).toHaveLength(4);
    expect(r).toContainEqual({ row: 0, col: 0 });
    expect(r).toContainEqual({ row: 1, col: 1 });
  });
  it("treats single ref as 1-cell range", () => {
    const r = parseRange("C3");
    expect(r).toEqual([{ row: 2, col: 2 }]);
  });
});

describe("evaluateFormula", () => {
  const cells = [
    { row: 0, col: 0, value: "10" },
    { row: 1, col: 0, value: "20" },
    { row: 2, col: 0, value: "30" },
    { row: 0, col: 1, value: "hi" },
  ];

  it("computes SUM of a range", () => {
    const m = indexCells(cells);
    expect(evaluateFormula("=SUM(A1:A3)", m)).toBe("60");
  });
  it("computes AVG and AVERAGE", () => {
    const m = indexCells(cells);
    expect(evaluateFormula("=AVG(A1:A3)", m)).toBe("20");
    expect(evaluateFormula("=AVERAGE(A1:A3)", m)).toBe("20");
  });
  it("handles MIN/MAX/COUNT", () => {
    const m = indexCells(cells);
    expect(evaluateFormula("=MIN(A1:A3)", m)).toBe("10");
    expect(evaluateFormula("=MAX(A1:A3)", m)).toBe("30");
    expect(evaluateFormula("=COUNT(A1:B1)", m)).toBe("1");
  });
  it("resolves single-cell references", () => {
    const m = indexCells(cells);
    expect(evaluateFormula("=A2", m)).toBe("20");
  });
  it("resolves nested formulas", () => {
    const m = indexCells([
      ...cells,
      { row: 3, col: 0, value: "=SUM(A1:A3)" },
    ]);
    expect(evaluateFormula("=A4", m)).toBe("60");
  });
  it("detects cycles", () => {
    const m = indexCells([
      { row: 0, col: 0, value: "=B1" },
      { row: 0, col: 1, value: "=A1" },
    ]);
    expect(evaluateFormula("=A1", m)).toBe("#CYC");
  });
  it("returns #ERR for unknown functions", () => {
    expect(evaluateFormula("=BOGUS(A1:A2)", indexCells(cells))).toBe("#ERR");
  });
  it("supports numeric literals", () => {
    expect(evaluateFormula("=42", new Map())).toBe("42");
  });
});

describe("renderCells", () => {
  it("renders mixed values and formulas", () => {
    const out = renderCells([
      { row: 0, col: 0, value: "5" },
      { row: 1, col: 0, value: "7" },
      { row: 2, col: 0, value: "=SUM(A1:A2)" },
      { row: 0, col: 1, value: "hello" },
    ]);
    expect(out.get("0:0")).toBe("5");
    expect(out.get("2:0")).toBe("12");
    expect(out.get("0:1")).toBe("hello");
  });
});

describe("summarizeSheets", () => {
  it("counts by status", () => {
    const r = summarizeSheets([
      { status: "ACTIVE" },
      { status: "ACTIVE" },
      { status: "ARCHIVED" },
    ]);
    expect(r.total).toBe(3);
    expect(r.ACTIVE).toBe(2);
    expect(r.ARCHIVED).toBe(1);
  });
});
