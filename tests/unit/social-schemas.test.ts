import { describe, it, expect } from "vitest";
import {
  socialAccountSchema,
  socialPostSchema,
  platformsExceeded,
  nextStatusForPost,
  PLATFORM_LIMITS,
  SOCIAL_PLATFORMS,
  SOCIAL_POST_STATUSES,
} from "@/modules/social/schemas";

describe("social account schema", () => {
  it("accepts valid handle and platform", () => {
    expect(socialAccountSchema.safeParse({ platform: "TWITTER", handle: "acme" }).success).toBe(true);
    expect(socialAccountSchema.safeParse({ platform: "MASTODON", handle: "user@host.tld" }).success).toBe(true);
  });

  it("rejects invalid handle and unknown platform", () => {
    expect(socialAccountSchema.safeParse({ platform: "TIKTOK", handle: "x" }).success).toBe(false);
    expect(socialAccountSchema.safeParse({ platform: "TWITTER", handle: "bad handle!" }).success).toBe(false);
    expect(socialAccountSchema.safeParse({ platform: "TWITTER", handle: "" }).success).toBe(false);
  });

  it("coerces blank optional fields and validates avatar URL", () => {
    const r = socialAccountSchema.safeParse({
      platform: "LINKEDIN",
      handle: "co",
      displayName: "",
      avatarUrl: "",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.displayName).toBeUndefined();
      expect(r.data.avatarUrl).toBeUndefined();
    }
    expect(
      socialAccountSchema.safeParse({
        platform: "LINKEDIN",
        handle: "co",
        avatarUrl: "not a url",
      }).success,
    ).toBe(false);
  });
});

describe("social post schema", () => {
  it("requires non-empty body and at least one account", () => {
    expect(socialPostSchema.safeParse({ body: "", accountIds: ["a"] }).success).toBe(false);
    expect(socialPostSchema.safeParse({ body: "hi", accountIds: [] }).success).toBe(false);
  });

  it("rejects scheduled times in the past", () => {
    const past = new Date(Date.now() - 5 * 60_000);
    expect(
      socialPostSchema.safeParse({ body: "hi", accountIds: ["a"], scheduledAt: past }).success,
    ).toBe(false);
  });

  it("accepts scheduled times in the future", () => {
    const future = new Date(Date.now() + 60 * 60_000);
    expect(
      socialPostSchema.safeParse({ body: "hi", accountIds: ["a"], scheduledAt: future }).success,
    ).toBe(true);
  });

  it("treats blank scheduledAt as undefined", () => {
    const r = socialPostSchema.safeParse({ body: "hi", accountIds: ["a"], scheduledAt: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.scheduledAt).toBeUndefined();
  });
});

describe("platformsExceeded", () => {
  it("flags only platforms with smaller limits", () => {
    const longish = "x".repeat(600);
    const result = platformsExceeded(longish, ["TWITTER", "LINKEDIN", "THREADS"]);
    expect(result).toContain("TWITTER");
    expect(result).toContain("THREADS");
    expect(result).not.toContain("LINKEDIN");
  });

  it("returns empty when within all limits", () => {
    expect(platformsExceeded("hi", ["TWITTER", "LINKEDIN"])).toEqual([]);
  });
});

describe("nextStatusForPost", () => {
  it("returns PUBLISHED when publishNow is set", () => {
    expect(nextStatusForPost({ scheduledAt: null, publishNow: true })).toBe("PUBLISHED");
    expect(nextStatusForPost({ scheduledAt: new Date(), publishNow: true })).toBe("PUBLISHED");
  });
  it("returns SCHEDULED when a scheduled time is set", () => {
    expect(nextStatusForPost({ scheduledAt: new Date(), publishNow: false })).toBe("SCHEDULED");
  });
  it("returns DRAFT otherwise", () => {
    expect(nextStatusForPost({ scheduledAt: null, publishNow: false })).toBe("DRAFT");
  });
});

describe("constants", () => {
  it("exposes the expected platforms and statuses", () => {
    expect(SOCIAL_PLATFORMS).toContain("TWITTER");
    expect(SOCIAL_PLATFORMS.length).toBe(6);
    expect(SOCIAL_POST_STATUSES).toEqual(["DRAFT", "SCHEDULED", "PUBLISHED", "FAILED", "CANCELLED"]);
    expect(PLATFORM_LIMITS.TWITTER).toBe(280);
  });
});
