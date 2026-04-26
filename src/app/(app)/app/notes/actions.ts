"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { recordAuditEvent } from "@/modules/audit/record";
import { notebookSchema, noteSchema } from "@/modules/notes/schemas";

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return v == null ? "" : String(v);
}

// ---------- Notebooks ----------

export async function createNotebookAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "notebook", "create");
  const parsed = notebookSchema.safeParse({ name: s(fd, "name"), color: s(fd, "color") || "slate" });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  const nb = await prisma.notebook.create({
    data: {
      workspaceId: ctx.workspaceId,
      createdById: ctx.userId,
      name: parsed.data.name,
      color: parsed.data.color,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId, actorId: ctx.userId, action: "create", resource: "notebook", resourceId: nb.id, diff: { name: nb.name },
  });
  revalidatePath("/app/notes");
}

export async function deleteNotebookAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "notebook", "delete");
  const existing = await prisma.notebook.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!existing) throw new Error("Notebook not found");
  await prisma.notebook.delete({ where: { id } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId, actorId: ctx.userId, action: "delete", resource: "notebook", resourceId: id, diff: { name: existing.name },
  });
  revalidatePath("/app/notes");
}

// ---------- Notes ----------

export async function createNoteAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "note", "create");
  const parsed = noteSchema.safeParse({
    title: s(fd, "title"),
    content: s(fd, "content"),
    notebookId: s(fd, "notebookId"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  if (parsed.data.notebookId) {
    const nb = await prisma.notebook.findFirst({ where: { id: parsed.data.notebookId, workspaceId: ctx.workspaceId } });
    if (!nb) throw new Error("Notebook not found");
  }
  const note = await prisma.note.create({
    data: {
      workspaceId: ctx.workspaceId,
      createdById: ctx.userId,
      title: parsed.data.title,
      content: parsed.data.content,
      notebookId: parsed.data.notebookId ?? null,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId, actorId: ctx.userId, action: "create", resource: "note", resourceId: note.id, diff: { title: note.title },
  });
  redirect(`/app/notes/${note.id}`);
}

export async function updateNoteAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "note", "edit");
  const existing = await prisma.note.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!existing) throw new Error("Note not found");
  const parsed = noteSchema.safeParse({
    title: s(fd, "title"),
    content: s(fd, "content"),
    notebookId: s(fd, "notebookId"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  if (parsed.data.notebookId) {
    const nb = await prisma.notebook.findFirst({ where: { id: parsed.data.notebookId, workspaceId: ctx.workspaceId } });
    if (!nb) throw new Error("Notebook not found");
  }
  await prisma.note.update({
    where: { id },
    data: {
      title: parsed.data.title,
      content: parsed.data.content,
      notebookId: parsed.data.notebookId ?? null,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId, actorId: ctx.userId, action: "edit", resource: "note", resourceId: id, diff: { title: parsed.data.title },
  });
  revalidatePath(`/app/notes/${id}`);
}

export async function togglePinNoteAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "note", "edit");
  const existing = await prisma.note.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!existing) throw new Error("Note not found");
  await prisma.note.update({ where: { id }, data: { pinned: !existing.pinned } });
  revalidatePath("/app/notes");
  revalidatePath(`/app/notes/${id}`);
}

export async function toggleArchiveNoteAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "note", "edit");
  const existing = await prisma.note.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!existing) throw new Error("Note not found");
  await prisma.note.update({ where: { id }, data: { archived: !existing.archived } });
  revalidatePath("/app/notes");
  revalidatePath(`/app/notes/${id}`);
}

export async function deleteNoteAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "note", "delete");
  const existing = await prisma.note.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!existing) throw new Error("Note not found");
  await prisma.note.delete({ where: { id } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId, actorId: ctx.userId, action: "delete", resource: "note", resourceId: id, diff: { title: existing.title },
  });
  redirect("/app/notes");
}
