import { describe, expect, it } from "vitest";
import { audienceSchema, campaignSchema } from "@/modules/marketing/schemas";
import { compileAudienceWhere } from "@/modules/marketing/audience";

describe("marketing/audienceSchema", () => {
  it("requires a name", () => {
    expect(audienceSchema.safeParse({ name: "", filterDsl: {} }).success).toBe(false);
  });
  it("rejects unknown lifecycle stages", () => {
    expect(
      audienceSchema.safeParse({ name: "VIPs", filterDsl: { stage: ["GHOST"] } }).success,
    ).toBe(false);
  });
  it("accepts a valid audience definition", () => {
    const r = audienceSchema.parse({
      name: "Newsletter",
      filterDsl: { stage: ["LEAD", "MQL"], hasEmail: true, tag: ["nl"] },
    });
    expect(r.filterDsl.stage).toEqual(["LEAD", "MQL"]);
  });
});

describe("marketing/campaignSchema", () => {
  it("requires subject and body", () => {
    expect(campaignSchema.safeParse({ name: "X", subject: "", html: "" }).success).toBe(false);
  });
  it("normalises empty audienceId to null", () => {
    const r = campaignSchema.parse({ name: "X", subject: "Hi", html: "<p>Hi</p>", audienceId: "" });
    expect(r.audienceId).toBeNull();
  });
});

describe("marketing/compileAudienceWhere", () => {
  it("always scopes to workspace", () => {
    expect(compileAudienceWhere("ws_1", {})).toEqual({ workspaceId: "ws_1" });
  });
  it("compiles stage + tag + hasEmail", () => {
    const w = compileAudienceWhere("ws_1", {
      stage: ["LEAD", "MQL"],
      tag: ["vip"],
      hasEmail: true,
    });
    expect(w).toEqual({
      workspaceId: "ws_1",
      lifecycleStage: { in: ["LEAD", "MQL"] },
      email: { not: null },
    });
  });
});
