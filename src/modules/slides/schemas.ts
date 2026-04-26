import { z } from "zod";

export const PRESENTATION_STATUSES = [
  "DRAFT",
  "PUBLISHED",
  "ARCHIVED",
] as const;
export type PresentationStatus = (typeof PRESENTATION_STATUSES)[number];

export const PRESENTATION_STATUS_LABELS: Record<PresentationStatus, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

export const SLIDE_LAYOUTS = [
  "TITLE",
  "CONTENT",
  "TWO_COLUMN",
  "QUOTE",
  "IMAGE",
] as const;
export type SlideLayout = (typeof SLIDE_LAYOUTS)[number];

export const SLIDE_LAYOUT_LABELS: Record<SlideLayout, string> = {
  TITLE: "Title slide",
  CONTENT: "Content",
  TWO_COLUMN: "Two column",
  QUOTE: "Quote",
  IMAGE: "Image",
};

export const PRESENTATION_TRANSITIONS: Record<
  PresentationStatus,
  PresentationStatus[]
> = {
  DRAFT: ["PUBLISHED"],
  PUBLISHED: ["DRAFT", "ARCHIVED"],
  ARCHIVED: ["DRAFT"],
};

export function canTransitionPresentation(
  from: PresentationStatus,
  to: PresentationStatus,
): boolean {
  return PRESENTATION_TRANSITIONS[from].includes(to);
}

export const presentationSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(500).optional().or(z.literal("")),
});
export type PresentationInput = z.infer<typeof presentationSchema>;

export const slideSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().max(20_000).optional().default(""),
  notes: z.string().max(5_000).optional().or(z.literal("")),
  layout: z.enum(SLIDE_LAYOUTS).default("CONTENT"),
});
export type SlideInput = z.infer<typeof slideSchema>;

export function summarizePresentations(
  rows: { status: PresentationStatus }[],
): Record<PresentationStatus, number> & { total: number } {
  const out = {
    DRAFT: 0,
    PUBLISHED: 0,
    ARCHIVED: 0,
    total: rows.length,
  } as Record<PresentationStatus, number> & { total: number };
  for (const r of rows) out[r.status]++;
  return out;
}

/** Reorders an array of {id, position} after moving one item to a new index. */
export function reorderSlides<T extends { id: string }>(
  slides: T[],
  movedId: string,
  newIndex: number,
): { id: string; position: number }[] {
  const filtered = slides.filter((s) => s.id !== movedId);
  const moved = slides.find((s) => s.id === movedId);
  if (!moved) return slides.map((s, i) => ({ id: s.id, position: i }));
  const clamped = Math.max(0, Math.min(newIndex, filtered.length));
  filtered.splice(clamped, 0, moved);
  return filtered.map((s, i) => ({ id: s.id, position: i }));
}

export function nextSlidePosition(slides: { position: number }[]): number {
  if (slides.length === 0) return 0;
  return Math.max(...slides.map((s) => s.position)) + 1;
}

export function formatDate(date: Date | string | number): string {
  const d = typeof date === "object" ? date : new Date(date);
  return d.toLocaleDateString();
}

export function formatDateTime(date: Date | string | number): string {
  const d = typeof date === "object" ? date : new Date(date);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}
