import { z } from "zod";

export const WRITER_DOC_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
export type WriterDocStatus = (typeof WRITER_DOC_STATUSES)[number];

export const WRITER_DOC_STATUS_LABELS: Record<WriterDocStatus, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

export const WRITER_DOC_VISIBILITIES = [
  "PRIVATE",
  "WORKSPACE",
  "PUBLIC",
] as const;
export type WriterDocVisibility = (typeof WRITER_DOC_VISIBILITIES)[number];

export const WRITER_DOC_VISIBILITY_LABELS: Record<WriterDocVisibility, string> =
  {
    PRIVATE: "Only me",
    WORKSPACE: "Workspace",
    PUBLIC: "Public link",
  };

const optionalString = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .transform((v) => (v && v.trim().length > 0 ? v.trim() : undefined));

export const writerFolderSchema = z.object({
  name: z.string().min(1).max(160),
  parentId: optionalString(64),
});

export const writerDocSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().max(200_000).default(""),
  folderId: optionalString(64),
  status: z.enum(WRITER_DOC_STATUSES).default("DRAFT"),
  visibility: z.enum(WRITER_DOC_VISIBILITIES).default("WORKSPACE"),
});

export const WRITER_DOC_TRANSITIONS: Record<WriterDocStatus, WriterDocStatus[]> =
  {
    DRAFT: ["PUBLISHED"],
    PUBLISHED: ["DRAFT", "ARCHIVED"],
    ARCHIVED: ["DRAFT"],
  };

export function canTransitionDoc(
  from: WriterDocStatus,
  to: WriterDocStatus,
): boolean {
  return WRITER_DOC_TRANSITIONS[from].includes(to);
}

export function countWords(text: string): number {
  if (!text) return 0;
  const stripped = text
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!stripped) return 0;
  return stripped.split(" ").filter((w) => w.length > 0).length;
}

export function readingTimeMinutes(words: number): number {
  if (words <= 0) return 0;
  return Math.max(1, Math.round(words / 200));
}

export function formatReadingTime(words: number): string {
  const m = readingTimeMinutes(words);
  if (m === 0) return "—";
  return `${m} min read`;
}

export function summarizeDocs(
  docs: { status: WriterDocStatus }[],
): Record<WriterDocStatus, number> & { total: number } {
  const out = { DRAFT: 0, PUBLISHED: 0, ARCHIVED: 0, total: docs.length };
  for (const d of docs) out[d.status] += 1;
  return out;
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(d: Date): string {
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function diffWordCount(before: string, after: string): number {
  return countWords(after) - countWords(before);
}

export type FolderNode = {
  id: string;
  name: string;
  parentId: string | null;
  children: FolderNode[];
};

export function buildFolderTree(
  folders: { id: string; name: string; parentId: string | null }[],
): FolderNode[] {
  const map = new Map<string, FolderNode>();
  for (const f of folders) {
    map.set(f.id, { id: f.id, name: f.name, parentId: f.parentId, children: [] });
  }
  const roots: FolderNode[] = [];
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortRec = (nodes: FolderNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    for (const n of nodes) sortRec(n.children);
  };
  sortRec(roots);
  return roots;
}

export function isDescendant(
  folders: { id: string; parentId: string | null }[],
  candidateAncestorId: string,
  candidateDescendantId: string,
): boolean {
  if (candidateAncestorId === candidateDescendantId) return true;
  const byId = new Map(folders.map((f) => [f.id, f]));
  let cur = byId.get(candidateDescendantId);
  let depth = 0;
  while (cur && cur.parentId && depth < 100) {
    if (cur.parentId === candidateAncestorId) return true;
    cur = byId.get(cur.parentId);
    depth += 1;
  }
  return false;
}
