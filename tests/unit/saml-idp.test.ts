import { describe, it, expect } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import {
  buildIdpMetadataXml,
  buildSignedSamlResponse,
  newSamlId,
  parseAuthnRequest,
  samlPostBindingFormHtml,
  verifyAssertionSignature,
} from "@/modules/sso/saml-idp";

function selfSignedCertPem(publicKeyPem: string): string {
  // Tests verify only RSA signature math, not PKI, so a stub PEM-wrapped SPKI
  // body suffices for the verifier path (which calls `createPublicKey` on it).
  return publicKeyPem;
}

function freshKey() {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return {
    privateKeyPem: privateKey.export({ format: "pem", type: "pkcs8" }).toString(),
    certificatePem: publicKey.export({ format: "pem", type: "spki" }).toString(),
  };
}

describe("saml-idp — metadata", () => {
  it("emits an EntityDescriptor with both bindings", () => {
    const { certificatePem } = freshKey();
    const xml = buildIdpMetadataXml({
      entityId: "https://idp.example.com/saml",
      ssoUrl: "https://idp.example.com/sso",
      sloUrl: "https://idp.example.com/slo",
      certificatePem,
    });
    expect(xml).toContain('entityID="https://idp.example.com/saml"');
    expect(xml).toContain("HTTP-Redirect");
    expect(xml).toContain("HTTP-POST");
    expect(xml).toContain("<X509Certificate>");
    expect(xml).toContain("SingleLogoutService");
  });

  it("omits SLO when no sloUrl provided", () => {
    const { certificatePem } = freshKey();
    const xml = buildIdpMetadataXml({
      entityId: "id",
      ssoUrl: "https://idp.example.com/sso",
      certificatePem,
    });
    expect(xml).not.toContain("SingleLogoutService");
  });
});

describe("saml-idp — parseAuthnRequest", () => {
  it("extracts ID, Issuer, ACS URL from a minimal AuthnRequest", () => {
    const xml =
      `<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="_abc123" ` +
      `IssueInstant="2026-05-09T12:00:00Z" AssertionConsumerServiceURL="https://sp.example.com/acs" ` +
      `Destination="https://idp.example.com/sso">` +
      `<saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">https://sp.example.com</saml:Issuer>` +
      `</samlp:AuthnRequest>`;
    const parsed = parseAuthnRequest(xml);
    expect(parsed.id).toBe("_abc123");
    expect(parsed.issuer).toBe("https://sp.example.com");
    expect(parsed.acsUrl).toBe("https://sp.example.com/acs");
    expect(parsed.destination).toBe("https://idp.example.com/sso");
  });

  it("throws on non-AuthnRequest XML", () => {
    expect(() => parseAuthnRequest("<other/>")).toThrow();
  });
});

describe("saml-idp — buildSignedSamlResponse", () => {
  const key = freshKey();
  const baseInput = {
    issuer: "https://idp.example.com",
    audience: "https://sp.example.com",
    recipient: "https://sp.example.com/acs",
    destination: "https://sp.example.com/acs",
    inResponseTo: "_authnreq1",
    subjectNameId: "alice@example.com",
    notBefore: new Date("2026-05-09T12:00:00Z"),
    notOnOrAfter: new Date("2026-05-09T12:05:00Z"),
    issueInstant: new Date("2026-05-09T12:00:00Z"),
    responseId: "_resp1",
    assertionId: "_assert1",
    attributes: { email: "alice@example.com", role: ["admin", "ops"] },
  };

  it("produces a parseable Response with embedded signed Assertion", () => {
    const xml = buildSignedSamlResponse(baseInput, key);
    expect(xml).toContain('<samlp:Response');
    expect(xml).toContain('<saml:Assertion');
    expect(xml).toContain('<ds:Signature');
    expect(xml).toContain("alice@example.com");
    expect(xml).toContain('Name="role"');
    expect(xml).toContain('InResponseTo="_authnreq1"');
  });

  it("self-verifies via verifyAssertionSignature", () => {
    const xml = buildSignedSamlResponse(baseInput, key);
    expect(verifyAssertionSignature(xml, selfSignedCertPem(key.certificatePem))).toBe(true);
  });

  it("verification fails when the assertion is tampered", () => {
    const xml = buildSignedSamlResponse(baseInput, key);
    const tampered = xml.replace("alice@example.com", "mallory@example.com");
    expect(verifyAssertionSignature(tampered, selfSignedCertPem(key.certificatePem))).toBe(false);
  });
});

describe("saml-idp — POST binding form", () => {
  it("emits an auto-submit form with base64 SAMLResponse", () => {
    const html = samlPostBindingFormHtml({
      acsUrl: "https://sp.example.com/acs",
      samlResponseXml: "<samlp:Response/>",
      relayState: "abc",
    });
    expect(html).toContain('action="https://sp.example.com/acs"');
    expect(html).toContain('name="SAMLResponse"');
    expect(html).toContain('name="RelayState"');
    expect(html).toContain('value="abc"');
  });
});

describe("saml-idp — newSamlId", () => {
  it("starts with a non-digit prefix and is unique-ish", () => {
    const a = newSamlId();
    const b = newSamlId();
    expect(a.startsWith("_")).toBe(true);
    expect(a).not.toBe(b);
  });
});
