import { z } from "zod";

const slugRegex = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

const optionalString = (max: number) =>
  z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().trim().max(max).optional(),
  );

export const groupSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(slugRegex, "Use lowercase letters, numbers, and dashes."),
  name: z.string().trim().min(1).max(120),
  description: optionalString(500),
});
export type GroupInput = z.infer<typeof groupSchema>;

export const postSchema = z.object({
  title: optionalString(200),
  body: z.string().trim().min(1, "Body required").max(20_000),
  groupId: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().min(1).optional(),
  ),
});
export type PostInput = z.infer<typeof postSchema>;

export const commentSchema = z.object({
  body: z.string().trim().min(1, "Comment required").max(4_000),
});
export type CommentInput = z.infer<typeof commentSchema>;

/** Lowercase + replace invalid chars with dashes; trims dashes; max 80 chars. */
export function slugifyGroup(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Returns a short timeago label for the feed (e.g. "5m", "3h", "2d"). */
export function timeAgo(d: Date, now: Date = new Date()): string {
  const ms = Math.max(0, now.getTime() - d.getTime());
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo`;
  return `${Math.floor(mo / 12)}y`;
}
