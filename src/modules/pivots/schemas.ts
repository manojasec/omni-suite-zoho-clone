import { z } from "zod";
import { SOURCE_CATALOG, WIDGET_METRICS, WIDGET_SOURCES } from "@/modules/dashboards/schemas";

export const PIVOT_METRICS = WIDGET_METRICS;
export const PIVOT_SOURCES = WIDGET_SOURCES;
export { SOURCE_CATALOG };

export const pivotReportSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    description: z.preprocess(
      (v) => (v === "" || v == null ? undefined : v),
      z.string().trim().max(500).optional(),
    ),
    source: z.enum(PIVOT_SOURCES),
    rowField: z.string().trim().min(1).max(60),
    colField: z.preprocess(
      (v) => (v === "" || v == null ? undefined : v),
      z.string().trim().max(60).optional(),
    ),
    valueMetric: z.enum(PIVOT_METRICS),
    valueField: z.preprocess(
      (v) => (v === "" || v == null ? undefined : v),
      z.string().trim().max(60).optional(),
    ),
    rangeDays: z.coerce.number().int().min(1).max(3650).default(30),
  })
  .superRefine((v, ctx) => {
    const cat = SOURCE_CATALOG[v.source];
    if (!cat.groupBy.includes(v.rowField as never)) {
      ctx.addIssue({
        code: "custom",
        path: ["rowField"],
        message: `rowField must be one of: ${cat.groupBy.join(", ") || "(none)"}`,
      });
    }
    if (v.colField) {
      if (!cat.groupBy.includes(v.colField as never)) {
        ctx.addIssue({
          code: "custom",
          path: ["colField"],
          message: `colField must be one of: ${cat.groupBy.join(", ") || "(none)"}`,
        });
      }
      if (v.colField === v.rowField) {
        ctx.addIssue({ code: "custom", path: ["colField"], message: "colField must differ from rowField" });
      }
    }
    if (v.valueMetric === "COUNT" && v.valueField) {
      ctx.addIssue({ code: "custom", path: ["valueField"], message: "COUNT does not use a value field" });
    }
    if (v.valueMetric !== "COUNT") {
      if (!v.valueField) {
        ctx.addIssue({
          code: "custom",
          path: ["valueField"],
          message: `metric ${v.valueMetric} requires a numeric field`,
        });
      } else if (!cat.metricFields.includes(v.valueField as never)) {
        ctx.addIssue({
          code: "custom",
          path: ["valueField"],
          message: `valueField must be one of: ${cat.metricFields.join(", ") || "(none)"}`,
        });
      }
    }
  });

export type PivotReportInput = z.infer<typeof pivotReportSchema>;
