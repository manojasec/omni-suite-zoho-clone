"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { recordAuditEvent } from "@/modules/audit/record";
import { encryptSecret, decryptSecret } from "@/modules/vault/crypto";
import {
  vaultFolderSchema,
  vaultItemSchema,
  vaultItemUpdateSchema,
} from "@/modules/vault/schemas";

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return v == null ? "" : String(v);
}

// ---------- Folders ----------

export async function createVaultFolderAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "vaultFolder", "create");
  const parsed = vaultFolderSchema.safeParse({ name: s(fd, "name") });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  const folder = await prisma.vaultFolder.create({
    data: { workspaceId: ctx.workspaceId, createdById: ctx.userId, name: parsed.data.name },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId, actorId: ctx.userId, action: "create", resource: "vaultFolder", resourceId: folder.id, diff: { name: folder.name },
  });
  revalidatePath("/app/vault");
}

export async function deleteVaultFolderAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "vaultFolder", "delete");
  const existing = await prisma.vaultFolder.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!existing) throw new Error("Folder not found");
  await prisma.vaultFolder.delete({ where: { id } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId, actorId: ctx.userId, action: "delete", resource: "vaultFolder", resourceId: id, diff: { name: existing.name },
  });
  revalidatePath("/app/vault");
}

// ---------- Items ----------

export async function createVaultItemAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "vaultItem", "create");
  const parsed = vaultItemSchema.safeParse({
    type: s(fd, "type") || "LOGIN",
    name: s(fd, "name"),
    username: s(fd, "username"),
    url: s(fd, "url"),
    notes: s(fd, "notes"),
    secret: s(fd, "secret"),
    folderId: s(fd, "folderId"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  if (parsed.data.folderId) {
    const folder = await prisma.vaultFolder.findFirst({ where: { id: parsed.data.folderId, workspaceId: ctx.workspaceId } });
    if (!folder) throw new Error("Folder not found");
  }
  const enc = encryptSecret(parsed.data.secret);
  const item = await prisma.vaultItem.create({
    data: {
      workspaceId: ctx.workspaceId,
      createdById: ctx.userId,
      type: parsed.data.type,
      name: parsed.data.name,
      username: parsed.data.username ?? null,
      url: parsed.data.url ?? null,
      notes: parsed.data.notes ?? null,
      folderId: parsed.data.folderId ?? null,
      secretCipher: enc.cipher,
      secretIv: enc.iv,
      secretTag: enc.tag,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId, actorId: ctx.userId, action: "create", resource: "vaultItem", resourceId: item.id, diff: { name: item.name, type: item.type },
  });
  redirect(`/app/vault/${item.id}`);
}

export async function updateVaultItemAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "vaultItem", "edit");
  const existing = await prisma.vaultItem.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!existing) throw new Error("Item not found");
  const parsed = vaultItemUpdateSchema.safeParse({
    type: s(fd, "type") || "LOGIN",
    name: s(fd, "name"),
    username: s(fd, "username"),
    url: s(fd, "url"),
    notes: s(fd, "notes"),
    secret: s(fd, "secret"),
    folderId: s(fd, "folderId"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  if (parsed.data.folderId) {
    const folder = await prisma.vaultFolder.findFirst({ where: { id: parsed.data.folderId, workspaceId: ctx.workspaceId } });
    if (!folder) throw new Error("Folder not found");
  }
  const data: Record<string, unknown> = {
    type: parsed.data.type,
    name: parsed.data.name,
    username: parsed.data.username ?? null,
    url: parsed.data.url ?? null,
    notes: parsed.data.notes ?? null,
    folderId: parsed.data.folderId ?? null,
  };
  if (parsed.data.secret && parsed.data.secret.length > 0) {
    const enc = encryptSecret(parsed.data.secret);
    data.secretCipher = enc.cipher;
    data.secretIv = enc.iv;
    data.secretTag = enc.tag;
  }
  await prisma.vaultItem.update({ where: { id }, data });
  await prisma.vaultAccessLog.create({
    data: { itemId: id, userId: ctx.userId, action: "edit" },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId, actorId: ctx.userId, action: "edit", resource: "vaultItem", resourceId: id, diff: { name: parsed.data.name },
  });
  revalidatePath(`/app/vault/${id}`);
}

export async function toggleFavoriteVaultItemAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "vaultItem", "edit");
  const existing = await prisma.vaultItem.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!existing) throw new Error("Item not found");
  await prisma.vaultItem.update({ where: { id }, data: { favorite: !existing.favorite } });
  revalidatePath("/app/vault");
  revalidatePath(`/app/vault/${id}`);
}

export async function deleteVaultItemAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "vaultItem", "delete");
  const existing = await prisma.vaultItem.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!existing) throw new Error("Item not found");
  await prisma.vaultItem.delete({ where: { id } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId, actorId: ctx.userId, action: "delete", resource: "vaultItem", resourceId: id, diff: { name: existing.name },
  });
  redirect("/app/vault");
}

/** Server action used by the reveal button. Returns plaintext + records the access. */
export async function revealVaultSecretAction(id: string): Promise<{ secret: string }> {
  const ctx = await requireSession();
  assertCan(ctx.role, "vaultItem", "view");
  const item = await prisma.vaultItem.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!item) throw new Error("Item not found");
  const secret = decryptSecret({
    cipher: item.secretCipher,
    iv: item.secretIv,
    tag: item.secretTag,
  });
  await prisma.vaultAccessLog.create({
    data: { itemId: id, userId: ctx.userId, action: "reveal" },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId, actorId: ctx.userId, action: "view", resource: "vaultItem", resourceId: id, diff: { reveal: true },
  });
  return { secret };
}
