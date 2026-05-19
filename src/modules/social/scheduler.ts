/**
 * Social post scheduler — pure helpers.
 *
 * Selects which `SocialPost` rows are due to publish "now" and applies
 * per-platform body-length constraints from `social/schemas.ts`. Persistent
 * orchestration (job-queue enqueue, retry policy, platform API calls) lives
 * outside this module; here we only compute deterministic answers from
 * inputs.
 */

import { PLATFORM_LIMITS, type SocialPlatform } from "@/modules/social/schemas";

export interface ScheduledPostLite {
  id: string;
  status: "DRAFT" | "SCHEDULED" | "PUBLISHED" | "FAILED" | "CANCELLED";
  scheduledAt: Date | null;
  body: string;
  targets: { platform: SocialPlatform; accountId: string }[];
}

/**
 * Select posts whose `scheduledAt <= now`, status === "SCHEDULED", and all
 * target platforms accept the post body length. Posts with any violation are
 * returned as `rejected` for the caller to mark FAILED.
 */
export function selectDuePosts(
  posts: ScheduledPostLite[],
  now: Date = new Date(),
): { due: ScheduledPostLite[]; rejected: { post: ScheduledPostLite; reason: string }[] } {
  const due: ScheduledPostLite[] = [];
  const rejected: { post: ScheduledPostLite; reason: string }[] = [];
  for (const post of posts) {
    if (post.status !== "SCHEDULED") continue;
    if (!post.scheduledAt || post.scheduledAt.getTime() > now.getTime()) continue;
    if (post.targets.length === 0) {
      rejected.push({ post, reason: "no-targets" });
      continue;
    }
    const violation = post.targets.find((t) => {
      const limit = PLATFORM_LIMITS[t.platform];
      return limit != null && post.body.length > limit;
    });
    if (violation) {
      rejected.push({
        post,
        reason: `body-too-long-for-${violation.platform.toLowerCase()}`,
      });
      continue;
    }
    due.push(post);
  }
  return { due, rejected };
}

/**
 * Plan a window of upcoming publish times for evenly-spaced rollout (e.g. a
 * day's content calendar). Returns N timestamps starting at `start`, spaced
 * by `intervalMs`. Excludes timestamps that already lie in the past.
 */
export function planSchedule(start: Date, intervalMs: number, count: number, now: Date = new Date()): Date[] {
  if (count <= 0 || intervalMs <= 0) return [];
  const out: Date[] = [];
  for (let i = 0; i < count; i++) {
    const t = new Date(start.getTime() + i * intervalMs);
    if (t.getTime() >= now.getTime()) out.push(t);
  }
  return out;
}
