import { z } from "zod";

const optionalString = (max: number) =>
  z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().trim().max(max).optional(),
  );

export const SSO_PROTOCOLS = ["SAML", "OIDC"] as const;
export type SsoProtocol = (typeof SSO_PROTOCOLS)[number];

export const SSO_PROVIDER_STATUSES = ["DRAFT", "ACTIVE", "DISABLED"] as const;
export type SsoProviderStatus = (typeof SSO_PROVIDER_STATUSES)[number];

export const SSO_LOGIN_KINDS = [
  "LOGIN_SUCCESS",
  "LOGIN_FAILED",
  "PROVISION",
] as const;
export type SsoLoginKind = (typeof SSO_LOGIN_KINDS)[number];

export const SSO_PROTOCOL_LABELS: Record<SsoProtocol, string> = {
  SAML: "SAML 2.0",
  OIDC: "OpenID Connect",
};

export const SSO_PROVIDER_STATUS_LABELS: Record<SsoProviderStatus, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  DISABLED: "Disabled",
};

export const SSO_LOGIN_KIND_LABELS: Record<SsoLoginKind, string> = {
  LOGIN_SUCCESS: "Login success",
  LOGIN_FAILED: "Login failed",
  PROVISION: "User provisioned",
};

export const ASSIGNABLE_DEFAULT_ROLES = [
  "MEMBER",
  "AGENT",
  "SALES",
  "FINANCE",
  "VIEWER",
] as const;
export type AssignableDefaultRole = (typeof ASSIGNABLE_DEFAULT_ROLES)[number];

const domainRe = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

const optionalUrl = (max: number) =>
  z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().trim().url().max(max).optional(),
  );

const optionalDomain = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z
    .string()
    .trim()
    .toLowerCase()
    .max(160)
    .regex(domainRe, "Use a valid domain like example.com")
    .optional(),
);

export const ssoProviderSchema = z.object({
  name: z.string().trim().min(1).max(160),
  protocol: z.enum(SSO_PROTOCOLS).default("SAML"),
  status: z.enum(SSO_PROVIDER_STATUSES).default("DRAFT"),
  domain: optionalDomain,
  entityId: z.string().trim().min(1).max(400),
  ssoUrl: z.string().trim().url().max(600),
  sloUrl: optionalUrl(600),
  certificate: optionalString(8000),
  emailAttr: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .default("email"),
  nameAttr: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .default("name"),
  defaultRole: z.enum(ASSIGNABLE_DEFAULT_ROLES).default("MEMBER"),
});

export const ssoStatusTransitionSchema = z.object({
  to: z.enum(SSO_PROVIDER_STATUSES),
});

export const SSO_PROVIDER_TRANSITIONS: Record<
  SsoProviderStatus,
  readonly SsoProviderStatus[]
> = {
  DRAFT: ["ACTIVE"],
  ACTIVE: ["DISABLED"],
  DISABLED: ["ACTIVE", "DRAFT"],
};

export function canTransitionSsoProvider(
  from: SsoProviderStatus,
  to: SsoProviderStatus,
): boolean {
  return SSO_PROVIDER_TRANSITIONS[from]?.includes(to) ?? false;
}

const PEM_BEGIN = "-----BEGIN CERTIFICATE-----";
const PEM_END = "-----END CERTIFICATE-----";

/**
 * Lightweight PEM x509 certificate sanity check. Does NOT verify signatures —
 * just shape, base64 body, and minimum length.
 */
export function validateCertificate(cert: string | null | undefined): {
  ok: boolean;
  reason?: string;
} {
  if (!cert || !cert.trim()) return { ok: true };
  const trimmed = cert.trim();
  if (!trimmed.includes(PEM_BEGIN)) {
    return { ok: false, reason: "Missing BEGIN CERTIFICATE marker" };
  }
  if (!trimmed.includes(PEM_END)) {
    return { ok: false, reason: "Missing END CERTIFICATE marker" };
  }
  const body = trimmed
    .slice(trimmed.indexOf(PEM_BEGIN) + PEM_BEGIN.length, trimmed.indexOf(PEM_END))
    .replace(/\s+/g, "");
  if (body.length < 64) return { ok: false, reason: "Certificate body too short" };
  if (!/^[A-Za-z0-9+/=]+$/.test(body)) {
    return { ok: false, reason: "Certificate body must be base64" };
  }
  return { ok: true };
}

/**
 * Extract the email domain segment from an address, lowercased. Returns null
 * if the input is not a syntactically valid email.
 */
export function extractEmailDomain(email: string): string | null {
  if (typeof email !== "string") return null;
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return null;
  const domain = email.slice(at + 1).trim().toLowerCase();
  if (!domainRe.test(domain)) return null;
  return domain;
}

/**
 * Pick the active SSO provider that should handle a given email. Returns the
 * first ACTIVE provider whose claimed domain matches the email domain, else
 * null. Pass providers ordered by precedence (most specific first).
 */
export function resolveProviderForEmail<
  P extends { status: SsoProviderStatus; domain: string | null },
>(email: string, providers: readonly P[]): P | null {
  const domain = extractEmailDomain(email);
  if (!domain) return null;
  for (const p of providers) {
    if (p.status !== "ACTIVE") continue;
    if (!p.domain) continue;
    if (p.domain.toLowerCase() === domain) return p;
  }
  return null;
}

export type AttributeMap = Record<string, string>;

/**
 * Pull the configured email/name attributes out of a SAML attribute bag.
 * Returns nulls for missing claims rather than throwing.
 */
export function readSsoClaims(
  attrs: AttributeMap,
  config: { emailAttr: string; nameAttr: string },
): { email: string | null; name: string | null } {
  const email = attrs[config.emailAttr];
  const name = attrs[config.nameAttr];
  return {
    email: typeof email === "string" && email.includes("@") ? email.trim() : null,
    name: typeof name === "string" && name.trim() ? name.trim() : null,
  };
}

export function summarizeProvidersByStatus(
  providers: readonly { status: SsoProviderStatus }[],
): Record<SsoProviderStatus, number> {
  const out: Record<SsoProviderStatus, number> = {
    DRAFT: 0,
    ACTIVE: 0,
    DISABLED: 0,
  };
  for (const p of providers) out[p.status] += 1;
  return out;
}

export function formatDate(d: Date | null | undefined): string {
  if (!d) return "";
  const t = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(t.getTime())) return "";
  return t.toISOString().slice(0, 16).replace("T", " ");
}

// ---------- M66: SamlConnection (workspace-level) + ScimToken ----------

export const samlConnectionSchema = z.object({
  name: z.string().trim().min(1).max(160),
  idpEntityId: z.string().trim().min(1).max(500),
  idpSsoUrl: z.string().trim().url().max(500),
  idpCertificate: z.string().trim().min(20).max(20000),
  spEntityId: z.string().trim().min(1).max(500),
});
export type SamlConnectionInput = z.infer<typeof samlConnectionSchema>;

export const scimTokenSchema = z.object({
  name: z.string().trim().min(1).max(160),
});
export type ScimTokenInput = z.infer<typeof scimTokenSchema>;
