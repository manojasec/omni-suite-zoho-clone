"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { assertWithinRateLimit } from "@/platform/throttle";
import {
  conversationSchema,
  messageSchema,
  generateAssistantReply,
} from "@/modules/ai/schemas";

function s(fd: FormData, k: string): string {
  const v = fd.get(k);
  return v == null ? "" : String(v);
}

export async function createConversationAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "aiConversation", "create");
  const parsed = conversationSchema.parse({ title: s(fd, "title") });

  const c = await prisma.aIConversation.create({
    data: {
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      title: parsed.title,
    },
    select: { id: true },
  });

  revalidatePath("/app/ai");
  redirect(`/app/ai/${c.id}`);
}

export async function postMessageAction(conversationId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "aiConversation", "edit");
  assertWithinRateLimit({ feature: "ai.message", userId: ctx.userId, limit: 20 });
  const parsed = messageSchema.parse({ content: s(fd, "content") });

  const conv = await prisma.aIConversation.findFirst({
    where: { id: conversationId, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!conv) throw new Error("Conversation not found");

  const reply = generateAssistantReply(parsed.content);

  await prisma.$transaction([
    prisma.aIMessage.create({
      data: {
        conversationId,
        role: "USER",
        content: parsed.content,
      },
    }),
    prisma.aIMessage.create({
      data: {
        conversationId,
        role: "ASSISTANT",
        content: reply,
      },
    }),
    prisma.aIConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    }),
  ]);

  revalidatePath(`/app/ai/${conversationId}`);
}

export async function deleteConversationAction(conversationId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "aiConversation", "delete");
  const conv = await prisma.aIConversation.findFirst({
    where: { id: conversationId, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!conv) throw new Error("Conversation not found");
  await prisma.aIConversation.delete({ where: { id: conversationId } });
  revalidatePath("/app/ai");
  redirect("/app/ai");
}
