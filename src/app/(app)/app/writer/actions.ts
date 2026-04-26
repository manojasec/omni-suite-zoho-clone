"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/modules/audit/record";
import {
  canTransitionDoc,
  countWords,
  isDescendant,
  writerDocSchema,
  writerFolderSchema,
  type WriterDocStatus,
} from "@/modules/writer/schemas";

function toFormObject(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

async function loadDoc(id: string, workspaceId: string) {
  return prisma.writerDoc.findFirst({ where: { id, workspaceId } });
}

async function loadFolder(id: string, workspaceId: string) {
  return prisma.writerFolder.findFirst({ where: { id, workspaceId } });
}

export async function createWriterFolderAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "writerDoc", "create");
  const data = writerFolderSchema.parse(toFormObject(fd));

  if (data.parentId) {
    const parent = await loadFolder(data.parentId, ctx.workspaceId);
    if (!parent) throw new Error("Parent folder not found");
  }

  const f = await prisma.writerFolder.create({
    data: {
      workspaceId: ctx.workspaceId,
      name: data.name,
      parentId: data.parentId ?? null,
    },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "writerDoc",
    resourceId: f.id,
    diff: { folder: { name: f.name } },
  });
  revalidatePath("/app/writer");
}

export async function renameWriterFolderAction(folderId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "writerDoc", "edit");
  const folder = await loadFolder(folderId, ctx.workspaceId);
  if (!folder) throw new Error("Folder not found");
  const name = String(fd.get("name") ?? "").trim();
  if (!name || name.length > 160) throw new Error("Invalid name");

  await prisma.writerFolder.update({ where: { id: folderId }, data: { name } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "update",
    resource: "writerDoc",
    resourceId: folderId,
    diff: { from: folder.name, to: name },
  });
  revalidatePath("/app/writer");
}

export async function moveWriterFolderAction(folderId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "writerDoc", "edit");
  const folder = await loadFolder(folderId, ctx.workspaceId);
  if (!folder) throw new Error("Folder not found");
  const rawParent = String(fd.get("parentId") ?? "").trim();
  const parentId = rawParent.length > 0 ? rawParent : null;

  if (parentId) {
    const allFolders = await prisma.writerFolder.findMany({
      where: { workspaceId: ctx.workspaceId },
      select: { id: true, parentId: true },
    });
    if (isDescendant(allFolders, folderId, parentId)) {
      throw new Error("Cannot move a folder inside itself or its descendants.");
    }
    const parent = await loadFolder(parentId, ctx.workspaceId);
    if (!parent) throw new Error("Parent folder not found");
  }

  await prisma.writerFolder.update({
    where: { id: folderId },
    data: { parentId },
  });
  revalidatePath("/app/writer");
}

export async function deleteWriterFolderAction(folderId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "writerDoc", "delete");
  const folder = await loadFolder(folderId, ctx.workspaceId);
  if (!folder) throw new Error("Folder not found");

  const docCount = await prisma.writerDoc.count({ where: { folderId } });
  if (docCount > 0)
    throw new Error("Move documents out of this folder before deleting.");
  const childCount = await prisma.writerFolder.count({
    where: { parentId: folderId },
  });
  if (childCount > 0)
    throw new Error("This folder has subfolders. Remove them first.");

  await prisma.writerFolder.delete({ where: { id: folderId } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "writerDoc",
    resourceId: folderId,
    diff: { folder: { name: folder.name } },
  });
  revalidatePath("/app/writer");
}

export async function createWriterDocAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "writerDoc", "create");
  const data = writerDocSchema.parse(toFormObject(fd));

  if (data.folderId) {
    const folder = await loadFolder(data.folderId, ctx.workspaceId);
    if (!folder) throw new Error("Folder not found");
  }

  const doc = await prisma.writerDoc.create({
    data: {
      workspaceId: ctx.workspaceId,
      folderId: data.folderId ?? null,
      title: data.title,
      content: data.content,
      status: "DRAFT",
      visibility: data.visibility,
      authorId: ctx.userId,
      wordCount: countWords(data.content),
    },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "writerDoc",
    resourceId: doc.id,
    diff: { title: doc.title },
  });
  revalidatePath("/app/writer");
  redirect(`/app/writer/${doc.id}`);
}

