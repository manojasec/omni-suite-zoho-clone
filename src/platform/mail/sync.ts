/**
 * Mail sync orchestrator.
 *
 * Registers two job-queue handlers:
 *   - `mail.imap.sync`  — pulls new UIDs from INBOX, parses, persists threads/messages
 *   - `mail.smtp.send`  — sends an outbound MailMessage via the account's SMTP
 *
 * Schedule a sync per active account by enqueueing `mail.imap.sync` with
 * `{ accountId }`. Pair with a cron/interval that enqueues every 5 minutes.
 */

import { prisma } from "@/lib/prisma";
import { registerHandler, enqueue } from "@/platform/jobs";
import { decryptSecret, encryptSecret } from "@/modules/vault/crypto";
import { fetchInbox } from "./imap";
import { sendMail } from "./smtp";
import { parseRfc822 } from "./parser";

export type ImapSyncPayload = { accountId: string };
export type SmtpSendPayload = {
  accountId: string;
  messageId: string;
};

/** Helper: persist a credential triple as a single base64 JSON blob. */
export function packCredential(plain: string): string {
  const parts = encryptSecret(plain);
  return Buffer.from(JSON.stringify(parts), "utf8").toString("base64");
}

export function unpackCredential(packed: string | null | undefined): string | null {
  if (!packed) return null;
  try {
    const json = Buffer.from(packed, "base64").toString("utf8");
    const parts = JSON.parse(json) as { cipher: string; iv: string; tag: string };
    return decryptSecret(parts);
  } catch {
    return null;
  }
}

registerHandler<ImapSyncPayload>("mail.imap.sync", async ({ accountId }) => {
  const acct = await prisma.mailAccount.findUnique({ where: { id: accountId } });
  if (!acct || acct.status !== "ACTIVE") return;
  if (!acct.imapHost || !acct.imapPort || !acct.imapUsername) {
    await prisma.mailAccount.update({
      where: { id: accountId },
      data: { lastError: "IMAP not configured", status: "ERROR" },
    });
    return;
  }
  const password = unpackCredential(acct.imapPasswordEnc);
  if (!password) {
    await prisma.mailAccount.update({
      where: { id: accountId },
      data: { lastError: "IMAP password decrypt failed", status: "ERROR" },
    });
    return;
  }

  const messages = await fetchInbox(
    {
      host: acct.imapHost,
      port: acct.imapPort,
      user: acct.imapUsername,
      pass: password,
      secure: acct.imapTls,
      timeoutMs: 30_000,
    },
    acct.lastUid,
  );

  let highestUid = acct.lastUid;
  for (const m of messages) {
    const parsed = parseRfc822(m.rfc822);
    const subject = parsed.subject.slice(0, 250);

    // Thread by Subject (cheap) — production should use References/In-Reply-To.
    let thread = await prisma.mailThread.findFirst({
      where: { workspaceId: acct.workspaceId, subject },
    });
    const snippet = parsed.text.slice(0, 240);
    if (!thread) {
      thread = await prisma.mailThread.create({
        data: {
          workspaceId: acct.workspaceId,
          subject,
          snippet,
          participants: [parsed.from, ...parsed.to] as unknown as object,
          folder: "INBOX",
          isUnread: true,
          lastMessageAt: parsed.date ?? new Date(),
        },
      });
    } else {
      await prisma.mailThread.update({
        where: { id: thread.id },
        data: {
          isUnread: true,
          snippet,
          lastMessageAt: parsed.date ?? new Date(),
        },
      });
    }

    await prisma.mailMessage.create({
      data: {
        workspaceId: acct.workspaceId,
        threadId: thread.id,
        direction: "INBOUND",
        fromAddress: parsed.from,
        toAddresses: parsed.to as unknown as object,
        ccAddresses: parsed.cc as unknown as object,
        bccAddresses: parsed.bcc as unknown as object,
        subject,
        body: parsed.text.slice(0, 60_000),
      },
    });

    if (m.uid > highestUid) highestUid = m.uid;
  }

  await prisma.mailAccount.update({
    where: { id: accountId },
    data: {
      lastSyncedAt: new Date(),
      lastUid: highestUid,
      lastError: null,
      status: "ACTIVE",
    },
  });
});

registerHandler<SmtpSendPayload>("mail.smtp.send", async ({ accountId, messageId }) => {
  const acct = await prisma.mailAccount.findUnique({ where: { id: accountId } });
  if (!acct) throw new Error("MailAccount not found");
  if (!acct.smtpHost || !acct.smtpPort || !acct.smtpUsername) {
    throw new Error("SMTP not configured");
  }
  const password = unpackCredential(acct.smtpPasswordEnc);
  if (!password) throw new Error("SMTP password decrypt failed");

  const msg = await prisma.mailMessage.findUnique({
    where: { id: messageId },
    include: { thread: { select: { subject: true } } },
  });
  if (!msg) throw new Error("MailMessage not found");
  const to = (msg.toAddresses as unknown as string[]) ?? [];
  if (to.length === 0) throw new Error("No recipients");

  await sendMail(
    {
      host: acct.smtpHost,
      port: acct.smtpPort,
      secure: acct.smtpPort === 465,
      auth: { user: acct.smtpUsername, pass: password },
    },
    {
      from: acct.emailAddress,
      to,
      cc: (msg.ccAddresses as unknown as string[]) ?? [],
      bcc: (msg.bccAddresses as unknown as string[]) ?? [],
      subject: msg.thread.subject,
      text: msg.body,
    },
  );
});

/** Convenience: enqueue an IMAP sync for every ACTIVE account. */
export async function scheduleAllImapSyncs(): Promise<number> {
  const accounts = await prisma.mailAccount.findMany({
    where: { status: "ACTIVE", kind: "IMAP_SMTP" },
    select: { id: true },
  });
  for (const a of accounts) {
    await enqueue({
      kind: "mail.imap.sync",
      payload: { accountId: a.id },
      uniqueKey: `mail.imap.sync:${a.id}`,
    });
  }
  return accounts.length;
}
