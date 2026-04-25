"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signOut, auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/session";

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

/** Switch the current user's active workspace. */
export async function switchWorkspaceAction(workspaceId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Verify the user actually belongs to this workspace before trusting the cookie.
  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id, workspaceId, status: "ACTIVE" },
  });
  if (!membership) return;

  const jar = await cookies();
  jar.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/app");
}
