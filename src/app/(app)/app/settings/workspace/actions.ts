"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession, hasMinRole } from "@/lib/session";

const schema = z.object({
  name: z.string().min(1).max(80),
  currency: z.string().min(3).max(3),
  timezone: z.string().min(1).max(80),
});

export async function updateWorkspaceAction(fd: FormData) {
  const ctx = await requireSession();
  if (!hasMinRole(ctx.role, "ADMIN")) return { error: "Only admins can change workspace settings." };

  const parsed = schema.safeParse({
    name: fd.get("name"),
    currency: String(fd.get("currency") ?? "USD").toUpperCase(),
    timezone: fd.get("timezone"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  await prisma.workspace.update({ where: { id: ctx.workspaceId }, data: parsed.data });
  await prisma.auditLog.create({
    data: {
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: "update",
      resource: "workspace",
      resourceId: ctx.workspaceId,
    },
  });
  revalidatePath("/app/settings/workspace");
  return { ok: true };
}
