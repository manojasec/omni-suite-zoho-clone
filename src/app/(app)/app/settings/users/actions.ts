"use server";

import { z } from "zod";
import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession, hasMinRole } from "@/lib/session";
import { SystemRole } from "@prisma/client";

const inviteSchema = z.object({
  email: z.string().email().max(200),
  role: z.nativeEnum(SystemRole),
});

export async function inviteUserAction(fd: FormData) {
  const ctx = await requireSession();
  if (!hasMinRole(ctx.role, "ADMIN")) return { error: "Only admins can invite users." };

  const parsed = inviteSchema.safeParse({
    email: String(fd.get("email") ?? "").toLowerCase().trim(),
    role: fd.get("role"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.invitation.create({
    data: {
      workspaceId: ctx.workspaceId,
      email: parsed.data.email,
      role: parsed.data.role,
      token,
      expiresAt,
    },
  });
  await prisma.auditLog.create({
    data: {
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: "invite",
      resource: "user",
      resourceId: parsed.data.email,
    },
  });
  revalidatePath("/app/settings/users");
  return { ok: true, message: `Invite created. Share link: /invitations/${token}` };
}

export async function changeRoleAction(membershipId: string, role: SystemRole) {
  const ctx = await requireSession();
  if (!hasMinRole(ctx.role, "ADMIN")) return;
  const m = await prisma.membership.findFirst({
    where: { id: membershipId, workspaceId: ctx.workspaceId },
  });
  if (!m) return;
  if (m.role === "OWNER" && ctx.role !== "OWNER") return;
  await prisma.membership.update({ where: { id: membershipId }, data: { role } });
  revalidatePath("/app/settings/users");
}
