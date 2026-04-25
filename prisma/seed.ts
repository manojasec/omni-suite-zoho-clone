import { PrismaClient, SystemRole, Plan } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "owner@demo.test";
  const password = "Password123!";
  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: "Demo Owner",
      hashedPassword,
      emailVerified: new Date(),
    },
  });

  const workspace = await prisma.workspace.upsert({
    where: { slug: "demo" },
    update: {},
    create: {
      name: "Demo Workspace",
      slug: "demo",
      plan: Plan.PROFESSIONAL,
      currency: "USD",
      timezone: "UTC",
    },
  });

  await prisma.membership.upsert({
    where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
    update: {},
    create: { userId: user.id, workspaceId: workspace.id, role: SystemRole.OWNER },
  });

  // Default sales pipeline
  const existing = await prisma.pipeline.findFirst({ where: { workspaceId: workspace.id } });
  if (!existing) {
    const pipeline = await prisma.pipeline.create({
      data: { workspaceId: workspace.id, name: "Sales Pipeline", isDefault: true },
    });
    const stages = [
      { name: "New", order: 1, probability: 10 },
      { name: "Qualified", order: 2, probability: 25 },
      { name: "Proposal", order: 3, probability: 50 },
      { name: "Negotiation", order: 4, probability: 75 },
      { name: "Closed Won", order: 5, probability: 100 },
    ];
    for (const s of stages) {
      await prisma.stage.create({ data: { ...s, pipelineId: pipeline.id } });
    }
  }

  console.log(`Seeded. Login: ${email} / ${password}`);
}

main().finally(() => prisma.$disconnect());
