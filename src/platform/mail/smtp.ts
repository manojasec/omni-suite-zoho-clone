/**
 * Minimal SMTP client (zero-dep). Implements the subset needed for outbound
 * message delivery to a single SMTP relay:
 *   - EHLO / STARTTLS / AUTH LOGIN
 *   - MAIL FROM / RCPT TO / DATA
 *
 * Wire-format helpers (`buildEnvelope`, `quoteMime`) are pure and unit-tested.
 * The actual TCP/TLS conversation is in `sendMail()`, which is exercised in
 * integration tests only (not in this repo's unit suite).
 */

import { createConnection, Socket } from "node:net";
import { connect as tlsConnect, TLSSocket } from "node:tls";

export type SmtpAuth = { user: string; pass: string };
export type SmtpTransport = {
  host: string;
  port: number;
  /** true → wrap in TLS immediately (port 465). false → STARTTLS upgrade. */
  secure: boolean;
  auth?: SmtpAuth;
  /** Optional override of the EHLO/HELO hostname. */
  ehloName?: string;
  /** Connect timeout (ms). */
  timeoutMs?: number;
};

export type MailEnvelope = {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  text?: string;
  html?: string;
  /** Optional Message-ID; auto-generated if omitted. */
  messageId?: string;
  /** Optional In-Reply-To header (for replies). */
  inReplyTo?: string;
};

/** Build a minimal RFC 5322 message ready to push after `DATA`. */
export function buildEnvelope(env: MailEnvelope, opts: { messageIdHost?: string } = {}): string {
  const host = opts.messageIdHost ?? "omnisuite.local";
  const id = env.messageId ?? `<${cryptoId()}@${host}>`;
  const date = new Date().toUTCString();
  const lines: string[] = [
    `From: ${env.from}`,
    `To: ${env.to.join(", ")}`,
  ];
  if (env.cc && env.cc.length) lines.push(`Cc: ${env.cc.join(", ")}`);
  lines.push(
    `Subject: ${quoteMime(env.subject)}`,
    `Date: ${date}`,
    `Message-ID: ${id}`,
    `MIME-Version: 1.0`,
  );
  if (env.inReplyTo) {
    lines.push(`In-Reply-To: ${env.inReplyTo}`);
    lines.push(`References: ${env.inReplyTo}`);
  }

  const hasText = !!env.text;
  const hasHtml = !!env.html;
  if (hasHtml && hasText) {
    const boundary = `b_${cryptoId()}`;
    lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    lines.push("");
    lines.push(`--${boundary}`);
    lines.push("Content-Type: text/plain; charset=utf-8");
    lines.push("Content-Transfer-Encoding: 7bit");
    lines.push("");
    lines.push(env.text!);
    lines.push(`--${boundary}`);
    lines.push("Content-Type: text/html; charset=utf-8");
    lines.push("Content-Transfer-Encoding: 7bit");
    lines.push("");
    lines.push(env.html!);
    lines.push(`--${boundary}--`);
  } else {
    lines.push(
      `Content-Type: ${hasHtml ? "text/html" : "text/plain"}; charset=utf-8`,
    );
    lines.push("Content-Transfer-Encoding: 7bit");
    lines.push("");
    lines.push(env.html ?? env.text ?? "");
  }
  return lines.join("\r\n") + "\r\n";
}

/** Encode non-ASCII subject lines as RFC 2047 base64 if needed. */
export function quoteMime(value: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  const b = Buffer.from(value, "utf8").toString("base64");
  return `=?utf-8?B?${b}?=`;
}

/** Dot-stuff lines beginning with "." per RFC 5321 §4.5.2. */
export function dotStuff(message: string): string {
  return message.replace(/^\./gm, "..");
}

