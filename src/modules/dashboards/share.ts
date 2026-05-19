/**
 * Dashboard share + embed tokens.
 *
 * Stateless HMAC-signed tokens — no DB lookup required to validate. Tokens
 * carry workspace + dashboard scope, an issued-at timestamp, optional TTL,
 * and a permission scope (view / interact). Designed for external embeds
 * (iframes) and read-only public links.
 *
 * Zero deps; uses only `node:crypto`.
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type ShareScope = "view" | "interact";

export type ShareTokenPayload = {
  workspaceId: string;
  dashboardId: string;
  scope: ShareScope;
  /** Issued-at, ms since epoch. */
  iat: number;
  /** Optional absolute expiry ms since epoch. */
  exp?: number;
  /** Random nonce so two tokens for the same params still differ. */
  nonce: string;
};

const SEP = ".";

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function sign(payloadB64: string, secret: string): string {
  return b64url(createHmac("sha256", secret).update(payloadB64).digest());
}

/**
 * Create a signed share token. `ttlMs` (when provided & > 0) sets `exp`.
 */
export function createShareToken(
  input: {
    workspaceId: string;
    dashboardId: string;
    scope?: ShareScope;
    ttlMs?: number;
    /** Override clock for testing. */
    now?: number;
    /** Override nonce for testing. */
    nonce?: string;
  },
  secret: string,
): string {
  if (!secret) throw new Error("share secret required");
  const now = input.now ?? Date.now();
  const payload: ShareTokenPayload = {
    workspaceId: input.workspaceId,
    dashboardId: input.dashboardId,
    scope: input.scope ?? "view",
    iat: now,
    nonce: input.nonce ?? b64url(randomBytes(8)),
  };
  if (input.ttlMs && input.ttlMs > 0) payload.exp = now + input.ttlMs;
  const body = b64url(JSON.stringify(payload));
  const sig = sign(body, secret);
  return `${body}${SEP}${sig}`;
}

/**
 * Verify a token's signature, scope, and expiry. Returns the payload on
 * success or null on any failure.
 */
export function verifyShareToken(
  token: string,
  secret: string,
  options: { expectedDashboardId?: string; expectedWorkspaceId?: string; now?: number } = {},
): ShareTokenPayload | null {
  if (typeof token !== "string" || !token) return null;
  const parts = token.split(SEP);
  if (parts.length !== 2) return null;
  const [body, sig] = parts as [string, string];
  const expected = sign(body, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;

  let payload: ShareTokenPayload;
  try {
    payload = JSON.parse(fromB64url(body).toString("utf8")) as ShareTokenPayload;
  } catch {
    return null;
  }
  if (!payload || typeof payload !== "object") return null;
  if (typeof payload.workspaceId !== "string" || typeof payload.dashboardId !== "string") return null;
  if (payload.scope !== "view" && payload.scope !== "interact") return null;
  if (typeof payload.iat !== "number") return null;

  const now = options.now ?? Date.now();
  if (typeof payload.exp === "number" && now >= payload.exp) return null;
  if (options.expectedDashboardId && options.expectedDashboardId !== payload.dashboardId) return null;
  if (options.expectedWorkspaceId && options.expectedWorkspaceId !== payload.workspaceId) return null;
  return payload;
}

/** Build a fully-qualified embed URL. */
export function buildEmbedUrl(baseUrl: string, dashboardId: string, token: string): string {
  const trimmed = baseUrl.replace(/\/+$/g, "");
  const params = new URLSearchParams({ token });
  return `${trimmed}/embed/dashboards/${encodeURIComponent(dashboardId)}?${params.toString()}`;
}

/** Build an iframe-safe `<iframe>` snippet. */
export function buildEmbedIframe(
  embedUrl: string,
  options: { width?: number | string; height?: number | string; title?: string } = {},
): string {
  const w = options.width ?? "100%";
  const h = options.height ?? 600;
  const title = (options.title ?? "Dashboard").replace(/"/g, "&quot;");
  const safeUrl = embedUrl.replace(/"/g, "&quot;");
  return `<iframe src="${safeUrl}" width="${w}" height="${h}" title="${title}" loading="lazy" referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin"></iframe>`;
}
