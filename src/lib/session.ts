import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SystemRole } from "@prisma/client";

export const ACTIVE_WORKSPACE_COOKIE = "omni_active_ws";

export type SessionContext = {
  userId: string;
  email: string;
  name: string | null;
  workspaceId: string;
  workspaceSlug: string;
  workspaceName: string;
  role: SystemRole;
};

/**
 * Resolve the current user + their active workspace.
 * The active workspace is read from the `omni_active_ws` cookie when present;
 * otherwise the user's earliest active membership is used.
 * Redirects to /login or /onboarding if missing.
 */
export async function requireSession(): Promise<SessionContext> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  const jar = await cookies();
  const preferred = jar.get(ACTIVE_WORKSPACE_COOKIE)?.value;

  let membership = preferred
    ? await prisma.membership.findFirst({
        where: { userId, status: "ACTIVE", workspaceId: preferred },
        include: { workspace: true, user: true },
      })
    : null;

  if (!membership) {
    membership = await prisma.membership.findFirst({
      where: { userId, status: "ACTIVE" },
      include: { workspace: true, user: true },
      orderBy: { createdAt: "asc" },
    });
  }

  if (!membership) redirect("/onboarding");

  return {
    userId,
    email: membership.user.email,
    name: membership.user.name,
    workspaceId: membership.workspaceId,
    workspaceSlug: membership.workspace.slug,
    workspaceName: membership.workspace.name,
    role: membership.role,
  };
}

const RANK: Record<SystemRole, number> = {
  OWNER: 100,
  ADMIN: 90,
  MANAGER: 70,
  FINANCE: 60,
  SALES: 50,
  AGENT: 50,
  MEMBER: 40,
  VIEWER: 10,
};

export function hasMinRole(role: SystemRole, min: SystemRole) {
  return RANK[role] >= RANK[min];
}

export function assertRole(role: SystemRole, min: SystemRole) {
  if (!hasMinRole(role, min)) {
    throw new Error("Forbidden");
  }
}

/** All workspaces the current user can switch into. Returns [] if signed out. */
export async function listMemberships() {
  const session = await auth();
  if (!session?.user?.id) return [];
  return prisma.membership.findMany({
    where: { userId: session.user.id, status: "ACTIVE" },
    include: { workspace: { select: { id: true, name: true, slug: true } } },
    orderBy: { createdAt: "asc" },
  });
}
