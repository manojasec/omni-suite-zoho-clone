import { z } from "zod";

export const KB_ARTICLE_STATUSES = [
  "DRAFT",
  "PUBLISHED",
  "ARCHIVED",
] as const;
export type KbArticleStatus = (typeof KB_ARTICLE_STATUSES)[number];

export const KB_ARTICLE_STATUS_LABELS: Record<KbArticleStatus, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

export const KB_ARTICLE_TRANSITIONS: Record<
  KbArticleStatus,
  KbArticleStatus[]
> = {
  DRAFT: ["PUBLISHED"],
  PUBLISHED: ["DRAFT", "ARCHIVED"],
  ARCHIVED: ["DRAFT"],
};

export function canTransitionArticle(
  from: KbArticleStatus,
  to: KbArticleStatus,
): boolean {
  return KB_ARTICLE_TRANSITIONS[from].includes(to);
}

/**
 * Convert a free-form string into a URL-safe slug:
 * - lowercase
 * - replace non-alphanumerics with `-`
 * - collapse repeats
 * - trim leading/trailing dashes
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
}

const slugField = z
  .string()
  .trim()
  .max(160)
  .regex(/^[a-z0-9-]*$/, "Use lowercase letters, digits, and dashes only");

export const kbCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    slug: slugField.optional().or(z.literal("")),
    description: z.string().trim().max(500).optional().or(z.literal("")),
    parentId: z.string().optional().or(z.literal("")),
  })
  .transform((v) => ({
    ...v,
    slug: v.slug && v.slug.length > 0 ? v.slug : slugify(v.name),
    parentId: v.parentId && v.parentId.length > 0 ? v.parentId : undefined,
  }));
export type KbCategoryInput = z.infer<typeof kbCategorySchema>;

export const kbArticleSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    slug: slugField.optional().or(z.literal("")),
    excerpt: z.string().trim().max(500).optional().or(z.literal("")),
    body: z.string().max(200_000).optional().default(""),
    categoryId: z.string().optional().or(z.literal("")),
  })
  .transform((v) => ({
    ...v,
    slug: v.slug && v.slug.length > 0 ? v.slug : slugify(v.title),
    categoryId:
      v.categoryId && v.categoryId.length > 0 ? v.categoryId : undefined,
  }));
export type KbArticleInput = z.infer<typeof kbArticleSchema>;

export type CategoryNode = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  children: CategoryNode[];
};

export function buildCategoryTree(
  rows: { id: string; name: string; slug: string; parentId: string | null }[],
): CategoryNode[] {
  const map = new Map<string, CategoryNode>();
  for (const r of rows) map.set(r.id, { ...r, children: [] });
  const roots: CategoryNode[] = [];
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortFn = (a: CategoryNode, b: CategoryNode) =>
    a.name.localeCompare(b.name);
  roots.sort(sortFn);
  for (const n of map.values()) n.children.sort(sortFn);
  return roots;
}

export function isCategoryDescendant(
  rows: { id: string; parentId: string | null }[],
  ancestorId: string,
  descendantId: string,
): boolean {
  if (ancestorId === descendantId) return true;
  let current = rows.find((r) => r.id === descendantId);
  let depth = 0;
  while (current && current.parentId && depth < 100) {
    if (current.parentId === ancestorId) return true;
    current = rows.find((r) => r.id === current!.parentId);
    depth++;
  }
  return false;
}

export function summarizeArticles(
  rows: { status: KbArticleStatus }[],
): Record<KbArticleStatus, number> & { total: number } {
  const out = {
    DRAFT: 0,
    PUBLISHED: 0,
    ARCHIVED: 0,
    total: rows.length,
  } as Record<KbArticleStatus, number> & { total: number };
  for (const r of rows) out[r.status]++;
  return out;
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