function cryptoId(): string {
  // Avoid pulling in Node's crypto for unit-test friendliness; this is a
  // best-effort message ID, not a security primitive.
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ---------------- Transport (network) ----------------

type Reply = { code: number; lines: string[] };

class SmtpConn {
  private socket: Socket | TLSSocket;
  private buffer = "";
  private resolveReply: ((r: Reply) => void) | null = null;
  private rejectReply: ((e: Error) => void) | null = null;
  private currentLines: string[] = [];

  constructor(socket: Socket | TLSSocket) {
    this.socket = socket;
    socket.setEncoding("utf8");
    socket.on("data", (chunk) => this.onChunk(String(chunk)));
    socket.on("error", (err) => this.rejectReply?.(err));
    socket.on("close", () => this.rejectReply?.(new Error("smtp connection closed")));
  }

  private onChunk(s: string) {
    this.buffer += s;
    let nl: number;
    while ((nl = this.buffer.indexOf("\r\n")) !== -1) {
      const line = this.buffer.slice(0, nl);
      this.buffer = this.buffer.slice(nl + 2);
      const code = parseInt(line.slice(0, 3), 10);
      const sep = line.charAt(3); // " " final, "-" continuation
      this.currentLines.push(line.slice(4));
      if (sep === " " || isNaN(code) === false && sep !== "-") {
        const lines = this.currentLines;
        this.currentLines = [];
        const r = this.resolveReply;
        this.resolveReply = null;
        this.rejectReply = null;
        r?.({ code, lines });
      }
    }
  }

  read(): Promise<Reply> {
    return new Promise((res, rej) => {
      this.resolveReply = res;
      this.rejectReply = rej;
    });
  }

  write(line: string): void {
    this.socket.write(line + "\r\n");
  }

  upgrade(opts: { host: string }): Promise<void> {
    return new Promise((res, rej) => {
      const tls = tlsConnect(
        { socket: this.socket as Socket, servername: opts.host },
        () => {
          this.socket = tls;
          this.buffer = "";
          tls.setEncoding("utf8");
          tls.on("data", (chunk) => this.onChunk(String(chunk)));
          tls.on("error", (err) => this.rejectReply?.(err));
          res();
        },
      );
      tls.once("error", rej);
    });
  }

  end(): void {
    try {
      this.socket.end();
    } catch {
      /* ignore */
    }
  }
}

async function expect(conn: SmtpConn, want: number, ctx: string): Promise<Reply> {
  const r = await conn.read();
  if (r.code !== want) {
    throw new Error(`SMTP ${ctx}: expected ${want}, got ${r.code} ${r.lines.join("|")}`);
  }
  return r;
}

export async function sendMail(
  transport: SmtpTransport,
  env: MailEnvelope,
): Promise<{ messageId: string; raw: string }> {
  const ehlo = transport.ehloName ?? "omnisuite.local";
  const raw = buildEnvelope(env, { messageIdHost: ehlo });
  const messageIdMatch = raw.match(/Message-ID: (<[^>]+>)/);
  const messageId = messageIdMatch ? messageIdMatch[1] : `<${cryptoId()}@${ehlo}>`;

  const socket: Socket | TLSSocket = transport.secure
    ? tlsConnect({ host: transport.host, port: transport.port, servername: transport.host })
    : createConnection({ host: transport.host, port: transport.port });

  if (transport.timeoutMs) socket.setTimeout(transport.timeoutMs);

  await new Promise<void>((res, rej) => {
    socket.once("connect" as never, () => res());
    socket.once("secureConnect" as never, () => res());
    socket.once("error", rej);
    socket.once("timeout", () => rej(new Error("smtp connect timeout")));
  });

  const conn = new SmtpConn(socket);
  await expect(conn, 220, "greeting");
  conn.write(`EHLO ${ehlo}`);
  await expect(conn, 250, "EHLO");

  if (!transport.secure) {
    conn.write("STARTTLS");
    await expect(conn, 220, "STARTTLS");
    await conn.upgrade({ host: transport.host });
    conn.write(`EHLO ${ehlo}`);
    await expect(conn, 250, "EHLO/TLS");
  }

  if (transport.auth) {
    conn.write("AUTH LOGIN");
    await expect(conn, 334, "AUTH LOGIN");
    conn.write(Buffer.from(transport.auth.user, "utf8").toString("base64"));
    await expect(conn, 334, "AUTH user");
    conn.write(Buffer.from(transport.auth.pass, "utf8").toString("base64"));
    await expect(conn, 235, "AUTH pass");
  }

  conn.write(`MAIL FROM:<${env.from}>`);
  await expect(conn, 250, "MAIL FROM");

  for (const r of [...env.to, ...(env.cc ?? []), ...(env.bcc ?? [])]) {
    conn.write(`RCPT TO:<${r}>`);
    await expect(conn, 250, `RCPT TO ${r}`);
  }

  conn.write("DATA");
  await expect(conn, 354, "DATA");
  conn.write(dotStuff(raw) + ".");
  await expect(conn, 250, "end-of-data");

  conn.write("QUIT");
  await conn.read().catch(() => undefined);
  conn.end();

  return { messageId, raw };
}
