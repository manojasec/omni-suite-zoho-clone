import { describe, expect, it } from "vitest";
import {
  SSO_PROVIDER_TRANSITIONS,
  canTransitionSsoProvider,
  extractEmailDomain,
  readSsoClaims,
  resolveProviderForEmail,
  ssoProviderSchema,
  summarizeProvidersByStatus,
  validateCertificate,
} from "@/modules/sso/schemas";

const VALID_PEM =
  "-----BEGIN CERTIFICATE-----\n" +
  "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvalidBase64Body0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+/=\n" +
  "-----END CERTIFICATE-----";

describe("ssoProviderSchema", () => {
  it("accepts a clean SAML provider with defaults", () => {
    const out = ssoProviderSchema.parse({
      name: "Okta",
      entityId: "https://idp.example.com/metadata",
      ssoUrl: "https://idp.example.com/sso",
    });
    expect(out.protocol).toBe("SAML");
    expect(out.status).toBe("DRAFT");
    expect(out.emailAttr).toBe("email");
    expect(out.nameAttr).toBe("name");
    expect(out.defaultRole).toBe("MEMBER");
    expect(out.domain).toBeUndefined();
    expect(out.sloUrl).toBeUndefined();
  });

  it("lowercases domain and rejects invalid ones", () => {
    const ok = ssoProviderSchema.parse({
      name: "X",
      entityId: "https://e",
      ssoUrl: "https://idp.example.com/sso",
      domain: "Example.COM",
    });
    expect(ok.domain).toBe("example.com");
    expect(() =>
      ssoProviderSchema.parse({
        name: "X",
        entityId: "https://e",
        ssoUrl: "https://idp.example.com/sso",
        domain: "not a domain",
      }),
    ).toThrow();
  });

  it("requires a valid SSO URL", () => {
    expect(() =>
      ssoProviderSchema.parse({
        name: "X",
        entityId: "https://e",
        ssoUrl: "not-a-url",
      }),
    ).toThrow();
  });

  it("treats empty optional URLs as undefined", () => {
    const out = ssoProviderSchema.parse({
      name: "X",
      entityId: "https://e",
      ssoUrl: "https://idp.example.com/sso",
      sloUrl: "",
      certificate: "",
    });
    expect(out.sloUrl).toBeUndefined();
    expect(out.certificate).toBeUndefined();
  });
});

describe("validateCertificate", () => {
  it("accepts empty/missing certificate as ok", () => {
    expect(validateCertificate(undefined).ok).toBe(true);
    expect(validateCertificate("").ok).toBe(true);
    expect(validateCertificate("   ").ok).toBe(true);
  });

  it("accepts a well-formed PEM block", () => {
    expect(validateCertificate(VALID_PEM).ok).toBe(true);
  });

  it("rejects a body without BEGIN marker", () => {
    const r = validateCertificate("MIIBIjANBgkqhkiG9w0BAQEFAA");
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/BEGIN/);
  });

  it("rejects a body without END marker", () => {
    const r = validateCertificate("-----BEGIN CERTIFICATE-----\nMII...");
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/END/);
  });

  it("rejects non-base64 body", () => {
    const r = validateCertificate(
      "-----BEGIN CERTIFICATE-----\n!!!not base64!!!\n-----END CERTIFICATE-----",
    );
    expect(r.ok).toBe(false);
  });

  it("rejects too-short body", () => {
    const r = validateCertificate(
      "-----BEGIN CERTIFICATE-----\nABC\n-----END CERTIFICATE-----",
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/too short/);
  });
});

describe("extractEmailDomain", () => {
  it("returns lowercased domain", () => {
    expect(extractEmailDomain("Alice@Example.COM")).toBe("example.com");
  });

  it("returns null for invalid emails", () => {
    expect(extractEmailDomain("nope")).toBeNull();
    expect(extractEmailDomain("@example.com")).toBeNull();
    expect(extractEmailDomain("alice@")).toBeNull();
    expect(extractEmailDomain("alice@no-tld")).toBeNull();
  });

  it("handles non-string input safely", () => {
    expect(extractEmailDomain(undefined as unknown as string)).toBeNull();
  });
});

