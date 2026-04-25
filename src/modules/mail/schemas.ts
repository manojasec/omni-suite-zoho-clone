import { z } from "zod";

export const MAIL_FOLDERS = ["INBOX", "SENT", "DRAFTS", "ARCHIVE", "TRASH"] as const;

const opt = (s: z.ZodTypeAny) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), s.optional());

const emailLine = z.string().trim().email();

/** Parse a comma/semicolon/newline separated list of email addresses. */
export function parseAddressList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const parts = raw
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  // Dedupe (case-insensitive) preserving order.
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const k = p.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
  }
  return out;
}

/** Build a 1-line preview from an HTML/plain body. */
export function makeSnippet(body: string, max = 120): string {
  const text = body
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

export const composeMailSchema = z
  .object({
    to: z.string().min(1, "At least one recipient is required"),
    cc: opt(z.string()),
    bcc: opt(z.string()),
    subject: z.string().trim().min(1).max(200),
    body: z.string().min(1).max(50_000),
  })
  .superRefine((v, ctx) => {
    const addrs = [
      ...parseAddressList(v.to),
      ...parseAddressList(v.cc),
      ...parseAddressList(v.bcc),
    ];
    if (addrs.length === 0) {
      ctx.addIssue({ code: "custom", message: "At least one recipient is required", path: ["to"] });
      return;
    }
    for (const a of addrs) {
      const ok = emailLine.safeParse(a).success;
      if (!ok) {
        ctx.addIssue({ code: "custom", message: `Invalid email address: ${a}`, path: ["to"] });
        return;
      }
    }
  });

export const replyMailSchema = z.object({
  body: z.string().min(1).max(50_000),
});

export const moveMailSchema = z.object({
  folder: z.enum(MAIL_FOLDERS),
});