export async function updateWriterDocAction(docId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "writerDoc", "edit");
  const doc = await loadDoc(docId, ctx.workspaceId);
  if (!doc) throw new Error("Doc not found");
  const data = writerDocSchema.parse(toFormObject(fd));

  if (data.folderId) {
    const folder = await loadFolder(data.folderId, ctx.workspaceId);
    if (!folder) throw new Error("Folder not found");
  }

  const contentChanged = data.content !== doc.content;
  const titleChanged = data.title !== doc.title;

  await prisma.$transaction(async (tx) => {
    if (contentChanged || titleChanged) {
      const last = await tx.writerDocVersion.findFirst({
        where: { docId },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      await tx.writerDocVersion.create({
        data: {
          docId,
          version: (last?.version ?? 0) + 1,
          title: doc.title,
          content: doc.content,
          authorId: ctx.userId,
        },
      });
    }
    await tx.writerDoc.update({
      where: { id: docId },
      data: {
        title: data.title,
        content: data.content,
        folderId: data.folderId ?? null,
        visibility: data.visibility,
        wordCount: countWords(data.content),
      },
    });
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "update",
    resource: "writerDoc",
    resourceId: docId,
    diff: { contentChanged, titleChanged },
  });
  revalidatePath(`/app/writer/${docId}`);
}

export async function transitionWriterDocAction(docId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "writerDoc", "edit");
  const doc = await loadDoc(docId, ctx.workspaceId);
  if (!doc) throw new Error("Doc not found");
  const to = String(fd.get("status") ?? "") as WriterDocStatus;
  if (!canTransitionDoc(doc.status, to))
    throw new Error(`Cannot transition ${doc.status} → ${to}`);

  await prisma.writerDoc.update({
    where: { id: docId },
    data: {
      status: to,
      publishedAt:
        to === "PUBLISHED" && !doc.publishedAt ? new Date() : doc.publishedAt,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "transition",
    resource: "writerDoc",
    resourceId: docId,
    diff: { from: doc.status, to },
  });
  revalidatePath(`/app/writer/${docId}`);
}

export async function deleteWriterDocAction(docId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "writerDoc", "delete");
  const doc = await loadDoc(docId, ctx.workspaceId);
  if (!doc) throw new Error("Doc not found");
  if (doc.status === "PUBLISHED")
    throw new Error("Archive the doc before deleting.");

  await prisma.writerDoc.delete({ where: { id: docId } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "writerDoc",
    resourceId: docId,
    diff: { title: doc.title },
  });
  revalidatePath("/app/writer");
  redirect("/app/writer");
}

export async function restoreWriterDocVersionAction(
  docId: string,
  fd: FormData,
) {
  const ctx = await requireSession();
  assertCan(ctx.role, "writerDoc", "edit");
  const doc = await loadDoc(docId, ctx.workspaceId);
  if (!doc) throw new Error("Doc not found");
  const versionId = String(fd.get("versionId") ?? "");
  const version = await prisma.writerDocVersion.findFirst({
    where: { id: versionId, docId },
  });
  if (!version) throw new Error("Version not found");

  await prisma.$transaction(async (tx) => {
    const last = await tx.writerDocVersion.findFirst({
      where: { docId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    await tx.writerDocVersion.create({
      data: {
        docId,
        version: (last?.version ?? 0) + 1,
        title: doc.title,
        content: doc.content,
        authorId: ctx.userId,
      },
    });
    await tx.writerDoc.update({
      where: { id: docId },
      data: {
        title: version.title,
        content: version.content,
        wordCount: countWords(version.content),
      },
    });
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "update",
    resource: "writerDoc",
    resourceId: docId,
    diff: { restored: { fromVersion: version.version } },
  });
  revalidatePath(`/app/writer/${docId}`);
}
