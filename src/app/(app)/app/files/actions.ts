"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { recordAuditEvent } from "@/modules/audit/record";
import {
  fileAssetSchema,
  fileMoveSchema,
  fileRenameSchema,
  folderSchema,
} from "@/modules/files/schemas";

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return v == null ? "" : String(v);
}

async function assertFolderInWorkspace(workspaceId: string, folderId: string | undefined): Promise<string | null> {
  if (!folderId) return null;
  const f = await prisma.folder.findFirst({ where: { id: folderId, workspaceId }, select: { id: true } });
  if (!f) throw new Error("Folder not found");
  return f.id;
}

// ===== Folders =====

export async function createFolderAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "folder", "create");
  const parsed = folderSchema.safeParse({
    name: s(fd, "name"),
    description: s(fd, "description"),
    parentId: s(fd, "parentId") || undefined,
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  const parentId = await assertFolderInWorkspace(ctx.workspaceId, parsed.data.parentId);
  const folder = await prisma.folder.create({
    data: {
      workspaceId: ctx.workspaceId,
      createdById: ctx.userId,
      name: parsed.data.name,
      description: parsed.data.description || null,
      parentId,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "folder",
    resourceId: folder.id,
    diff: { name: folder.name, parentId: folder.parentId },
  });
  redirect(parentId ? `/app/files/${parentId}` : "/app/files");
}

export async function renameFolderAction(folderId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "folder", "edit");
  const parsed = fileRenameSchema.safeParse({ name: s(fd, "name") });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  const existing = await prisma.folder.findFirst({ where: { id: folderId, workspaceId: ctx.workspaceId } });
  if (!existing) throw new Error("Folder not found");
  await prisma.folder.update({ where: { id: folderId }, data: { name: parsed.data.name } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "folder",
    resourceId: folderId,
    diff: { name: { from: existing.name, to: parsed.data.name } },
  });
  redirect(existing.parentId ? `/app/files/${existing.parentId}` : "/app/files");
}

export async function deleteFolderAction(folderId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "folder", "delete");
  const existing = await prisma.folder.findFirst({ where: { id: folderId, workspaceId: ctx.workspaceId } });
  if (!existing) throw new Error("Folder not found");
  // Refuse if non-empty (prevent accidental cascade).
  const [childCount, fileCount] = await Promise.all([
    prisma.folder.count({ where: { parentId: folderId } }),
    prisma.fileAsset.count({ where: { folderId, trashedAt: null } }),
  ]);
  if (childCount > 0 || fileCount > 0) throw new Error("Folder is not empty");
  await prisma.folder.delete({ where: { id: folderId } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "folder",
    resourceId: folderId,
    diff: { name: existing.name },
  });
  redirect(existing.parentId ? `/app/files/${existing.parentId}` : "/app/files");
}

// ===== Files =====

export async function createFileAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "fileAsset", "create");
  const parsed = fileAssetSchema.safeParse({
    name: s(fd, "name"),
    mimeType: s(fd, "mimeType") || "application/octet-stream",
    sizeBytes: s(fd, "sizeBytes") || "0",
    storageKey: s(fd, "storageKey"),
    sha256: s(fd, "sha256") || undefined,
    description: s(fd, "description"),
    folderId: s(fd, "folderId") || undefined,
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  const folderId = await assertFolderInWorkspace(ctx.workspaceId, parsed.data.folderId);
  const file = await prisma.fileAsset.create({
    data: {
      workspaceId: ctx.workspaceId,
      createdById: ctx.userId,
      name: parsed.data.name,
      mimeType: parsed.data.mimeType,
      sizeBytes: BigInt(parsed.data.sizeBytes),
      storageKey: parsed.data.storageKey,
      sha256: parsed.data.sha256 || null,
      description: parsed.data.description || null,
      folderId,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "fileAsset",
    resourceId: file.id,
    diff: { name: file.name, sizeBytes: parsed.data.sizeBytes, folderId },
  });
  redirect(folderId ? `/app/files/${folderId}` : "/app/files");
}

export async function renameFileAction(fileId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "fileAsset", "edit");
  const parsed = fileRenameSchema.safeParse({ name: s(fd, "name") });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  const existing = await prisma.fileAsset.findFirst({ where: { id: fileId, workspaceId: ctx.workspaceId } });
  if (!existing) throw new Error("File not found");
  await prisma.fileAsset.update({ where: { id: fileId }, data: { name: parsed.data.name } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "fileAsset",
    resourceId: fileId,
    diff: { name: { from: existing.name, to: parsed.data.name } },
  });
  redirect(existing.folderId ? `/app/files/${existing.folderId}` : "/app/files");
}

export async function moveFileAction(fileId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "fileAsset", "edit");
  const parsed = fileMoveSchema.safeParse({ folderId: s(fd, "folderId") || undefined });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  const existing = await prisma.fileAsset.findFirst({ where: { id: fileId, workspaceId: ctx.workspaceId } });
  if (!existing) throw new Error("File not found");
  const folderId = await assertFolderInWorkspace(ctx.workspaceId, parsed.data.folderId);
  await prisma.fileAsset.update({ where: { id: fileId }, data: { folderId } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "fileAsset",
    resourceId: fileId,
    diff: { folderId: { from: existing.folderId, to: folderId } },
  });
  redirect(folderId ? `/app/files/${folderId}` : "/app/files");
}

export async function toggleStarFileAction(fileId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "fileAsset", "edit");
  const existing = await prisma.fileAsset.findFirst({ where: { id: fileId, workspaceId: ctx.workspaceId } });
  if (!existing) throw new Error("File not found");
  const next = !existing.starred;
  await prisma.fileAsset.update({ where: { id: fileId }, data: { starred: next } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "fileAsset",
    resourceId: fileId,
    diff: { starred: { from: existing.starred, to: next } },
  });
}

export async function trashFileAction(fileId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "fileAsset", "delete");
  const existing = await prisma.fileAsset.findFirst({ where: { id: fileId, workspaceId: ctx.workspaceId } });
  if (!existing) throw new Error("File not found");
  await prisma.fileAsset.update({ where: { id: fileId }, data: { trashedAt: new Date() } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "fileAsset",
    resourceId: fileId,
    diff: { trashed: true },
  });
}

export async function restoreFileAction(fileId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "fileAsset", "edit");
  const existing = await prisma.fileAsset.findFirst({ where: { id: fileId, workspaceId: ctx.workspaceId } });
  if (!existing) throw new Error("File not found");
  await prisma.fileAsset.update({ where: { id: fileId }, data: { trashedAt: null } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "fileAsset",
    resourceId: fileId,
    diff: { trashed: false },
  });
}

export async function deleteFileAction(fileId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "fileAsset", "delete");
  const existing = await prisma.fileAsset.findFirst({ where: { id: fileId, workspaceId: ctx.workspaceId } });
  if (!existing) throw new Error("File not found");
  if (!existing.trashedAt) throw new Error("File must be trashed before permanent delete");
  await prisma.fileAsset.delete({ where: { id: fileId } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "fileAsset",
    resourceId: fileId,
    diff: { name: existing.name, permanent: true },
  });
}
