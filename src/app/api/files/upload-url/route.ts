import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { presignUrl, publicUrl, buildStorageKey, isStorageConfigured } from "@/platform/storage";
import { recordAuditEvent } from "@/modules/audit/record";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const inputSchema = z.object({
  name: z.string().min(1).max(260),
  mimeType: z.string().min(1).max(120),
  sizeBytes: z.number().int().nonnegative().max(50 * 1024 * 1024 * 1024), // 50 GB cap
  folderId: z.string().nullable().optional(),
  scope: z.enum(["files", "esign", "mail-attach", "social", "notes"]).default("files"),
});

/**
 * POST /api/files/upload-url
 *
 * Body: { name, mimeType, sizeBytes, folderId?, scope? }
 * Returns: { fileId, key, uploadUrl, downloadUrl }
 *
 * Flow:
 *   1. Client posts metadata.
 *   2. Server creates a FileAsset row (size populated up-front from client).
 *   3. Server returns a presigned PUT URL.
 *   4. Client PUTs binary directly to S3.
 *   5. (optional) Client confirms via PATCH to mark "ready" (future iteration).
 */
export async function POST(req: Request) {
  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }
  const ctx = await requireSession();
  assertCan(ctx.role, "fileAsset", "create");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }
  const { name, mimeType, sizeBytes, folderId, scope } = parsed.data;

  // Validate folder belongs to workspace if provided.
  if (folderId) {
    const folder = await prisma.folder.findFirst({
      where: { id: folderId, workspaceId: ctx.workspaceId },
      select: { id: true },
    });
    if (!folder) return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }

  const id = crypto.randomUUID();
  const key = buildStorageKey({ workspaceId: ctx.workspaceId, scope, id, filename: name });

  const file = await prisma.fileAsset.create({
    data: {
      id,
      workspaceId: ctx.workspaceId,
      folderId: folderId ?? null,
      name,
      mimeType,
      sizeBytes: BigInt(sizeBytes),
      storageKey: key,
      createdById: ctx.userId,
    },
  });

  const uploadUrl = presignUrl({
    method: "PUT",
    key,
    contentType: mimeType,
    expiresSeconds: 600,
  });
  const downloadUrl = publicUrl(key) ?? presignUrl({ method: "GET", key, expiresSeconds: 3600 });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "fileAsset",
    resourceId: file.id,
    diff: { name, sizeBytes, scope },
  });

  return NextResponse.json({
    fileId: file.id,
    key,
    uploadUrl,
    downloadUrl,
    expiresIn: 600,
  });
}
