import { z } from "zod";

export const ENTRY_TYPES = ["FEATURE", "IMPROVEMENT", "FIX", "ANNOUNCEMENT"] as const;
export type EntryType = (typeof ENTRY_TYPES)[number];

export const ENTRY_STATUSES = ["DRAFT", "PUBLISHED"] as const;
export type EntryStatus = (typeof ENTRY_STATUSES)[number];

export function slugifyTitle(input: string): string {
  if (!input) return "";
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);
}

const SLUG_RE = /^[a-z0-9-]+$/;
export const entrySlugSchema = z
  .string()
  .trim()
  .min(1, "Slug required")
  .max(200)
  .regex(SLUG_RE, "Use lowercase letters, numbers, and dashes only");

const optional = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

export const changelogEntrySchema = z.object({
  title: z.string().trim().min(1, "Title required").max(200),
  slug: entrySlugSchema,
  excerpt: optional(500),
  body: z.string().trim().min(1, "Body required").max(50_000),
  type: z.enum(ENTRY_TYPES).default("FEATURE"),
  status: z.enum(ENTRY_STATUSES).default("DRAFT"),
});
export type ChangelogEntryInput = z.infer<typeof changelogEntrySchema>;

const TYPE_LABELS: Record<EntryType, string> = {
  FEATURE: "New",
  IMPROVEMENT: "Improved",
  FIX: "Fixed",
  ANNOUNCEMENT: "Announcement",
};

export function formatEntryType(t: EntryType | string): string {
  return TYPE_LABELS[t as EntryType] ?? String(t);
}

export function entryTypeColor(t: EntryType): string {
  switch (t) {
    case "FEATURE":
      return "bg-emerald-100 text-emerald-800";
    case "IMPROVEMENT":
      return "bg-blue-100 text-blue-800";
    case "FIX":
      return "bg-amber-100 text-amber-800";
    case "ANNOUNCEMENT":
      return "bg-purple-100 text-purple-800";
  }
}

/** Group published entries by ISO month key (e.g. "2025-04") for the public timeline. */
export function groupEntriesByMonth<T extends { publishedAt: Date | null; createdAt: Date }>(
  entries: T[],
): { key: string; label: string; entries: T[] }[] {
  const buckets = new Map<string, T[]>();
  for (const e of entries) {
    const d = e.publishedAt ?? e.createdAt;
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const list = buckets.get(key);
    if (list) list.push(e);
    else buckets.set(key, [e]);
  }
  return Array.from(buckets.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, list]) => {
      const [y, m] = key.split("-").map(Number);
      const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });
      return { key, label, entries: list };
    });
}
