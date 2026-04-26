import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

/** Filename validation: no path separators, no leading dot. */
const filenameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(160)
  .refine((v) => !v.includes("/") && !v.includes("\\"), "Slashes are not allowed")
  .refine((v) => !v.startsWith("."), "Names cannot start with a dot");

export const folderSchema = z.object({
  name: filenameSchema,
  description: optionalText(500),
  parentId: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().trim().min(1).optional()),
});
export type FolderInput = z.infer<typeof folderSchema>;

const MAX_FILE_BYTES = 100 * 1024 * 1024; // 100 MB metadata cap

export const fileAssetSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(260)
    .refine((v) => !v.includes("/") && !v.includes("\\"), "Slashes are not allowed"),
  mimeType: z
    .string()
    .trim()
    .min(1, "MIME type is required")
    .max(120)
    .regex(/^[a-zA-Z0-9!#$&^_.+-]+\/[a-zA-Z0-9!#$&^_.+-]+$/, "Invalid MIME type"),
  sizeBytes: z.coerce
    .number()
    .int()
    .nonnegative()
    .max(MAX_FILE_BYTES, "File exceeds 100 MB cap"),
  storageKey: z.string().trim().min(1).max(500),
  sha256: z
    .string()
    .trim()
    .regex(/^[a-fA-F0-9]{64}$/u, "Invalid sha256")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  description: optionalText(500),
  folderId: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().trim().min(1).optional()),
});
export type FileAssetInput = z.infer<typeof fileAssetSchema>;

export const fileRenameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(260)
    .refine((v) => !v.includes("/") && !v.includes("\\"), "Slashes are not allowed")
    .refine((v) => !v.startsWith("."), "Names cannot start with a dot"),
});

export const fileMoveSchema = z.object({
  folderId: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().trim().min(1).optional()),
});

/** Format byte count as human-readable string. */
export function formatBytes(bytes: number | bigint): string {
  const n = typeof bytes === "bigint" ? Number(bytes) : bytes;
  if (!Number.isFinite(n) || n < 0) return "0 B";
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v >= 10 ? 0 : 1)} ${units[i]}`;
}

/**
 * Build breadcrumb trail from a folder ancestry list (root → leaf).
 * Returns a list with an implicit root entry at index 0.
 */
export function buildBreadcrumb(ancestors: { id: string; name: string }[]): { id: string | null; name: string }[] {
  return [{ id: null, name: "Files" }, ...ancestors.map((a) => ({ id: a.id, name: a.name }))];
}

/** Detect a basic icon kind from MIME type. */
export function fileIconKind(mime: string): "image" | "video" | "audio" | "pdf" | "doc" | "sheet" | "archive" | "code" | "text" | "file" {
  const m = mime.toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  if (m === "application/pdf") return "pdf";
  if (m.includes("word") || m.includes("officedocument.wordprocessing")) return "doc";
  if (m.includes("sheet") || m.includes("excel") || m === "text/csv") return "sheet";
  if (m.includes("zip") || m.includes("rar") || m.includes("7z") || m.includes("tar")) return "archive";
  if (m === "application/json" || m.includes("javascript") || m.includes("xml")) return "code";
  if (m.startsWith("text/")) return "text";
  return "file";
}
