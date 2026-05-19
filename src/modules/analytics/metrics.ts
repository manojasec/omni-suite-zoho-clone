/**
 * Analytics metrics catalog — pure registry of metric definitions used by
 * dashboards, scorecards, and the BI surface. Defines how to aggregate a
 * source and which dimensions are valid drill targets.
 *
 * Zero deps. No Prisma imports — consumers map `source` to a delegate.
 */

export type MetricSource =
  | "DEAL"
  | "INVOICE"
  | "CONTACT"
  | "TICKET"
  | "TASK"
  | "PROJECT"
  | "EXPENSE"
  | "SUBSCRIPTION"
  | "SUBSCRIPTION_INVOICE"
  | "CAMPAIGN";

export type MetricAggregator = "COUNT" | "SUM" | "AVG" | "MIN" | "MAX";

export type MetricFormat = "number" | "currency" | "percent" | "duration";

export type MetricGrain = "day" | "week" | "month" | "quarter" | "year";

export type MetricDimension = {
  id: string;
  label: string;
  field: string;
};

export type MetricDefinition = {
  id: string;
  label: string;
  description: string;
  source: MetricSource;
  aggregator: MetricAggregator;
  /** Field to aggregate (omitted for COUNT). */
  valueField?: string;
  /** Date field used for time-bucketing. */
  dateField: string;
  format: MetricFormat;
  /** Allowed grouping/drill dimensions. */
  dimensions: MetricDimension[];
  /** Allowed time grains; defaults to day/week/month/quarter. */
  grains?: MetricGrain[];
  /** Optional positive direction for KPI deltas; "up" means higher is better. */
  goalDirection?: "up" | "down";
};

const DEFAULT_GRAINS: MetricGrain[] = ["day", "week", "month", "quarter"];

export const METRIC_CATALOG: Readonly<Record<string, MetricDefinition>> = Object.freeze({
  "deals.count": {
    id: "deals.count",
    label: "Deals created",
    description: "Number of deals created in the workspace.",
    source: "DEAL",
    aggregator: "COUNT",
    dateField: "createdAt",
    format: "number",
    dimensions: [
      { id: "stage", label: "Stage", field: "stage" },
      { id: "owner", label: "Owner", field: "ownerId" },
      { id: "source", label: "Source", field: "leadSource" },
    ],
    grains: DEFAULT_GRAINS,
    goalDirection: "up",
  },
  "deals.revenue": {
    id: "deals.revenue",
    label: "Deal revenue",
    description: "Total value of deals.",
    source: "DEAL",
    aggregator: "SUM",
    valueField: "amount",
    dateField: "createdAt",
    format: "currency",
    dimensions: [
      { id: "stage", label: "Stage", field: "stage" },
      { id: "owner", label: "Owner", field: "ownerId" },
    ],
    grains: DEFAULT_GRAINS,
    goalDirection: "up",
  },
  "invoices.collected": {
    id: "invoices.collected",
    label: "Invoices collected",
    description: "Total invoice amount marked as paid.",
    source: "INVOICE",
    aggregator: "SUM",
    valueField: "amount",
    dateField: "issuedAt",
    format: "currency",
    dimensions: [
      { id: "status", label: "Status", field: "status" },
      { id: "customer", label: "Customer", field: "customerId" },
    ],
    grains: DEFAULT_GRAINS,
    goalDirection: "up",
  },
  "tickets.open": {
    id: "tickets.open",
    label: "Open tickets",
    description: "Number of tickets created.",
    source: "TICKET",
    aggregator: "COUNT",
    dateField: "createdAt",
    format: "number",
    dimensions: [
      { id: "status", label: "Status", field: "status" },
      { id: "priority", label: "Priority", field: "priority" },
      { id: "assignee", label: "Assignee", field: "assigneeId" },
    ],
    grains: DEFAULT_GRAINS,
    goalDirection: "down",
  },
  "tasks.completed": {
    id: "tasks.completed",
    label: "Tasks completed",
    description: "Number of tasks marked done.",
    source: "TASK",
    aggregator: "COUNT",
    dateField: "completedAt",
    format: "number",
    dimensions: [
      { id: "project", label: "Project", field: "projectId" },
      { id: "assignee", label: "Assignee", field: "assigneeId" },
    ],
    grains: DEFAULT_GRAINS,
    goalDirection: "up",
  },
  "expenses.total": {
    id: "expenses.total",
    label: "Expenses",
    description: "Total expense amount.",
    source: "EXPENSE",
    aggregator: "SUM",
    valueField: "amount",
    dateField: "incurredAt",
    format: "currency",
    dimensions: [
      { id: "category", label: "Category", field: "category" },
      { id: "submitter", label: "Submitter", field: "submitterId" },
    ],
    grains: DEFAULT_GRAINS,
    goalDirection: "down",
  },
  "mrr": {
    id: "mrr",
    label: "MRR",
    description: "Monthly recurring revenue (active subscriptions).",
    source: "SUBSCRIPTION",
    aggregator: "SUM",
    valueField: "monthlyAmount",
    dateField: "startedAt",
    format: "currency",
    dimensions: [
      { id: "plan", label: "Plan", field: "planId" },
      { id: "status", label: "Status", field: "status" },
    ],
    grains: ["month", "quarter", "year"],
    goalDirection: "up",
  },
  "campaigns.delivered": {
    id: "campaigns.delivered",
    label: "Emails delivered",
    description: "Marketing emails delivered.",
    source: "CAMPAIGN",
    aggregator: "SUM",
    valueField: "delivered",
    dateField: "sentAt",
    format: "number",
    dimensions: [{ id: "channel", label: "Channel", field: "channel" }],
    grains: DEFAULT_GRAINS,
    goalDirection: "up",
  },
});

export type MetricId = keyof typeof METRIC_CATALOG;

export function listMetrics(): MetricDefinition[] {
  return Object.values(METRIC_CATALOG);
}

export function getMetric(id: string): MetricDefinition | null {
  return METRIC_CATALOG[id] ?? null;
}

export function metricsForSource(source: MetricSource): MetricDefinition[] {
  return listMetrics().filter((m) => m.source === source);
}

/** Returns true when `dimensionId` is a valid drill dimension for the metric. */
export function isValidDimension(metricId: string, dimensionId: string): boolean {
  const m = getMetric(metricId);
  if (!m) return false;
  return m.dimensions.some((d) => d.id === dimensionId);
}

/** Returns true when `grain` is allowed for the metric (defaults applied). */
export function isValidGrain(metricId: string, grain: MetricGrain): boolean {
  const m = getMetric(metricId);
  if (!m) return false;
  return (m.grains ?? DEFAULT_GRAINS).includes(grain);
}

/**
 * Compute a percent delta between `current` and `previous` and return the
 * UX-facing direction ("good" / "bad" / "flat") given the metric's goal
 * direction. Treats 0 → non-zero as a 100% change to avoid division by zero.
 */
export function deltaFor(
  metricId: string,
  current: number,
  previous: number,
): { percent: number; direction: "good" | "bad" | "flat" } {
  const m = getMetric(metricId);
  const goal = m?.goalDirection ?? "up";
  let percent: number;
  if (previous === 0) {
    percent = current === 0 ? 0 : 1;
  } else {
    percent = (current - previous) / Math.abs(previous);
  }
  let direction: "good" | "bad" | "flat";
  if (Math.abs(percent) < 1e-9) {
    direction = "flat";
  } else if ((percent > 0 && goal === "up") || (percent < 0 && goal === "down")) {
    direction = "good";
  } else {
    direction = "bad";
  }
  return { percent, direction };
}
