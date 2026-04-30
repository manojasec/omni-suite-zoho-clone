import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { portalLinkStatus } from "@/modules/portal/schemas";

export type PortalContext = Awaited<ReturnType<typeof loadPortal>>;

/**
 * Load and validate a portal token. Calls notFound() if the token is missing,
 * revoked, expired, or scoped to a deleted customer/workspace.
 * Increments useCount + lastUsedAt as a side effect.
 */
export async function loadPortal(token: string) {
  if (!token || token.length < 16) notFound();

  const link = await prisma.portalAccess.findUnique({
    where: { token },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
          currency: true,
          workspaceId: true,
          workspace: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  });
  if (!link) notFound();

  const status = portalLinkStatus({
    revokedAt: link.revokedAt,
    expiresAt: link.expiresAt,
  });
  if (status !== "active") notFound();

  // Best-effort usage tracking; never block render on failure.
  prisma.portalAccess
    .update({
      where: { id: link.id },
      data: { lastUsedAt: new Date(), useCount: { increment: 1 } },
    })
    .catch(() => undefined);

  return {
    token,
    customer: link.customer,
    workspace: link.customer.workspace,
    expiresAt: link.expiresAt,
  };
}
