/**
 * Helpers for the public Help Center (`/help/[workspaceSlug]`).
 *
 * These are pure functions with no Prisma / next.js imports so they can be
 * unit-tested without the framework.
 */

export type PublicArticle = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  views: number;
  publishedAt: Date | null;
  categoryId: string | null;
};

export type PublicCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
};

/**
 * Naive substring search across title and excerpt. Case-insensitive.
 * Returns articles ordered by best match (title hit first, then excerpt hit).
 */
export function filterArticlesByQuery<T extends { title: string; excerpt: string | null }>(
  articles: T[],
  query: string,
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...articles];
  const titleHits: T[] = [];
  const excerptHits: T[] = [];
  for (const a of articles) {
    const t = a.title.toLowerCase();
    const e = (a.excerpt ?? "").toLowerCase();
    if (t.includes(q)) titleHits.push(a);
    else if (e.includes(q)) excerptHits.push(a);
  }
  return [...titleHits, ...excerptHits];
}

/**
 * Group articles by their categoryId. Articles with no category land under
 * the special key `"__uncategorized"`.
 */
export function groupArticlesByCategory<T extends { categoryId: string | null }>(
  articles: T[],
): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const a of articles) {
    const key = a.categoryId ?? "__uncategorized";
    (out[key] ??= []).push(a);
  }
  return out;
}

/** Pick the top N most-viewed published articles. */
export function pickPopularArticles<T extends { views: number; publishedAt: Date | null }>(
  articles: T[],
  limit: number,
): T[] {
  return [...articles]
    .filter((a) => a.publishedAt !== null)
    .sort((a, b) => {
      if (b.views !== a.views) return b.views - a.views;
      const ad = a.publishedAt ? a.publishedAt.getTime() : 0;
      const bd = b.publishedAt ? b.publishedAt.getTime() : 0;
      return bd - ad;
    })
    .slice(0, Math.max(0, limit));
}
