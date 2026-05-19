import { describe, it, expect } from "vitest";
import { executeRules, profileRows } from "@/modules/dataprep/executor";
import type { DataPrepRule } from "@/modules/dataprep/types";

const sample = [
  { name: "  Alice ", email: "ALICE@x.com", city: "NYC" },
  { name: "Bob", email: "bob@x.com", city: "" },
  { name: "Bob", email: "bob@x.com", city: "" }, // duplicate
  { name: "Carol", email: " carol@x.com ", city: "LA" },
];

describe("dataprep executor", () => {
  it("TRIM + LOWERCASE on a column", () => {
    const rules: DataPrepRule[] = [
      { kind: "TRIM", column: "name" },
      { kind: "LOWERCASE", column: "email" },
    ];
    const r = executeRules(sample, rules);
    expect(r.rows[0]?.name).toBe("Alice");
    expect(r.rows[0]?.email).toBe("alice@x.com");
  });

  it("UPPERCASE applies to all columns when no column is set", () => {
    const r = executeRules([{ a: "x", b: "y" }], [{ kind: "UPPERCASE" }]);
    expect(r.rows[0]).toEqual({ a: "X", b: "Y" });
  });

  it("REMOVE_DUPLICATES dedupes by whole row", () => {
    const r = executeRules(sample, [{ kind: "REMOVE_DUPLICATES" }]);
    expect(r.rows).toHaveLength(3);
    expect(r.steps[0]?.rowsAfter).toBe(3);
  });

  it("REMOVE_DUPLICATES dedupes by single column when column set", () => {
    const r = executeRules(
      [
        { id: 1, group: "A" },
        { id: 2, group: "A" },
        { id: 3, group: "B" },
      ],
      [{ kind: "REMOVE_DUPLICATES", column: "group" }],
    );
    expect(r.rows).toHaveLength(2);
  });

  it("FILL_MISSING fills empty/null/undefined", () => {
    const r = executeRules(sample, [{ kind: "FILL_MISSING", column: "city", value: "Unknown" }]);
    expect(r.rows[1]?.city).toBe("Unknown");
    expect(r.rows[3]?.city).toBe("LA");
  });

  it("FILL_MISSING is tolerant of unknown columns", () => {
    const r = executeRules([{ a: 1 }], [{ kind: "FILL_MISSING", column: "missing", value: "z" }]);
    expect(r.rows[0]).toEqual({ a: 1 });
  });

  it("REPLACE swaps substrings on a column", () => {
    const r = executeRules(sample, [{ kind: "REPLACE", column: "email", find: "x.com", value: "y.com" }]);
    expect(r.rows[0]?.email).toBe("ALICE@y.com");
  });

  it("DROP_COLUMN removes a column", () => {
    const r = executeRules(sample, [{ kind: "DROP_COLUMN", column: "city" }]);
    expect(Object.keys(r.rows[0]!)).not.toContain("city");
    expect(r.droppedColumns).toEqual(["city"]);
  });

  it("RENAME_COLUMN renames in-place and tracks rename", () => {
    const r = executeRules(sample, [{ kind: "RENAME_COLUMN", column: "city", value: "location" }]);
    expect("location" in r.rows[0]!).toBe(true);
    expect("city" in r.rows[0]!).toBe(false);
    expect(r.columnRenames).toEqual({ city: "location" });
  });

  it("throws on rule referencing unknown column (non-FILL_MISSING)", () => {
    expect(() => executeRules(sample, [{ kind: "TRIM", column: "ghost" }])).toThrow(/ghost/);
  });

  it("chains rules so a rename works for downstream rules", () => {
    const r = executeRules(sample, [
      { kind: "RENAME_COLUMN", column: "city", value: "location" },
      { kind: "FILL_MISSING", column: "location", value: "Unknown" },
    ]);
    expect(r.rows[1]?.location).toBe("Unknown");
  });

  it("records steps with before/after counts", () => {
    const r = executeRules(sample, [{ kind: "REMOVE_DUPLICATES" }, { kind: "TRIM", column: "name" }]);
    expect(r.steps).toHaveLength(2);
    expect(r.steps[0]).toMatchObject({ kind: "REMOVE_DUPLICATES", rowsBefore: 4, rowsAfter: 3 });
  });
});

describe("dataprep profiling", () => {
  it("reports missing, unique, types and duplicates", () => {
    const p = profileRows([
      { name: "Alice", age: 30 },
      { name: "Bob", age: null },
      { name: "Bob", age: null }, // dup
    ]);
    expect(p.totalRows).toBe(3);
    expect(p.duplicateRows).toBe(1);
    const nameCol = p.columns.find((c) => c.name === "name")!;
    expect(nameCol.unique).toBe(2);
    expect(nameCol.missing).toBe(0);
    expect(nameCol.type).toBe("string");
    const ageCol = p.columns.find((c) => c.name === "age")!;
    expect(ageCol.missing).toBe(2);
  });
});
