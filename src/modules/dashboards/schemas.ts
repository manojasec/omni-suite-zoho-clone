import { z } from "zod";
import type { WidgetKind, WidgetMetric, WidgetSource } from "@prisma/client";

export const WIDGET_KINDS = ["KPI", "BAR", "LINE", "PIE", "TABLE"] as const;
export const WIDGET_SOURCES = [
  "DEAL",
  "INVOICE",
  "CONTACT",
  "TICKET",
  "TASK",
  "PROJECT",
  "EXPENSE",
  "SUBSCRIPTION",
  "SUBSCRIPTION_INVOICE",
  "CAMPAIGN",
] as const;
export const WIDGET_METRICS = ["COUNT", "SUM", "AVG"] as const;

/**
 * Catalog of allowed group-by + metric fields per source.
 * Keep aligned with `runWidget` in `runtime.ts`.
 */
export const SOURCE_CATALOG = {
  DEAL: {
    label: "Deals",
    groupBy: ["status", "stageId", "ownerId"] as const,
    metricFields: ["value"] as const,
    dateField: "createdAt",
  },
  INVOICE: {
    label: "Invoices",
    groupBy: ["status"] as const,
    metricFields: ["total", "balance"] as const,
    dateField: "issueDate",
  },
  CONTACT: {
    label: "Contacts",
    groupBy: ["ownerId"] as const,
    metricFields: [] as const,
    dateField: "createdAt",
  },
  TICKET: {
    label: "Tickets",
    groupBy: ["status", "priority", "assigneeId"] as const,
    metricFields: [] as const,
    dateField: "createdAt",
  },
  TASK: {
    label: "Tasks",
    groupBy: ["status", "priority", "assigneeId"] as const,
    metricFields: [] as const,
    dateField: "createdAt",
  },
  PROJECT: {
    label: "Projects",
    groupBy: ["status"] as const,
    metricFields: [] as const,
    dateField: "createdAt",
  },
  EXPENSE: {
    label: "Expenses",
    groupBy: ["status", "categoryId"] as const,
    metricFields: ["amount"] as const,
    dateField: "expenseDate",
  },
  SUBSCRIPTION: {
    label: "Subscriptions",
    groupBy: ["status", "planId"] as const,
    metricFields: [] as const,
    dateField: "startedAt",
  },
  SUBSCRIPTION_INVOICE: {
    label: "Subscription invoices",
    groupBy: ["status"] as const,
    metricFields: ["amount"] as const,
    dateField: "issuedAt",
  },
  CAMPAIGN: {
    label: "Campaigns",
    groupBy: ["status"] as const,
    metricFields: [] as const,
    dateField: "createdAt",
  },
} as const satisfies Record<
  (typeof WIDGET_SOURCES)[number],
  {
    label: string;
    groupBy: readonly string[];
    metricFields: readonly string[];
    dateField: string;
  }
>;

export const dashboardSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().trim().max(500).optional(),
  ),
});

export const widgetSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    kind: z.enum(WIDGET_KINDS),
    source: z.enum(WIDGET_SOURCES),
    metric: z.enum(WIDGET_METRICS),
    metricField: z.preprocess(
      (v) => (v === "" || v == null ? undefined : v),
      z.string().trim().max(60).optional(),
    ),
    groupBy: z.preprocess(
      (v) => (v === "" || v == null ? undefined : v),
      z.string().trim().max(60).optional(),
    ),
    rangeDays: z.coerce.number().int().min(1).max(3650).default(30),
  })
  .superRefine((v, ctx) => {
    const cat = SOURCE_CATALOG[v.source];
    if (v.groupBy && !cat.groupBy.includes(v.groupBy as never)) {
      ctx.addIssue({ code: "custom", path: ["groupBy"], message: `groupBy must be one of: ${cat.groupBy.join(", ") || "(none)"}` });
    }
    if (v.metric === "COUNT" && v.metricField) {
      ctx.addIssue({ code: "custom", path: ["metricField"], message: "COUNT does not use a metric field" });
    }
    if (v.metric !== "COUNT") {
      if (!v.metricField) {
        ctx.addIssue({ code: "custom", path: ["metricField"], message: `metric ${v.metric} requires a numeric field` });
      } else if (!cat.metricFields.includes(v.metricField as never)) {
        ctx.addIssue({ code: "custom", path: ["metricField"], message: `metricField must be one of: ${cat.metricFields.join(", ") || "(none)"}` });
      }
    }
    if ((v.kind === "BAR" || v.kind === "PIE" || v.kind === "TABLE") && !v.groupBy) {
      ctx.addIssue({ code: "custom", path: ["groupBy"], message: `${v.kind} widgets require a groupBy field` });
    }
  });

export type DashboardInput = z.infer<typeof dashboardSchema>;
export type WidgetInput = z.infer<typeof widgetSchema>;

export type WidgetSourceLiteral = (typeof WIDGET_SOURCES)[number];
export type WidgetKindLiteral = (typeof WIDGET_KINDS)[number];
export type WidgetMetricLiteral = (typeof WIDGET_METRICS)[number];

// Re-export Prisma enums for convenience.
export type { WidgetKind, WidgetMetric, WidgetSource };
