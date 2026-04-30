import { describe, it, expect } from "vitest";
import {
  datasetSchema,
  ruleSchema,
  DATA_PREP_RULE_KINDS,
  DATA_PREP_RULE_LABELS,
} from "@/modules/dataprep/schemas";

describe("dataprep schemas", () => {
  it("accepts a valid dataset", () => {
    const out = datasetSchema.parse({
      name: " Customers ",
      description: "",
      sourceType: "csv",
    });
    expect(out.name).toBe("Customers");
    expect(out.sourceType).toBe("csv");
  });

  it("rejects an empty name", () => {
    expect(() =>
      datasetSchema.parse({ name: "   ", sourceType: "csv" }),
    ).toThrow();
  });

  it("defaults sourceType to csv", () => {
    const out = datasetSchema.parse({ name: "X" });
    expect(out.sourceType).toBe("csv");
  });

  it("rejects unknown sourceType", () => {
    expect(() =>
      datasetSchema.parse({ name: "X", sourceType: "ftp" as never }),
    ).toThrow();
  });

  it("accepts a valid rule", () => {
    const out = ruleSchema.parse({ kind: "TRIM", column: "email" });
    expect(out.kind).toBe("TRIM");
    expect(out.column).toBe("email");
  });

  it("rejects an unknown rule kind", () => {
    expect(() =>
      ruleSchema.parse({ kind: "EXPLODE" as never, column: "x" }),
    ).toThrow();
  });

  it("has a label for every rule kind", () => {
    for (const k of DATA_PREP_RULE_KINDS) {
      expect(DATA_PREP_RULE_LABELS[k]).toBeTruthy();
    }
  });
});
