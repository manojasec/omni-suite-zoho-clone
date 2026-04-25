"use server";

import { randomBytes, createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { recordAuditEvent } from "@/modules/audit/record";

const SCOPES = ["read", "write", "admin"] as const;

const createSchema = z.object({
  name: z.string().min(1).max(80),
  scopes: z.array(z.enum(SCOPES)).min(1),
});

function hashKey(plain: string) {
  return createHash("sha256").update(plain).digest("hex");
}

export async function createApiKeyAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "settings.apiKeys", "create");

  const scopes = fd.getAll("scopes").map((s) => String(s));
  const parsed = createSchema.safeParse({ name: fd.get("name") ?? "", scopes });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const raw = randomBytes(24).toString("base64url");
  const prefix = raw.slice(0, 8);
  const plain = `omni_${prefix}_${raw}`;
  const hashedKey = hashKey(plain);

  const created = await prisma.apiKey.create({
    data: {
      workspaceId: ctx.workspaceId,
      name: parsed.data.name,
      scopes: parsed.data.scopes,
      prefix,
      hashedKey,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "apiKey",
    resourceId: created.id,
    diff: { name: parsed.data.name, scopes: parsed.data.scopes },
  });
  revalidatePath("/app/settings/api-keys");
  return { ok: true, id: created.id, key: plain };
}

export async function deleteApiKeyAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "settings.apiKeys", "delete");
  const result = await prisma.apiKey.deleteMany({
    where: { id, workspaceId: ctx.workspaceId },
  });
  if (result.count > 0) {
    await recordAuditEvent({
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: "delete",
      resource: "apiKey",
      resourceId: id,
    });
  }
  revalidatePath("/app/settings/api-keys");
}
