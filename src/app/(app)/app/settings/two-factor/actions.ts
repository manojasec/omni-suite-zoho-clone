"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { recordAuditEvent } from "@/modules/audit/record";
import {
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  verifyRecoveryCode,
  verifyTotpCode,
} from "@/modules/two-factor/totp";

const PENDING_PREFIX = "PENDING:";

/**
 * Begin 2FA enrolment by storing a secret tagged with PENDING: until the user
 * confirms it with a code. We deliberately persist server-side to support QR scan +
 * confirmation across page navigations.
 */
export async function start2faEnrollmentAction() {
  const ctx = await requireSession();
  const secret = generateTotpSecret();

  await prisma.user.update({
    where: { id: ctx.userId },
    data: { twoFactorSecret: `${PENDING_PREFIX}${secret}` },
  });

  revalidatePath("/app/settings/two-factor");
}

export async function confirm2faEnrollmentAction(fd: FormData) {
  const ctx = await requireSession();
  const code = String(fd.get("code") ?? "").trim();

  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: { twoFactorSecret: true },
  });
  const stored = user?.twoFactorSecret;
  if (!stored || !stored.startsWith(PENDING_PREFIX)) {
    throw new Error("No enrolment in progress");
  }
  const secret = stored.slice(PENDING_PREFIX.length);

  if (!verifyTotpCode(secret, code)) {
    throw new Error("Invalid code — try again");
  }

  const codes = generateRecoveryCodes();

  await prisma.$transaction([
    prisma.user.update({
      where: { id: ctx.userId },
      data: { twoFactorSecret: secret },
    }),
    prisma.twoFactorRecoveryCode.deleteMany({ where: { userId: ctx.userId } }),
    prisma.twoFactorRecoveryCode.createMany({
      data: codes.map((c) => ({
        userId: ctx.userId,
        codeHash: hashRecoveryCode(c),
      })),
    }),
  ]);

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "twoFactor.enable",
    resource: "user",
    resourceId: ctx.userId,
  });

  // Surface plaintext recovery codes to the page via a one-shot cookie.
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  cookieStore.set("2fa.codes", codes.join(","), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 5,
    path: "/app/settings/two-factor",
  });

  revalidatePath("/app/settings/two-factor");
}

export async function disable2faAction(fd: FormData) {
  const ctx = await requireSession();
  const code = String(fd.get("code") ?? "").trim();

  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: { twoFactorSecret: true },
  });
  const secret = user?.twoFactorSecret;
  if (!secret || secret.startsWith(PENDING_PREFIX)) {
    throw new Error("Two-factor is not enabled");
  }

  let allowed = verifyTotpCode(secret, code);
  if (!allowed) {
    const recovery = await prisma.twoFactorRecoveryCode.findMany({
      where: { userId: ctx.userId, usedAt: null },
    });
    allowed = recovery.some((r) => verifyRecoveryCode(code, r.codeHash));
  }
  if (!allowed) throw new Error("Invalid code");

  await prisma.$transaction([
    prisma.user.update({
      where: { id: ctx.userId },
      data: { twoFactorSecret: null },
    }),
    prisma.twoFactorRecoveryCode.deleteMany({ where: { userId: ctx.userId } }),
  ]);

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "twoFactor.disable",
    resource: "user",
    resourceId: ctx.userId,
  });

  revalidatePath("/app/settings/two-factor");
}

export async function regenerateRecoveryCodesAction() {
  const ctx = await requireSession();
  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: { twoFactorSecret: true },
  });
  if (!user?.twoFactorSecret || user.twoFactorSecret.startsWith(PENDING_PREFIX)) {
    throw new Error("Two-factor is not enabled");
  }

  const codes = generateRecoveryCodes();

  await prisma.$transaction([
    prisma.twoFactorRecoveryCode.deleteMany({ where: { userId: ctx.userId } }),
    prisma.twoFactorRecoveryCode.createMany({
      data: codes.map((c) => ({
        userId: ctx.userId,
        codeHash: hashRecoveryCode(c),
      })),
    }),
  ]);

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "twoFactor.regenerateCodes",
    resource: "user",
    resourceId: ctx.userId,
  });

  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  cookieStore.set("2fa.codes", codes.join(","), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 5,
    path: "/app/settings/two-factor",
  });

  revalidatePath("/app/settings/two-factor");
}
