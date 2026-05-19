import "server-only";
import { createHash, createHmac } from "node:crypto";

/**
 * Minimal AWS Signature V4 + S3 adapter.
 *
 * Works against any S3-compatible store: AWS S3, Cloudflare R2, Backblaze B2,
 * MinIO, Tigris, Wasabi, SeaweedFS. No SDK dependency.
 *
 * Configure via env:
 *   S3_ENDPOINT       (e.g. "https://s3.us-east-1.amazonaws.com" or "https://<acct>.r2.cloudflarestorage.com")
 *   S3_REGION         (default "us-east-1")
 *   S3_BUCKET
 *   S3_ACCESS_KEY_ID
 *   S3_SECRET_ACCESS_KEY
 *   S3_FORCE_PATH_STYLE  ("1" for MinIO/R2, default "0" for AWS)
 *   S3_PUBLIC_BASE_URL   (optional; if set, downloads return a public URL instead of presigned)
 */

export type S3Config = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
  publicBaseUrl: string | null;
};

export function getS3Config(): S3Config {
  const endpoint = process.env.S3_ENDPOINT ?? "";
  const region = process.env.S3_REGION ?? "us-east-1";
  const bucket = process.env.S3_BUCKET ?? "";
  const accessKeyId = process.env.S3_ACCESS_KEY_ID ?? "";
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY ?? "";
  return {
    endpoint: endpoint.replace(/\/+$/, ""),
    region,
    bucket,
    accessKeyId,
    secretAccessKey,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "1",
    publicBaseUrl: process.env.S3_PUBLIC_BASE_URL ?? null,
  };
}

export function isStorageConfigured(): boolean {
  const c = getS3Config();
  return Boolean(c.endpoint && c.bucket && c.accessKeyId && c.secretAccessKey);
}

function sha256Hex(s: string | Uint8Array): string {
  return createHash("sha256").update(s).digest("hex");
}

function hmac(key: string | Buffer, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

function uriEncode(s: string, encodeSlash = true): string {
  return s.replace(/[^A-Za-z0-9_.~\-/]/g, (c) => {
    if (c === "/" && !encodeSlash) return c;
    return "%" + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0");
  });
}

function buildObjectUrl(cfg: S3Config, key: string): { host: string; pathname: string; href: string } {
  const url = new URL(cfg.endpoint);
  let pathname: string;
  let host: string;
  const safeKey = uriEncode(key, false);
  if (cfg.forcePathStyle) {
    pathname = `/${cfg.bucket}/${safeKey}`;
    host = url.host;
  } else {
    pathname = `/${safeKey}`;
    host = `${cfg.bucket}.${url.host}`;
  }
  const href = `${url.protocol}//${host}${pathname}`;
  return { host, pathname, href };
}

function amzDates(now = new Date()): { amzDate: string; dateStamp: string } {
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amzDate: iso, dateStamp: iso.slice(0, 8) };
}

function signingKey(secret: string, dateStamp: string, region: string, service: string): Buffer {
  const kDate = hmac("AWS4" + secret, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

/**
 * Generate a presigned URL for PUT or GET. Default expiry 15 min.
 */
export function presignUrl(opts: {
  method: "GET" | "PUT" | "DELETE";
  key: string;
  expiresSeconds?: number;
  contentType?: string;
  config?: S3Config;
}): string {
  const cfg = opts.config ?? getS3Config();
  if (!isStorageConfigured()) {
    throw new Error("S3 not configured (set S3_ENDPOINT / S3_BUCKET / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY)");
  }
  const { host, pathname } = buildObjectUrl(cfg, opts.key);
  const { amzDate, dateStamp } = amzDates();
  const expires = opts.expiresSeconds ?? 900;
  const credential = `${cfg.accessKeyId}/${dateStamp}/${cfg.region}/s3/aws4_request`;
  const signedHeaders = "host";
  const params = new URLSearchParams();
  params.set("X-Amz-Algorithm", "AWS4-HMAC-SHA256");
  params.set("X-Amz-Credential", credential);
  params.set("X-Amz-Date", amzDate);
  params.set("X-Amz-Expires", String(expires));
  params.set("X-Amz-SignedHeaders", signedHeaders);
  // Sort query string keys alphabetically for canonical request.
  const sortedQs = Array.from(params.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  const canonicalRequest = [
    opts.method,
    pathname,
    sortedQs,
    `host:${host}\n`,
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    `${dateStamp}/${cfg.region}/s3/aws4_request`,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const key = signingKey(cfg.secretAccessKey, dateStamp, cfg.region, "s3");
  const signature = createHmac("sha256", key).update(stringToSign).digest("hex");

  const url = new URL(cfg.endpoint);
  const href = `${url.protocol}//${host}${pathname}?${sortedQs}&X-Amz-Signature=${signature}`;
  return href;
}

export function publicUrl(key: string, config?: S3Config): string | null {
  const cfg = config ?? getS3Config();
  if (cfg.publicBaseUrl) return `${cfg.publicBaseUrl.replace(/\/+$/, "")}/${uriEncode(key, false)}`;
  return null;
}

/**
 * Build a workspace-scoped storage key. Keep it predictable for audits.
 *   ws/<wsId>/<scope>/<yyyy>/<mm>/<id>-<safeName>
 */
export function buildStorageKey(opts: {
  workspaceId: string;
  scope: string; // e.g. "files", "esign", "mail-attach"
  id: string;
  filename: string;
}): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const safeName = opts.filename
    .replace(/\.\.+/g, "_") // collapse path-traversal dots
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .slice(0, 200);
  return `ws/${opts.workspaceId}/${opts.scope}/${yyyy}/${mm}/${opts.id}-${safeName}`;
}
