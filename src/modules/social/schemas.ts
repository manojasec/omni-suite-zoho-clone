import { z } from "zod";

export const SOCIAL_PLATFORMS = [
  "TWITTER",
  "LINKEDIN",
  "FACEBOOK",
  "INSTAGRAM",
  "THREADS",
  "MASTODON",
] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export const SOCIAL_PLATFORM_LABELS: Record<SocialPlatform, string> = {
  TWITTER: "Twitter / X",
  LINKEDIN: "LinkedIn",
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  THREADS: "Threads",
  MASTODON: "Mastodon",
};

/** Per-platform body length limits used for validation hints. */
export const PLATFORM_LIMITS: Record<SocialPlatform, number> = {
  TWITTER: 280,
  LINKEDIN: 3000,
  FACEBOOK: 5000,
  INSTAGRAM: 2200,
  THREADS: 500,
  MASTODON: 500,
};

export const SOCIAL_POST_STATUSES = [
  "DRAFT",
  "SCHEDULED",
  "PUBLISHED",
  "FAILED",
  "CANCELLED",
] as const;
export type SocialPostStatus = (typeof SOCIAL_POST_STATUSES)[number];

export const SOCIAL_POST_STATUS_LABELS: Record<SocialPostStatus, string> = {
  DRAFT: "Draft",
  SCHEDULED: "Scheduled",
  PUBLISHED: "Published",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

const optionalString = (max: number) =>
  z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().trim().max(max).optional(),
  );

const optionalUrl = (max: number) =>
  z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().trim().url().max(max).optional(),
  );

export const socialAccountSchema = z.object({
  platform: z.enum(SOCIAL_PLATFORMS),
  handle: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-zA-Z0-9._@-]+$/, "Use letters, numbers, '.', '_', '-' or '@' only."),
  displayName: optionalString(120),
  avatarUrl: optionalUrl(500),
});
export type SocialAccountInput = z.infer<typeof socialAccountSchema>;

const optionalDate = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.coerce.date().optional(),
);

export const socialPostSchema = z
  .object({
    body: z.string().trim().min(1, "Post body required").max(8000),
    mediaUrl: optionalUrl(500),
    scheduledAt: optionalDate,
    accountIds: z
      .array(z.string().min(1))
      .min(1, "Pick at least one social account"),
  })
  .superRefine((val, ctx) => {
    if (val.scheduledAt && val.scheduledAt.getTime() < Date.now() - 60_000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scheduledAt"],
        message: "Scheduled time must be in the future",
      });
    }
  });
export type SocialPostInput = z.infer<typeof socialPostSchema>;

/** Returns the names of platforms whose char limit is exceeded by the given body. */
export function platformsExceeded(body: string, platforms: SocialPlatform[]): SocialPlatform[] {
  return platforms.filter((p) => body.length > PLATFORM_LIMITS[p]);
}

/** Determines whether a draft post should be moved to SCHEDULED or PUBLISHED. */
export function nextStatusForPost(input: {
  scheduledAt: Date | null | undefined;
  publishNow: boolean;
}): SocialPostStatus {
  if (input.publishNow) return "PUBLISHED";
  if (input.scheduledAt) return "SCHEDULED";
  return "DRAFT";
}