describe("resolveProviderForEmail", () => {
  const providers = [
    { id: "p1", status: "ACTIVE" as const, domain: "example.com" },
    { id: "p2", status: "DRAFT" as const, domain: "draft.com" },
    { id: "p3", status: "ACTIVE" as const, domain: null },
    { id: "p4", status: "DISABLED" as const, domain: "disabled.com" },
  ];

  it("matches an ACTIVE provider by email domain", () => {
    expect(resolveProviderForEmail("user@example.com", providers)?.id).toBe("p1");
  });

  it("ignores DRAFT and DISABLED providers", () => {
    expect(resolveProviderForEmail("user@draft.com", providers)).toBeNull();
    expect(resolveProviderForEmail("user@disabled.com", providers)).toBeNull();
  });

  it("returns null for an unknown domain", () => {
    expect(resolveProviderForEmail("user@unknown.io", providers)).toBeNull();
  });

  it("returns null for malformed emails", () => {
    expect(resolveProviderForEmail("nope", providers)).toBeNull();
  });
});

describe("readSsoClaims", () => {
  it("pulls configured email and name attributes", () => {
    const r = readSsoClaims(
      { mail: "x@y.com", displayName: "Pat" },
      { emailAttr: "mail", nameAttr: "displayName" },
    );
    expect(r.email).toBe("x@y.com");
    expect(r.name).toBe("Pat");
  });

  it("nulls missing or invalid email", () => {
    const r = readSsoClaims(
      { mail: "", displayName: "Pat" },
      { emailAttr: "mail", nameAttr: "displayName" },
    );
    expect(r.email).toBeNull();
    expect(r.name).toBe("Pat");
  });

  it("nulls invalid email without @", () => {
    const r = readSsoClaims(
      { email: "not-an-email", name: "A" },
      { emailAttr: "email", nameAttr: "name" },
    );
    expect(r.email).toBeNull();
  });
});

describe("canTransitionSsoProvider", () => {
  it("DRAFT → ACTIVE allowed", () => {
    expect(canTransitionSsoProvider("DRAFT", "ACTIVE")).toBe(true);
  });

  it("ACTIVE → DISABLED allowed, ACTIVE → DRAFT not allowed", () => {
    expect(canTransitionSsoProvider("ACTIVE", "DISABLED")).toBe(true);
    expect(canTransitionSsoProvider("ACTIVE", "DRAFT")).toBe(false);
  });

  it("DISABLED can re-activate or revert to draft", () => {
    expect(canTransitionSsoProvider("DISABLED", "ACTIVE")).toBe(true);
    expect(canTransitionSsoProvider("DISABLED", "DRAFT")).toBe(true);
  });

  it("DRAFT → DISABLED not allowed (must activate first)", () => {
    expect(canTransitionSsoProvider("DRAFT", "DISABLED")).toBe(false);
  });

  it("transition map matches expected shape", () => {
    expect(SSO_PROVIDER_TRANSITIONS.DRAFT).toEqual(["ACTIVE"]);
  });
});

describe("summarizeProvidersByStatus", () => {
  it("counts each status", () => {
    const out = summarizeProvidersByStatus([
      { status: "ACTIVE" },
      { status: "ACTIVE" },
      { status: "DRAFT" },
      { status: "DISABLED" },
    ]);
    expect(out).toEqual({ ACTIVE: 2, DRAFT: 1, DISABLED: 1 });
  });

  it("returns zeros for empty list", () => {
    expect(summarizeProvidersByStatus([])).toEqual({
      ACTIVE: 0,
      DRAFT: 0,
      DISABLED: 0,
    });
  });
});
