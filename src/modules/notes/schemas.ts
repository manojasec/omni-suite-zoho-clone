import { z } from "zod";

export const NOTE_COLORS = ["slate", "rose", "amber", "emerald", "sky", "violet"] as const;

export const notebookSchema = z.object({
  name: z.string().trim().min(1).max(160),
  color: z.enum(NOTE_COLORS).default("slate"),
});

export const noteSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().max(50000).default(""),
  notebookId: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().min(1).optional(),
  ),
});

export type NotebookInput = z.infer<typeof notebookSchema>;
export type NoteInput = z.infer<typeof noteSchema>;

export function colorClass(color: string): string {
  switch (color) {
    case "rose": return "bg-rose-100 text-rose-800 border-rose-200";
    case "amber": return "bg-amber-100 text-amber-800 border-amber-200";
    case "emerald": return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "sky": return "bg-sky-100 text-sky-800 border-sky-200";
    case "violet": return "bg-violet-100 text-violet-800 border-violet-200";
    default: return "bg-slate-100 text-slate-800 border-slate-200";
  }
}
