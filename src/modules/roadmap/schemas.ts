import { z } from "zod";

export const ROADMAP_STATUSES = ["PLANNED", "IN_PROGRESS", "SHIPPED"] as const;
export type RoadmapStatus = (typeof ROADMAP_STATUSES)[number];

const STATUS_LABELS: Record<RoadmapStatus, string> = {
  PLANNED: "Planned",
  IN_PROGRESS: "In progress",
  SHIPPED: "Shipped",
};

const STATUS_COLORS: Record<RoadmapStatus, string> = {
  PLANNED: "bg-slate-100 text-slate-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  SHIPPED: "bg-emerald-100 text-emerald-800",
};

export function formatRoadmapStatus(s: RoadmapStatus | string): string {
  return STATUS_LABELS[s as RoadmapStatus] ?? String(s);
}

export function roadmapStatusColor(s: RoadmapStatus): string {
  return STATUS_COLORS[s];
}

const optional = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

export const roadmapItemSchema = z.object({
  title: z.string().trim().min(1, "Title required").max(200),
  description: optional(5_000),
  category: optional(80),
  status: z.enum(ROADMAP_STATUSES).default("PLANNED"),
  isPublic: z.boolean().default(true),
});
export type RoadmapItemInput = z.infer<typeof roadmapItemSchema>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const voteEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(160)
  .regex(EMAIL_RE, "Enter a valid email");

/**
 * Bucket items by status for the public roadmap board. Within each bucket,
 * items are ordered by `voteCount` desc, then `position` asc, then title.
 */
export function groupItemsByStatus<
  T extends {
    status: RoadmapStatus | string;
    voteCount: number;
    position: number;
    title: string;
  },
>(items: T[]): Record<RoadmapStatus, T[]> {
  const out: Record<RoadmapStatus, T[]> = {
    PLANNED: [],
    IN_PROGRESS: [],
    SHIPPED: [],
  };
  for (const it of items) {
    const key = it.status as RoadmapStatus;
    if (out[key]) out[key].push(it);
  }
  for (const key of ROADMAP_STATUSES) {
    out[key].sort((a, b) => {
      if (a.voteCount !== b.voteCount) return b.voteCount - a.voteCount;
      if (a.position !== b.position) return a.position - b.position;
      return a.title.localeCompare(b.title);
    });
  }
  return out;
}
