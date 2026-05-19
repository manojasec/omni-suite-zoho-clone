/**
 * Compact RFC 5322 header parser. Handles only what we need:
 *   - line unfolding (CRLF + WSP continuation)
 *   - splitting headers from body
 *   - extracting plain text from very simple `text/plain` or `multipart/alternative`
 *
 * This is NOT a full MIME parser. For attachment-heavy messages or non-ASCII
 * encodings, plug in a real library. The intent here is "good enough to
 * thread inbound messages and surface preview text" — anything more is opt-in.
 */

export type ParsedMessage = {
  headers: Record<string, string>;
  rawHeaders: string;
  body: string;
  text: string; // best-effort plain text
  subject: string;
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  messageId: string | null;
  date: Date | null;
};

/** Unfold continuation lines: a line beginning with WSP belongs to previous. */
export function unfoldHeaders(raw: string): string {
  return raw.replace(/\r?\n[\t ]+/g, " ");
}

export function splitHeadersAndBody(rfc822: string): { head: string; body: string } {
  const i = rfc822.indexOf("\r\n\r\n");
  if (i !== -1) {
    return { head: rfc822.slice(0, i), body: rfc822.slice(i + 4) };
  }
  const j = rfc822.indexOf("\n\n");
  if (j !== -1) {
    return { head: rfc822.slice(0, j), body: rfc822.slice(j + 2) };
  }
  return { head: rfc822, body: "" };
}

export function parseHeaderBlock(headBlock: string): Record<string, string> {
  const unfolded = unfoldHeaders(headBlock);
  const lines = unfolded.split(/\r?\n/);
  const out: Record<string, string> = {};
  for (const line of lines) {
    const colon = line.indexOf(":");
    if (colon < 1) continue;
    const name = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    // First occurrence wins for our purposes (RFC allows multiple; we keep first).
    if (!(name in out)) out[name] = value;
  }
  return out;
}

export function parseAddressList(value: string | undefined): string[] {
  if (!value) return [];
  // Split on commas not inside angle brackets or quotes.
  const out: string[] = [];
  let depth = 0;
  let inQuote = false;
  let buf = "";
  for (const ch of value) {
    if (ch === '"') inQuote = !inQuote;
    else if (!inQuote && ch === "<") depth++;
    else if (!inQuote && ch === ">") depth--;
    else if (!inQuote && depth === 0 && ch === ",") {
      const a = extractAddress(buf);
      if (a) out.push(a);
      buf = "";
      continue;
    }
    buf += ch;
  }
  const last = extractAddress(buf);
  if (last) out.push(last);
  return out;
}

export function extractAddress(token: string): string | null {
  const t = token.trim();
  if (!t) return null;
  const angle = t.match(/<([^>]+)>/);
  if (angle) return angle[1].trim().toLowerCase();
  // Bare address?
  if (/^[^\s@]+@[^\s@]+$/.test(t)) return t.toLowerCase();
  return null;
}

export function parseRfc822Date(value: string | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Return best-effort plain text from a message body given headers. */
export function extractText(headers: Record<string, string>, body: string): string {
  const ct = headers["content-type"] ?? "text/plain";
  const lower = ct.toLowerCase();
  if (lower.startsWith("text/plain")) return decodeTransfer(headers, body);
  if (lower.startsWith("multipart/")) {
    const boundaryMatch = ct.match(/boundary="?([^";]+)"?/i);
    if (!boundaryMatch) return body;
    const boundary = "--" + boundaryMatch[1];
    const parts = body.split(boundary).slice(1, -1); // drop preamble + epilogue
    let plain = "";
    let html = "";
    for (const p of parts) {
      const stripped = p.replace(/^\r?\n/, "");
      const { head, body: pBody } = splitHeadersAndBody(stripped);
      const partHeaders = parseHeaderBlock(head);
      const pCt = (partHeaders["content-type"] ?? "text/plain").toLowerCase();
      const decoded = decodeTransfer(partHeaders, pBody);
      if (pCt.startsWith("text/plain") && !plain) plain = decoded;
      else if (pCt.startsWith("text/html") && !html) html = decoded;
    }
    if (plain) return plain;
    if (html) return stripHtml(html);
    return "";
  }
  if (lower.startsWith("text/html")) return stripHtml(decodeTransfer(headers, body));
  return body;
}

function decodeTransfer(headers: Record<string, string>, body: string): string {
  const enc = (headers["content-transfer-encoding"] ?? "7bit").toLowerCase();
  if (enc === "base64") {
    try {
      return Buffer.from(body.replace(/\s+/g, ""), "base64").toString("utf8");
    } catch {
      return body;
    }
  }
  if (enc === "quoted-printable") {
    return body
      .replace(/=\r?\n/g, "")
      .replace(/=([0-9A-Fa-f]{2})/g, (_m, h) => String.fromCharCode(parseInt(h, 16)));
  }
  return body;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseRfc822(rfc822: string): ParsedMessage {
  const { head, body } = splitHeadersAndBody(rfc822);
  const headers = parseHeaderBlock(head);
  const text = extractText(headers, body);
  return {
    headers,
    rawHeaders: head,
    body,
    text,
    subject: headers["subject"] ?? "(no subject)",
    from: extractAddress(headers["from"] ?? "") ?? "",
    to: parseAddressList(headers["to"]),
    cc: parseAddressList(headers["cc"]),
    bcc: parseAddressList(headers["bcc"]),
    messageId: (headers["message-id"] ?? "").replace(/[<>]/g, "") || null,
    date: parseRfc822Date(headers["date"]),
  };
}
