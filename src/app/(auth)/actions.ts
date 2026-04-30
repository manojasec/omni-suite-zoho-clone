"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { signIn, TWO_FACTOR_PROVIDER_ID, userHasActiveTwoFactor } from "@/lib/auth";
import { signTwoFactorToken, verifyTwoFactorToken } from "@/lib/two-factor-cookie";
import {
  verifyRecoveryCode,
  verifyTotpCode,
} from "@/modules/two-factor/totp";
import { rateLimit } from "@/platform/rate-limit";
import { recordAuditEvent } from "@/modules/audit/record";
import { SystemRole, Plan } from "@prisma/client";

const PRE_2FA_COOKIE = "omni_pre2fa";
const PRE_2FA_TTL = 600;
const TWO_FA_VERIFY_LIMIT = 8;
const TWO_FA_VERIFY_WINDOW_MS = 10 * 60 * 1000;

async function recordTwoFactorAudit(
  userId: string,
  action: "twoFactor.challenge.success" | "twoFactor.challenge.fail",
  diff?: Record<string, unknown>,
) {
  // Audit log requires a workspaceId — pick the user's earliest active membership.
  const membership = await prisma.membership.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
    select: { workspaceId: true },
  });
  if (!membership) return;
  await recordAuditEvent({
    workspaceId: membership.workspaceId,
    actorId: userId,
    action,
    resource: "user",
    resourceId: userId,
    diff,
  });
}

const signupSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(200),
  password: z.string().min(8).max(200),
  workspaceName: z.string().min(1).max(80),
});

export async function signupAction(formData: FormData) {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: String(formData.get("email") ?? "").toLowerCase().trim(),
    password: formData.get("password"),
    workspaceName: formData.get("workspaceName"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { name, email, password, workspaceName } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "An account with that email already exists." };

  const hashedPassword = await bcrypt.hash(password, 10);

  const slugBase = workspaceName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "workspace";
  let slug = slugBase;
  let i = 1;
  while (await prisma.workspace.findUnique({ where: { slug } })) {
    slug = `${slugBase}-${i++}`;
  }

  const user = await prisma.user.create({
    data: { email, name, hashedPassword, emailVerified: new Date() },
  });
  const workspace = await prisma.workspace.create({
    data: { name: workspaceName, slug, plan: Plan.FREE },
  });
  await prisma.membership.create({
    data: { userId: user.id, workspaceId: workspace.id, role: SystemRole.OWNER },
  });
  await prisma.pipeline.create({
    data: {
      workspaceId: workspace.id,
      name: "Sales Pipeline",
      isDefault: true,
      stages: {
        create: [
          { name: "New", order: 1, probability: 10 },
          { name: "Qualified", order: 2, probability: 25 },
          { name: "Proposal", order: 3, probability: 50 },
          { name: "Negotiation", order: 4, probability: 75 },
          { name: "Closed Won", order: 5, probability: 100 },
        ],
      },
    },
  });

  await signIn("credentials", { email, password, redirect: false });
  redirect("/app");
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: String(formData.get("email") ?? "").toLowerCase().trim(),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Invalid input" };

  // Validate the password ourselves so we can branch on 2FA before NextAuth.
  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });
  if (!user?.hashedPassword) return { error: "Invalid email or password" };
  const ok = await bcrypt.compare(parsed.data.password, user.hashedPassword);
  if (!ok) return { error: "Invalid email or password" };

  if (userHasActiveTwoFactor(user.twoFactorSecret)) {
    const token = signTwoFactorToken({
      userId: user.id,
      ttlSeconds: PRE_2FA_TTL,
    });
    const jar = await cookies();
    jar.set(PRE_2FA_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: PRE_2FA_TTL,
    });
    redirect("/login/2fa");
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch {
    return { error: "Invalid email or password" };
  }
  redirect("/app");
}

const verify2faSchema = z.object({
  code: z.string().trim().min(6).max(20),
});

export async function verify2faLoginAction(formData: FormData) {
  const parsed = verify2faSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) return { error: "Enter a 6-digit code or recovery code" };

  const jar = await cookies();
  const cookie = jar.get(PRE_2FA_COOKIE)?.value;
  if (!cookie) return { error: "Session expired — please sign in again" };

  const verified = verifyTwoFactorToken(cookie);
  if (!verified) return { error: "Session expired — please sign in again" };

  const limited = rateLimit({
    key: `2fa:verify:${verified.userId}`,
    limit: TWO_FA_VERIFY_LIMIT,
    windowMs: TWO_FA_VERIFY_WINDOW_MS,
  });
  if (!limited.allowed) {
    await recordTwoFactorAudit(verified.userId, "twoFactor.challenge.fail", {
      reason: "rate-limited",
    });
    return {
      error: "Too many attempts. Please wait a few minutes and try again.",
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: verified.userId },
    select: { id: true, twoFactorSecret: true },
  });
  if (!user || !userHasActiveTwoFactor(user.twoFactorSecret)) {
    return { error: "Two-factor is no longer enabled on this account" };
  }

  const code = parsed.data.code;
  let allowed = verifyTotpCode(user.twoFactorSecret!, code);
  let usedRecoveryId: string | null = null;
  if (!allowed) {
    const recovery = await prisma.twoFactorRecoveryCode.findMany({
      where: { userId: user.id, usedAt: null },
    });
    const matched = recovery.find((r) => verifyRecoveryCode(code, r.codeHash));
    if (matched) {
      allowed = true;
      usedRecoveryId = matched.id;
    }
  }
  if (!allowed) {
    await recordTwoFactorAudit(user.id, "twoFactor.challenge.fail", {
      reason: "invalid-code",
    });
    return { error: "Invalid code" };
  }

  if (usedRecoveryId) {
    await prisma.twoFactorRecoveryCode.update({
      where: { id: usedRecoveryId },
      data: { usedAt: new Date() },
    });
  }

  // Mint a fresh, single-use token for the second provider, then clear cookie.
  const proof = signTwoFactorToken({ userId: user.id, ttlSeconds: 60 });
  jar.delete(PRE_2FA_COOKIE);

  // Hash check: even though we just verified, sanity assert the proof.
  if (!verifyTwoFactorToken(proof)) return { error: "Verification failed" };

  await recordTwoFactorAudit(user.id, "twoFactor.challenge.success", {
    method: usedRecoveryId ? "recovery-code" : "totp",
  });

  try {
    await signIn(TWO_FACTOR_PROVIDER_ID, { token: proof, redirect: false });
  } catch {
    return { error: "Sign-in failed — please retry" };
  }
  redirect("/app");
}
