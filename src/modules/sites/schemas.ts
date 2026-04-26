import { z } from "zod";

export const SITE_PAGE_STATUSES = ["DRAFT", "PUBLISHED"] as const;
export type SitePageStatus = (typeof SITE_PAGE_STATUSES)[number];
export const SITE_PAGE_STATUS_LABELS: Record<SitePageStatus, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
};

const slugRegex = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

const optionalString = (max: number) =>
  z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().trim().max(max).optional(),
  );

export const siteSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(slugRegex, "Use lowercase letters, numbers, and dashes."),
  name: z.string().trim().min(1).max(120),
  description: optionalString(500),
  themeColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #0f172a")
    .default("#0f172a"),
});

export type SiteInput = z.infer<typeof siteSchema>;

export const sitePageSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(slugRegex, "Use lowercase letters, numbers, and dashes."),
  title: z.string().trim().min(1).max(200),
  body: z.string().min(0).max(200_000),
  status: z.enum(SITE_PAGE_STATUSES).default("DRAFT"),
  isHome: z.coerce.boolean().optional().default(false),
  position: z.coerce.number().int().min(0).max(10_000).optional().default(0),
});

export type SitePageInput = z.infer<typeof sitePageSchema>;

/** Lowercase + replace invalid chars with dashes; trims dashes; max 80 chars. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Tiny markdown-ish renderer: paragraphs, **bold**, *italic*, # headings, [text](href), --- hr.
 *  Returns sanitized HTML (no script/style/iframe). */
export function renderSiteMarkdown(src: string): string {
  // Escape HTML first.
  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let para: string[] = [];

  const flushPara = () => {
    if (para.length === 0) return;
    out.push(`<p>${inline(para.join(" "))}</p>`);
    para = [];
  };

  function inline(s: string): string {
    let t = esc(s);
    // links [text](http(s)://...)
    t = t.replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      (_m, text: string, href: string) =>
        `<a href="${href}" rel="noopener noreferrer">${text}</a>`,
    );
    t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    t = t.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    return t;
  }

  for (const raw of lines) {
    const line = raw.trim();
    if (line === "") {
      flushPara();
      continue;
    }
    if (line === "---") {
      flushPara();
      out.push("<hr />");
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      flushPara();
      const level = h[1].length;
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      continue;
    }
    para.push(line);
  }
  flushPara();
  return out.join("\n");
}
