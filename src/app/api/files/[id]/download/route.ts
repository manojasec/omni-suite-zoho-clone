import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { presignUrl, publicUrl, isStorageConfigured } from "@/platform/storage";
import { recordAuditEvent } from "@/modules/audit/record";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/files/<id>/download
 *
 * Auth: workspace membership + can(view, fileAsset).
 * Returns 302 redirect to a presigned GET URL (or public URL if configured).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }
  const { id } = await params;
  const ctx = await requireSession();
  assertCan(ctx.role, "fileAsset", "view");

  const file = await prisma.fileAsset.findFirst({
    where: { id, workspaceId: ctx.workspaceId, trashedAt: null },
    select: { id: true, storageKey: true, mimeType: true, name: true },
  });
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = publicUrl(file.storageKey) ?? presignUrl({ method: "GET", key: file.storageKey, expiresSeconds: 3600 });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "view",
    resource: "fileAsset",
    resourceId: file.id,
  });

  return NextResponse.redirect(url, 302);
}
