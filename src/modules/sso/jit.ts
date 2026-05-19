/**
 * Pure JIT (just-in-time) provisioning mapper.
 *
 * Takes raw IdP attributes (from a SAML AttributeStatement or an OIDC ID token)
 * plus the SsoProvider configuration, and returns a `ProvisionPlan` describing
 * the user record that should exist after this login. Persistence is performed
 * by the caller (server action / route handler).
 */

import type { SystemRole } from "@prisma/client";

export type AttributeMap = Record<string, string | string[] | undefined>;

export interface JitProviderConfig {
  emailAttr: string; // e.g. "email" or "EmailAddress"
  nameAttr: string; // e.g. "name" or "displayName"
  defaultRole: SystemRole;
  /**
   * Optional role mapping by IdP group. Keys are group names; values are roles.
   * Used when the IdP includes a "groups" or equivalent attribute.
   */
  groupRoleMap?: Record<string, SystemRole>;
  /**
   * Optional attribute name carrying group memberships. If unset, no group
   * mapping is attempted.
   */
  groupsAttr?: string;
  /**
   * If set, only users whose email matches one of these domains are allowed.
   * Empty array = no domain restriction.
   */
  allowedDomains?: string[];
}

export interface ExistingUser {
  id: string;
  email: string;
  name: string | null;
  role: SystemRole;
}

export type ProvisionAction = "CREATE" | "UPDATE" | "NOOP";

export interface ProvisionPlan {
  action: ProvisionAction;
  email: string;
  name: string;
  role: SystemRole;
  changedFields: string[]; // populated when action === "UPDATE"
}

function pickFirst(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function pickAll(v: string | string[] | undefined): string[] {
  if (Array.isArray(v)) return v;
  return v ? [v] : [];
}

function normalizeEmail(s: string): string {
  return s.trim().toLowerCase();
}

function emailDomain(email: string): string {
  const i = email.lastIndexOf("@");
  return i >= 0 ? email.slice(i + 1) : "";
}

export function mapAttributesToRole(
  attrs: AttributeMap,
  cfg: JitProviderConfig,
): SystemRole {
  if (!cfg.groupsAttr || !cfg.groupRoleMap) return cfg.defaultRole;
  const groups = pickAll(attrs[cfg.groupsAttr]);
  for (const g of groups) {
    const mapped = cfg.groupRoleMap[g];
    if (mapped) return mapped;
  }
  return cfg.defaultRole;
}

/**
 * Build a provisioning plan. Throws when the input is unusable (missing email,
 * disallowed domain). Never touches a database.
 */
export function buildProvisionPlan(
  attrs: AttributeMap,
  cfg: JitProviderConfig,
  existing: ExistingUser | null,
): ProvisionPlan {
  const rawEmail = pickFirst(attrs[cfg.emailAttr]);
  if (!rawEmail) throw new Error(`IdP did not return required attribute: ${cfg.emailAttr}`);
  const email = normalizeEmail(rawEmail);
  if (!email.includes("@")) throw new Error("IdP returned malformed email");

  if (cfg.allowedDomains && cfg.allowedDomains.length > 0) {
    const dom = emailDomain(email);
    const allowed = cfg.allowedDomains.map((d) => d.trim().toLowerCase());
    if (!allowed.includes(dom)) {
      throw new Error(`Email domain not allowed: ${dom}`);
    }
  }

  const name = pickFirst(attrs[cfg.nameAttr])?.trim() || email.split("@")[0]!;
  const role = mapAttributesToRole(attrs, cfg);

  if (!existing) {
    return { action: "CREATE", email, name, role, changedFields: [] };
  }

  const changed: string[] = [];
  if (normalizeEmail(existing.email) !== email) changed.push("email");
  if ((existing.name ?? "") !== name) changed.push("name");
  if (existing.role !== role) changed.push("role");

  return {
    action: changed.length > 0 ? "UPDATE" : "NOOP",
    email,
    name,
    role,
    changedFields: changed,
  };
}
