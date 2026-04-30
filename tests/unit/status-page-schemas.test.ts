import { describe, expect, it } from "vitest";
import {
  componentSchema,
  componentStateColor,
  deriveOverallStatus,
  formatComponentState,
  formatIncidentImpact,
  formatIncidentState,
  incidentSchema,
  incidentUpdateSchema,
  overallHeadline,
} from "@/modules/status/schemas";

describe("componentSchema", () => {
  it("accepts a minimal component", () => {
    const r = componentSchema.safeParse({ name: "API", state: "OPERATIONAL" });
    expect(r.success).toBe(true);
  });

  it("requires a name", () => {
    expect(componentSchema.safeParse({ name: "", state: "OPERATIONAL" }).success).toBe(false);
  });

  it("rejects an unknown state", () => {
    expect(
      componentSchema.safeParse({ name: "API", state: "BROKEN" }).success,
    ).toBe(false);
  });

  it("caps name at 120 characters", () => {
    expect(
      componentSchema.safeParse({ name: "x".repeat(121), state: "OPERATIONAL" })
        .success,
    ).toBe(false);
  });
});

describe("incidentSchema", () => {
  const base = {
    title: "API errors",
    state: "INVESTIGATING",
    impact: "MAJOR",
    body: "We're investigating elevated 500s.",
  };

  it("accepts a complete incident", () => {
    expect(incidentSchema.safeParse(base).success).toBe(true);
  });

  it("requires a title and body", () => {
    expect(incidentSchema.safeParse({ ...base, title: "" }).success).toBe(false);
    expect(incidentSchema.safeParse({ ...base, body: "" }).success).toBe(false);
  });

  it("rejects unknown state or impact", () => {
    expect(incidentSchema.safeParse({ ...base, state: "X" }).success).toBe(false);
    expect(incidentSchema.safeParse({ ...base, impact: "FATAL" }).success).toBe(false);
  });
});

describe("incidentUpdateSchema", () => {
  it("requires state and body", () => {
    expect(
      incidentUpdateSchema.safeParse({ state: "MONITORING", body: "ok" }).success,
    ).toBe(true);
    expect(
      incidentUpdateSchema.safeParse({ state: "MONITORING", body: "" }).success,
    ).toBe(false);
  });
});

describe("deriveOverallStatus", () => {
  it("returns OPERATIONAL for empty input", () => {
    expect(deriveOverallStatus([])).toBe("OPERATIONAL");
  });

  it("returns OPERATIONAL when all components are operational", () => {
    expect(deriveOverallStatus(["OPERATIONAL", "OPERATIONAL"])).toBe("OPERATIONAL");
  });

  it("escalates to MAJOR_OUTAGE when any component is in major outage", () => {
    expect(
      deriveOverallStatus(["OPERATIONAL", "DEGRADED", "MAJOR_OUTAGE"]),
    ).toBe("MAJOR_OUTAGE");
  });

  it("escalates to PARTIAL_OUTAGE over DEGRADED", () => {
    expect(deriveOverallStatus(["DEGRADED", "PARTIAL_OUTAGE"])).toBe("PARTIAL_OUTAGE");
  });

  it("ranks MAINTENANCE below DEGRADED", () => {
    expect(deriveOverallStatus(["MAINTENANCE", "DEGRADED"])).toBe("DEGRADED");
  });

  it("returns MAINTENANCE when only maintenance is set", () => {
    expect(deriveOverallStatus(["MAINTENANCE", "OPERATIONAL"])).toBe("MAINTENANCE");
  });
});

describe("formatComponentState", () => {
  it("maps every state to a label", () => {
    expect(formatComponentState("OPERATIONAL")).toBe("Operational");
    expect(formatComponentState("DEGRADED")).toBe("Degraded performance");
    expect(formatComponentState("PARTIAL_OUTAGE")).toBe("Partial outage");
    expect(formatComponentState("MAJOR_OUTAGE")).toBe("Major outage");
    expect(formatComponentState("MAINTENANCE")).toBe("Under maintenance");
  });
});

describe("formatIncidentState / Impact", () => {
  it("maps incident states and impacts", () => {
    expect(formatIncidentState("INVESTIGATING")).toBe("Investigating");
    expect(formatIncidentState("RESOLVED")).toBe("Resolved");
    expect(formatIncidentImpact("CRITICAL")).toBe("Critical");
    expect(formatIncidentImpact("NONE")).toBe("No impact");
  });
});

describe("overallHeadline", () => {
  it("produces a headline per overall status", () => {
    expect(overallHeadline("OPERATIONAL")).toMatch(/operational/i);
    expect(overallHeadline("MAJOR_OUTAGE")).toMatch(/major outage/i);
    expect(overallHeadline("MAINTENANCE")).toMatch(/maintenance/i);
  });
});

describe("componentStateColor", () => {
  it("returns a tailwind class for every state", () => {
    expect(componentStateColor("OPERATIONAL")).toMatch(/emerald/);
    expect(componentStateColor("DEGRADED")).toMatch(/yellow/);
    expect(componentStateColor("PARTIAL_OUTAGE")).toMatch(/orange/);
    expect(componentStateColor("MAJOR_OUTAGE")).toMatch(/red/);
    expect(componentStateColor("MAINTENANCE")).toMatch(/blue/);
  });
});
