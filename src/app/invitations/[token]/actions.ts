"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function acceptInvitationAction(token: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const invite = await prisma.invitation.findUnique({
    where: { token },
    include: { workspace: true },
  });
  if (!invite) throw new Error("Invitation not found");
  if (invite.acceptedAt) throw new Error("Invitation already accepted");
  if (invite.expiresAt < new Date()) throw new Error("Invitation expired");

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.email.toLowerCase() !== invite.email.toLowerCase()) {
    throw new Error("This invitation was issued to a different email");
  }

  // Idempotent: if a membership already exists, just mark the invitation accepted.
  const existing = await prisma.membership.findFirst({
    where: { userId: user.id, workspaceId: invite.workspaceId },
  });

  await prisma.$transaction([
    existing
      ? prisma.membership.update({
          where: { id: existing.id },
          data: { status: "ACTIVE", role: invite.role },
        })
      : prisma.membership.create({
          data: {
            userId: user.id,
            workspaceId: invite.workspaceId,
            role: invite.role,
            status: "ACTIVE",
          },
        }),
    prisma.invitation.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        workspaceId: invite.workspaceId,
        actorId: user.id,
        action: "invitation.accepted",
        resource: "user",
        resourceId: user.id,
      },
    }),
  ]);
}
