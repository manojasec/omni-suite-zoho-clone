"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { envelopeSchema } from "@/modules/esign/schemas";
import { generateAccessToken } from "@/modules/esign/token";
import { recordAuditEvent } from "@/modules/audit/record";

function parseSigners(fd: FormData) {
  // Signers come as repeated signerName / signerEmail fields.
  const names = fd.getAll("signerName").map((v) => String(v ?? "").trim());
  const emails = fd.getAll("signerEmail").map((v) => String(v ?? "").trim());
  const len = Math.max(names.length, emails.length);
  const signers: { name: string; email: string }[] = [];
  for (let i = 0; i < len; i++) {
    const name = names[i] ?? "";
    const email = emails[i] ?? "";
    if (name || email) signers.push({ name, email });
  }
  return signers;
}

export async function createEnvelopeAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "signatureEnvelope", "create");

  const parsed = envelopeSchema.safeParse({
    title: fd.get("title") ?? "",
    message: fd.get("message") ?? "",
    documentUrl: fd.get("documentUrl") ?? "",
    expiresAt: fd.get("expiresAt") ?? "",
    signers: parseSigners(fd),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const env = await prisma.signatureEnvelope.create({
    data: {
      workspaceId: ctx.workspaceId,
      createdById: ctx.userId,
      title: parsed.data.title,
      message: parsed.data.message ?? null,
      documentUrl: parsed.data.documentUrl,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      status: "DRAFT",
      signers: {
        create: parsed.data.signers.map((s, i) => ({
          name: s.name,
          email: s.email,
          order: i + 1,
          accessToken: generateAccessToken(),
          status: "PENDING",
        })),
      },
    },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "signatureEnvelope",
    resourceId: env.id,
  });
  revalidatePath("/app/esign");
  redirect(`/app/esign/${env.id}`);
}

export async function sendEnvelopeAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "signatureEnvelope", "edit");
  const env = await prisma.signatureEnvelope.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: { signers: { orderBy: { order: "asc" } } },
  });
  if (!env) throw new Error("Envelope not found");
  if (env.status !== "DRAFT") throw new Error("Only draft envelopes can be sent");
  if (env.signers.length === 0) throw new Error("Add at least one signer first");

  await prisma.$transaction([
    prisma.signatureEnvelope.update({
      where: { id },
      data: { status: "SENT", sentAt: new Date() },
    }),
    // Mark first signer as SENT (sequential signing model).
    prisma.signatureSigner.update({
      where: { id: env.signers[0]!.id },
      data: { status: "SENT" },
    }),
    prisma.signatureEvent.create({
      data: {
        envelopeId: id,
        type: "envelope.sent",
        detail: `Sent to ${env.signers.length} signer(s)`,
      },
    }),
  ]);

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "send",
    resource: "signatureEnvelope",
    resourceId: id,
  });
  revalidatePath(`/app/esign/${id}`);
  revalidatePath("/app/esign");
}

export async function cancelEnvelopeAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "signatureEnvelope", "edit");
  const env = await prisma.signatureEnvelope.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true, status: true },
  });
  if (!env) throw new Error("Envelope not found");
  if (env.status === "COMPLETED" || env.status === "CANCELLED") {
    throw new Error("Envelope is already finalised");
  }

  await prisma.$transaction([
    prisma.signatureEnvelope.update({
      where: { id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    }),
    prisma.signatureEvent.create({
      data: { envelopeId: id, type: "envelope.cancelled" },
    }),
  ]);

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "signatureEnvelope",
    resourceId: id,
    diff: { status: "CANCELLED" },
  });
  revalidatePath(`/app/esign/${id}`);
  revalidatePath("/app/esign");
}

export async function deleteEnvelopeAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "signatureEnvelope", "delete");
  const env = await prisma.signatureEnvelope.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true, status: true },
  });
  if (!env) throw new Error("Envelope not found");
  if (env.status !== "DRAFT" && env.status !== "CANCELLED") {
    throw new Error("Only draft or cancelled envelopes can be deleted");
  }

  await prisma.signatureEnvelope.delete({ where: { id } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "signatureEnvelope",
    resourceId: id,
  });
  revalidatePath("/app/esign");
  redirect("/app/esign");
}

// ===== Public sign actions (no auth) =====

async function getRequestMeta() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
  const userAgent = h.get("user-agent") ?? null;
  return { ip, userAgent };
}

