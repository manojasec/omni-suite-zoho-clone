import "server-only";
import { prisma } from "@/lib/prisma";
import { enqueue } from "@/platform/jobs";
import { parseAddressList, makeSnippet } from "./schemas";

/**
 * Outbound mail orchestration.
 *
 * Composes Iter 2's `mail.smtp.send` job with a thread/message draft that the
 * UI compose flow can write atomically. The job handler in
 * `src/platform/mail/sync.ts` reads the persisted MailMessage and ships it via
 * the account's SMTP transport.
 *
 * Pure helper `buildOutboundDraft` is unit-testable — it shapes the create
 * payloads from form input without touching Prisma.
 */

export type ComposeMailInput = {
  to: string;
  cc?: string | null;
  bcc?: string | null;
  subject: string;
  body: string; // text/plain
};

export type OutboundDraft = {
  recipients: { to: string[]; cc: string[]; bcc: string[] };
  thread: {
    subject: string;
    snippet: string;
    participants: string[];
    folder: "SENT";
    isUnread: false;
    lastMessageAt: Date;
  };
  message: {
    direction: "OUTBOUND";
    fromAddress: string;
    toAddresses: string[];
    ccAddresses: string[];
    bccAddresses: string[];
    subject: string;
    body: string;
  };
};

export function buildOutboundDraft(
  fromAddress: string,
  input: ComposeMailInput,
  now: Date = new Date(),
): OutboundDraft {
  const to = parseAddressList(input.to);
  const cc = parseAddressList(input.cc ?? "");
  const bcc = parseAddressList(input.bcc ?? "");
  if (to.length + cc.length + bcc.length === 0) {
    throw new Error("Outbound mail must have at least one recipient");
  }
  const participants = Array.from(new Set([fromAddress, ...to, ...cc, ...bcc]));
  return {
    recipients: { to, cc, bcc },
    thread: {
      subject: input.subject,
      snippet: makeSnippet(input.body),
      participants,
      folder: "SENT",
      isUnread: false,
      lastMessageAt: now,
    },
    message: {
      direction: "OUTBOUND",
      fromAddress,
      toAddresses: to,
      ccAddresses: cc,
      bccAddresses: bcc,
      subject: input.subject,
      body: input.body,
    },
  };
}

/**
 * Persist a SENT thread + OUTBOUND message and enqueue the SMTP send job.
 * Idempotent on `uniqueKey` — repeat clicks won't send twice.
 */
export async function enqueueOutboundMail(args: {
  workspaceId: string;
  accountId: string;
  fromAddress: string;
  sentByUserId?: string;
  input: ComposeMailInput;
}): Promise<{ threadId: string; messageId: string; jobId: string }> {
  const draft = buildOutboundDraft(args.fromAddress, args.input);

  const thread = await prisma.mailThread.create({
    data: {
      workspaceId: args.workspaceId,
      subject: draft.thread.subject,
      snippet: draft.thread.snippet,
      participants: draft.thread.participants as unknown as object,
      folder: draft.thread.folder,
      isUnread: draft.thread.isUnread,
      lastMessageAt: draft.thread.lastMessageAt,
    },
    select: { id: true },
  });

  const message = await prisma.mailMessage.create({
    data: {
      workspaceId: args.workspaceId,
      threadId: thread.id,
      direction: draft.message.direction,
      fromAddress: draft.message.fromAddress,
      toAddresses: draft.message.toAddresses as unknown as object,
      ccAddresses: draft.message.ccAddresses as unknown as object,
      bccAddresses: draft.message.bccAddresses as unknown as object,
      subject: draft.message.subject,
      body: draft.message.body,
      sentByUserId: args.sentByUserId,
    },
    select: { id: true },
  });

  const job = await prisma.$transaction(async () =>
    enqueue({
      kind: "mail.smtp.send",
      payload: { accountId: args.accountId, messageId: message.id },
      workspaceId: args.workspaceId,
      uniqueKey: `mail.smtp.send:${message.id}`,
    }),
  );

  return { threadId: thread.id, messageId: message.id, jobId: job.id };
}
