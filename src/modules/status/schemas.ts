import { z } from "zod";

export const COMPONENT_STATES = [
  "OPERATIONAL",
  "DEGRADED",
  "PARTIAL_OUTAGE",
  "MAJOR_OUTAGE",
  "MAINTENANCE",
] as const;
export type ComponentState = (typeof COMPONENT_STATES)[number];

export const INCIDENT_STATES = [
  "INVESTIGATING",
  "IDENTIFIED",
  "MONITORING",
  "RESOLVED",
] as const;
export type IncidentState = (typeof INCIDENT_STATES)[number];

export const INCIDENT_IMPACTS = ["NONE", "MINOR", "MAJOR", "CRITICAL"] as const;
export type IncidentImpact = (typeof INCIDENT_IMPACTS)[number];

export const componentSchema = z.object({
  name: z.string().trim().min(1, "Name required").max(120),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  state: z.enum(COMPONENT_STATES).default("OPERATIONAL"),
});
export type ComponentInput = z.infer<typeof componentSchema>;

export const incidentSchema = z.object({
  title: z.string().trim().min(1, "Title required").max(200),
  state: z.enum(INCIDENT_STATES).default("INVESTIGATING"),
  impact: z.enum(INCIDENT_IMPACTS).default("MINOR"),
  body: z.string().trim().min(1, "Initial update required").max(5000),
});
export type IncidentInput = z.infer<typeof incidentSchema>;

export const incidentUpdateSchema = z.object({
  state: z.enum(INCIDENT_STATES),
  body: z.string().trim().min(1, "Update body required").max(5000),
});
export type IncidentUpdateInput = z.infer<typeof incidentUpdateSchema>;

const COMPONENT_RANK: Record<ComponentState, number> = {
  OPERATIONAL: 0,
  MAINTENANCE: 1,
  DEGRADED: 2,
  PARTIAL_OUTAGE: 3,
  MAJOR_OUTAGE: 4,
};

const COMPONENT_LABELS: Record<ComponentState, string> = {
  OPERATIONAL: "Operational",
  DEGRADED: "Degraded performance",
  PARTIAL_OUTAGE: "Partial outage",
  MAJOR_OUTAGE: "Major outage",
  MAINTENANCE: "Under maintenance",
};

const INCIDENT_STATE_LABELS: Record<IncidentState, string> = {
  INVESTIGATING: "Investigating",
  IDENTIFIED: "Identified",
  MONITORING: "Monitoring",
  RESOLVED: "Resolved",
};

const INCIDENT_IMPACT_LABELS: Record<IncidentImpact, string> = {
  NONE: "No impact",
  MINOR: "Minor",
  MAJOR: "Major",
  CRITICAL: "Critical",
};

/** Reduce many component states to a single overall status. Worst component wins. */
export function deriveOverallStatus(states: ComponentState[]): ComponentState {
  if (states.length === 0) return "OPERATIONAL";
  let worst: ComponentState = "OPERATIONAL";
  for (const s of states) {
    if (COMPONENT_RANK[s] > COMPONENT_RANK[worst]) worst = s;
  }
  return worst;
}

export function formatComponentState(s: ComponentState | string): string {
  return COMPONENT_LABELS[s as ComponentState] ?? String(s);
}

export function formatIncidentState(s: IncidentState | string): string {
  return INCIDENT_STATE_LABELS[s as IncidentState] ?? String(s);
}

export function formatIncidentImpact(i: IncidentImpact | string): string {
  return INCIDENT_IMPACT_LABELS[i as IncidentImpact] ?? String(i);
}

/** Tailwind color classes for a component state badge. */
export function componentStateColor(s: ComponentState): string {
  switch (s) {
    case "OPERATIONAL":
      return "bg-emerald-100 text-emerald-800";
    case "MAINTENANCE":
      return "bg-blue-100 text-blue-800";
    case "DEGRADED":
      return "bg-yellow-100 text-yellow-800";
    case "PARTIAL_OUTAGE":
      return "bg-orange-100 text-orange-800";
    case "MAJOR_OUTAGE":
      return "bg-red-100 text-red-800";
  }
}

/** Headline shown above the components on the public page. */
export function overallHeadline(overall: ComponentState): string {
  switch (overall) {
    case "OPERATIONAL":
      return "All systems operational";
    case "MAINTENANCE":
      return "Scheduled maintenance in progress";
    case "DEGRADED":
      return "Some systems experiencing degraded performance";
    case "PARTIAL_OUTAGE":
      return "Partial system outage";
    case "MAJOR_OUTAGE":
      return "Major outage in progress";
  }
}
