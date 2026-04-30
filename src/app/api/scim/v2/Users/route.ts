import crypto from "crypto";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

async function authenticate(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const row = await prisma.scimToken.findUnique({
    where: { tokenHash },
    select: { id: true, workspaceId: true, revokedAt: true },
  });
  if (!row || row.revokedAt) return null;
  await prisma.scimToken.update({
    where: { id: row.id },
    data: { lastUsedAt: new Date() },
  });
  return { workspaceId: row.workspaceId };
}

const scimError = (status: number, detail: string) =>
  new Response(
    JSON.stringify({
      schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
      status: String(status),
      detail,
    }),
    {
      status,
      headers: { "Content-Type": "application/scim+json" },
    },
  );

function userResource(u: {
  id: string;
  email: string;
  name: string | null;
}) {
  return {
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
    id: u.id,
    userName: u.email,
    emails: [{ value: u.email, primary: true }],
    name: { formatted: u.name ?? u.email },
    active: true,
  };
}

export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (!ctx) return scimError(401, "Invalid token");

  const url = new URL(req.url);
  const startIndex = Math.max(1, Number(url.searchParams.get("startIndex") ?? 1));
  const count = Math.min(
    200,
    Math.max(1, Number(url.searchParams.get("count") ?? 50)),
  );

  const memberships = await prisma.membership.findMany({
    where: { workspaceId: ctx.workspaceId },
    include: { user: { select: { id: true, email: true, name: true } } },
    skip: startIndex - 1,
    take: count,
    orderBy: { createdAt: "asc" },
  });
  const total = await prisma.membership.count({
    where: { workspaceId: ctx.workspaceId },
  });

  const body = {
    schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
    totalResults: total,
    startIndex,
    itemsPerPage: memberships.length,
    Resources: memberships.map((m) => userResource(m.user)),
  };

  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/scim+json" },
  });
}
