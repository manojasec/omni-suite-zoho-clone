import { randomBytes } from "node:crypto";
import { z } from "zod";

/** Generate a URL-safe portal access token (~43 chars). */
export function generatePortalToken(): string {
  return randomBytes(32).toString("base64url");
}

const optional = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

export const portalAccessSchema = z.object({
  label: optional(120),
  expiresAt: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v && v.length > 0 ? v : undefined)),
});
export type PortalAccessInput = z.infer<typeof portalAccessSchema>;

export type PortalLinkStatus = "active" | "expired" | "revoked";

export function portalLinkStatus(input: {
  revokedAt: Date | null;
  expiresAt: Date | null;
  now?: Date;
}): PortalLinkStatus {
  if (input.revokedAt) return "revoked";
  const now = input.now ?? new Date();
  if (input.expiresAt && input.expiresAt.getTime() <= now.getTime()) {
    return "expired";
  }
  return "active";
}

const STATUS_LABELS: Record<PortalLinkStatus, string> = {
  active: "Active",
  expired: "Expired",
  revoked: "Revoked",
};

const STATUS_COLORS: Record<PortalLinkStatus, string> = {
  active: "bg-emerald-100 text-emerald-800",
  expired: "bg-amber-100 text-amber-800",
  revoked: "bg-zinc-200 text-zinc-700",
};

export function formatPortalStatus(s: PortalLinkStatus): string {
  return STATUS_LABELS[s];
}

export function portalStatusColor(s: PortalLinkStatus): string {
  return STATUS_COLORS[s];
}

/** Build the public URL for a portal token. */
export function buildPortalUrl(origin: string, token: string): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}/portal/${token}`;
}
