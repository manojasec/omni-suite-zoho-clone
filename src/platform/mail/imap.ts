/**
 * Minimal IMAP client (zero-dep). Supports just enough to:
 *   1. LOGIN
 *   2. SELECT INBOX
 *   3. UID FETCH <range> (BODY.PEEK[]) — fetch full RFC822 messages
 *
 * Tag handling, line parsing, and command building are pure and unit-tested.
 * Real socket conversation lives in `fetchInbox()` (skipped in the unit
 * suite — exercised by integration env).
 *
 * IMAP literals (e.g. `{1234}\r\n` followed by binary body) are handled by
 * counting bytes after the literal marker.
 */

import { connect as tlsConnect, TLSSocket } from "node:tls";

export type ImapAuth = {
  host: string;
  port: number;
  user: string;
  pass: string;
  /** TLS on connect (port 993). STARTTLS not yet supported. */
  secure: boolean;
  timeoutMs?: number;
};

export type ImapMessage = {
  uid: number;
  rfc822: string;
};

let nextTagCounter = 0;
export function nextTag(reset = false): string {
  if (reset) nextTagCounter = 0;
  nextTagCounter += 1;
  return `A${String(nextTagCounter).padStart(4, "0")}`;
}

/** Quote a string for IMAP astring per RFC 3501 §4.3. */
export function imapQuote(value: string): string {
  if (value.length === 0) return '""';
  if (/[\r\n\x00]/.test(value) || value.length > 1000) {
    // Use literal form for control chars / very long strings.
    return `{${Buffer.byteLength(value, "utf8")}}\r\n${value}`;
  }
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * Parse a `UID FETCH` response chunk into discrete messages. The chunk is
 * everything between sending the FETCH command and receiving the tagged OK.
 */
export function parseFetchResponse(raw: string): ImapMessage[] {
  // Untagged lines look like:  "* 12 FETCH (UID 345 BODY[] {2048}\r\n<body>)"
  const out: ImapMessage[] = [];
  let i = 0;
  while (i < raw.length) {
    const lineEnd = raw.indexOf("\r\n", i);
    if (lineEnd === -1) break;
    const line = raw.slice(i, lineEnd);
    const m = line.match(/^\* \d+ FETCH \(.*UID (\d+).*\{(\d+)\}$/);
    if (!m) {
      i = lineEnd + 2;
      continue;
    }
    const uid = parseInt(m[1], 10);
    const len = parseInt(m[2], 10);
    const bodyStart = lineEnd + 2;
    const body = raw.slice(bodyStart, bodyStart + len);
    out.push({ uid, rfc822: body });
    // Skip past the body and the trailing ")\r\n"
    i = bodyStart + len;
    const closing = raw.indexOf("\r\n", i);
    i = closing === -1 ? raw.length : closing + 2;
  }
  return out;
}

/** Parse `* SEARCH 1 2 3` into UID array. */
export function parseSearchResponse(raw: string): number[] {
  const m = raw.match(/^\* SEARCH(.*)$/m);
  if (!m) return [];
  return m[1]
    .trim()
    .split(/\s+/)
    .map((t) => parseInt(t, 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}

/** Build the SELECT INBOX command for a given tag. */
export function buildSelect(tag: string, mailbox = "INBOX"): string {
  return `${tag} SELECT ${imapQuote(mailbox)}\r\n`;
}

/** Build LOGIN command. */
export function buildLogin(tag: string, user: string, pass: string): string {
  return `${tag} LOGIN ${imapQuote(user)} ${imapQuote(pass)}\r\n`;
}

/** Build UID FETCH for newer-than-X UIDs. */
export function buildUidFetch(tag: string, fromUid: number): string {
  return `${tag} UID FETCH ${fromUid}:* (UID BODY.PEEK[])\r\n`;
}

// ---------------- Network (integration only) ----------------

class ImapConn {
  private buf = "";
  private socket: TLSSocket;

  constructor(socket: TLSSocket) {
    this.socket = socket;
    socket.setEncoding("utf8");
    socket.on("data", (chunk) => {
      this.buf += String(chunk);
    });
  }

  /** Wait until `tag OK` or `tag NO/BAD` is seen; return entire response. */
  waitForTagged(tag: string, timeoutMs = 30_000): Promise<string> {
    return new Promise((res, rej) => {
      const start = Date.now();
      const tick = () => {
        const re = new RegExp(`^${tag} (OK|NO|BAD)[^\r\n]*\r\n`, "m");
        const m = this.buf.match(re);
        if (m) {
          const idx = this.buf.indexOf(m[0]);
          const out = this.buf.slice(0, idx + m[0].length);
          this.buf = this.buf.slice(idx + m[0].length);
          if (m[1] !== "OK") return rej(new Error(`IMAP ${m[1]}: ${m[0].trim()}`));
          return res(out);
        }
        if (Date.now() - start > timeoutMs) return rej(new Error("IMAP timeout"));
        setTimeout(tick, 25);
      };
      tick();
    });
  }

  send(line: string): void {
    this.socket.write(line);
  }

  end(): void {
    try {
      this.socket.end();
    } catch {
      /* ignore */
    }
  }
}

export async function fetchInbox(
  auth: ImapAuth,
  fromUid: number,
): Promise<ImapMessage[]> {
  if (!auth.secure) throw new Error("Only IMAPS (secure) supported in this build");
  const sock = tlsConnect({ host: auth.host, port: auth.port, servername: auth.host });
  if (auth.timeoutMs) sock.setTimeout(auth.timeoutMs);

  await new Promise<void>((res, rej) => {
    sock.once("secureConnect", () => res());
    sock.once("error", rej);
    sock.once("timeout", () => rej(new Error("IMAP connect timeout")));
  });

  const conn = new ImapConn(sock);
  // Server greeting (untagged * OK)
  await new Promise<void>((res) => setTimeout(res, 50));

  const tLogin = nextTag(true);
  conn.send(buildLogin(tLogin, auth.user, auth.pass));
  await conn.waitForTagged(tLogin);

  const tSelect = nextTag();
  conn.send(buildSelect(tSelect));
  await conn.waitForTagged(tSelect);

  const tFetch = nextTag();
  conn.send(buildUidFetch(tFetch, Math.max(1, fromUid + 1)));
  const fetchRaw = await conn.waitForTagged(tFetch);

  const tLogout = nextTag();
  conn.send(`${tLogout} LOGOUT\r\n`);
  await conn.waitForTagged(tLogout).catch(() => undefined);
  conn.end();

  return parseFetchResponse(fetchRaw);
}
