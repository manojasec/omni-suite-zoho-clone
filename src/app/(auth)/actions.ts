"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { signIn } from "@/lib/auth";
import { SystemRole, Plan } from "@prisma/client";

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