export async function publicSignAction(token: string, fd: FormData) {
  const signatureName = String(fd.get("signatureName") ?? "").trim();
  const agree = fd.get("agree") === "on" || fd.get("agree") === "true";
  if (!signatureName || signatureName.length < 2) {
    throw new Error("Type your full name to sign");
  }
  if (!agree) throw new Error("You must agree before signing");

  const signer = await prisma.signatureSigner.findUnique({
    where: { accessToken: token },
    include: { envelope: { include: { signers: { orderBy: { order: "asc" } } } } },
  });
  if (!signer) throw new Error("Invalid signing link");
  if (signer.status === "SIGNED") throw new Error("You have already signed");
  if (signer.status === "DECLINED") throw new Error("This request was declined");

  const env = signer.envelope;
  if (env.status !== "SENT" && env.status !== "VIEWED") {
    throw new Error("This envelope is no longer accepting signatures");
  }
  if (env.expiresAt && env.expiresAt.getTime() < Date.now()) {
    throw new Error("This envelope has expired");
  }

  // Sequential signing: ensure prior signers are done.
  const prior = env.signers.filter((s) => s.order < signer.order);
  if (prior.some((p) => p.status !== "SIGNED")) {
    throw new Error("It is not your turn to sign yet");
  }

  const { ip, userAgent } = await getRequestMeta();
  const now = new Date();

  await prisma.signatureSigner.update({
    where: { id: signer.id },
    data: {
      status: "SIGNED",
      signedAt: now,
      signatureName,
      signedIp: ip,
      signedUserAgent: userAgent,
      viewedAt: signer.viewedAt ?? now,
    },
  });
  await prisma.signatureEvent.create({
    data: {
      envelopeId: env.id,
      signerId: signer.id,
      type: "signer.signed",
      ip,
      userAgent,
      detail: `${signer.name} <${signer.email}> signed as "${signatureName}"`,
    },
  });

  // Advance: mark next pending signer as SENT, or complete envelope.
  const next = env.signers.find((s) => s.order > signer.order && s.status === "PENDING");
  if (next) {
    await prisma.signatureSigner.update({
      where: { id: next.id },
      data: { status: "SENT" },
    });
  } else {
    // Check if all signers have signed (or current is the last).
    const remaining = env.signers.filter(
      (s) => s.id !== signer.id && s.status !== "SIGNED" && s.status !== "DECLINED",
    );
    if (remaining.length === 0) {
      await prisma.signatureEnvelope.update({
        where: { id: env.id },
        data: { status: "COMPLETED", completedAt: now },
      });
      await prisma.signatureEvent.create({
        data: { envelopeId: env.id, type: "envelope.completed" },
      });
    }
  }

  revalidatePath(`/sign/${token}`);
  revalidatePath(`/app/esign/${env.id}`);
}

export async function publicDeclineAction(token: string, fd: FormData) {
  const reason = String(fd.get("reason") ?? "").trim();
  if (!reason) throw new Error("Decline reason is required");

  const signer = await prisma.signatureSigner.findUnique({
    where: { accessToken: token },
    include: { envelope: true },
  });
  if (!signer) throw new Error("Invalid signing link");
  if (signer.status === "SIGNED") throw new Error("Already signed");
  if (signer.status === "DECLINED") throw new Error("Already declined");

  const { ip, userAgent } = await getRequestMeta();
  const now = new Date();

  await prisma.$transaction([
    prisma.signatureSigner.update({
      where: { id: signer.id },
      data: { status: "DECLINED", declinedAt: now, declineReason: reason },
    }),
    prisma.signatureEnvelope.update({
      where: { id: signer.envelopeId },
      data: { status: "DECLINED", declinedAt: now },
    }),
    prisma.signatureEvent.create({
      data: {
        envelopeId: signer.envelopeId,
        signerId: signer.id,
        type: "signer.declined",
        ip,
        userAgent,
        detail: reason,
      },
    }),
  ]);

  revalidatePath(`/sign/${token}`);
  revalidatePath(`/app/esign/${signer.envelopeId}`);
}

export async function recordViewEvent(token: string) {
  const signer = await prisma.signatureSigner.findUnique({
    where: { accessToken: token },
    select: { id: true, envelopeId: true, status: true, viewedAt: true },
  });
  if (!signer) return;
  if (signer.viewedAt) return; // Only record first view.
  const { ip, userAgent } = await getRequestMeta();
  const now = new Date();
  await prisma.signatureSigner.update({
    where: { id: signer.id },
    data: {
      viewedAt: now,
      status: signer.status === "SENT" ? "VIEWED" : signer.status,
    },
  });
  await prisma.signatureEvent.create({
    data: {
      envelopeId: signer.envelopeId,
      signerId: signer.id,
      type: "signer.viewed",
      ip,
      userAgent,
    },
  });
  // Bump envelope to VIEWED if currently SENT.
  await prisma.signatureEnvelope.updateMany({
    where: { id: signer.envelopeId, status: "SENT" },
    data: { status: "VIEWED" },
  });
}
