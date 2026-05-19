import { createHash, createPrivateKey, createPublicKey, createSign, createVerify, randomBytes } from "node:crypto";

/**
 * Zero-dep SAML 2.0 IdP issuer.
 *
 * What this provides (the IdP-side surface used by SsoProvider):
 * - `buildIdpMetadataXml`        — IdP descriptor served at /sso/metadata
 * - `parseAuthnRequest`          — minimal SAML AuthnRequest parser (id, ACS, issuer)
 * - `buildSignedSamlResponse`    — RSA-SHA256-signed Response/Assertion XML
 * - `samlPostBindingFormHtml`    — auto-submit HTML form for HTTP-POST binding
 *
 * Crypto:
 * - Signing uses RSA-SHA256 with enveloped signature + Exclusive XML Canonicalization
 *   restricted to the simple, attribute-clean assertion XML this module emits.
 *   We never canonicalize arbitrary external XML — we only sign documents we built.
 *
 * Limitations (intentional, called out for the integrator):
 * - No XML encryption of assertions (most IdP integrations accept plain).
 * - Incoming AuthnRequests are parsed via regex — we accept only a small subset.
 * - C14N is *not* a general implementation; it's a simplified emitter for the
 *   exact shape of <Assertion> we generate (no namespace inheritance edge cases).
 */

// ---------- Public types ----------

export interface SamlIdpKey {
  privateKeyPem: string;
  certificatePem: string; // x509 PEM
}

export interface SamlAssertionInput {
  issuer: string; // IdP entity id
  audience: string; // SP entity id
  recipient: string; // SP ACS URL
  inResponseTo?: string; // AuthnRequest id
  subjectNameId: string; // typically email
  subjectFormat?: string; // default emailAddress
  notBefore: Date;
  notOnOrAfter: Date;
  sessionIndex?: string;
  attributes?: Record<string, string | string[]>;
  authnContextClassRef?: string;
}

export interface SamlResponseInput extends SamlAssertionInput {
  destination: string; // ACS URL (matches recipient)
  issueInstant?: Date;
  responseId?: string;
  assertionId?: string;
}

export interface ParsedAuthnRequest {
  id: string;
  issuer: string | null;
  acsUrl: string | null;
  destination: string | null;
  issueInstant: string | null;
}

// ---------- Helpers ----------

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function isoZ(d: Date): string {
  return new Date(d.getTime()).toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function newSamlId(prefix = "_"): string {
  // SAML IDs must start with a non-digit per xs:ID → use leading underscore.
  return prefix + randomBytes(16).toString("hex");
}

function pemBodyOnly(pem: string): string {
  return pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
}

// ---------- Metadata ----------

export function buildIdpMetadataXml(opts: {
  entityId: string;
  ssoUrl: string;
  sloUrl?: string;
  certificatePem: string;
  validUntil?: Date;
}): string {
  const certB64 = pemBodyOnly(opts.certificatePem);
  const validUntil = opts.validUntil
    ? ` validUntil="${isoZ(opts.validUntil)}"`
    : "";
  const slo = opts.sloUrl
    ? `    <SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="${xmlEscape(opts.sloUrl)}"/>\n`
    : "";
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${xmlEscape(opts.entityId)}"${validUntil}>\n` +
    `  <IDPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol" WantAuthnRequestsSigned="false">\n` +
    `    <KeyDescriptor use="signing">\n` +
    `      <KeyInfo xmlns="http://www.w3.org/2000/09/xmldsig#">\n` +
    `        <X509Data><X509Certificate>${certB64}</X509Certificate></X509Data>\n` +
    `      </KeyInfo>\n` +
    `    </KeyDescriptor>\n` +
    `    <NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</NameIDFormat>\n` +
    `    <SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="${xmlEscape(opts.ssoUrl)}"/>\n` +
    `    <SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${xmlEscape(opts.ssoUrl)}"/>\n` +
    slo +
    `  </IDPSSODescriptor>\n` +
    `</EntityDescriptor>\n`
  );
}

// ---------- AuthnRequest parsing (minimal) ----------

const ATTR_RE = (name: string) => new RegExp(`${name}\\s*=\\s*"([^"]*)"`);

export function parseAuthnRequest(xml: string): ParsedAuthnRequest {
  const tagMatch = xml.match(/<(?:[a-zA-Z0-9]+:)?AuthnRequest\b([^>]*)>/);
  if (!tagMatch) throw new Error("Not a SAML AuthnRequest");
  const attrs = tagMatch[1] ?? "";
  const id = attrs.match(ATTR_RE("ID"))?.[1] ?? null;
  if (!id) throw new Error("AuthnRequest missing ID");
  const acsUrl = attrs.match(ATTR_RE("AssertionConsumerServiceURL"))?.[1] ?? null;
  const destination = attrs.match(ATTR_RE("Destination"))?.[1] ?? null;
  const issueInstant = attrs.match(ATTR_RE("IssueInstant"))?.[1] ?? null;
  const issuer = xml.match(/<(?:[a-zA-Z0-9]+:)?Issuer[^>]*>([^<]+)</)?.[1] ?? null;
  return { id, issuer, acsUrl, destination, issueInstant };
}

// ---------- Assertion / Response builder + signature ----------

function buildAttributeStatement(attrs: Record<string, string | string[]> | undefined): string {
  if (!attrs || Object.keys(attrs).length === 0) return "";
  const items: string[] = [];
  for (const [name, raw] of Object.entries(attrs)) {
    const values = Array.isArray(raw) ? raw : [raw];
    const vXml = values
      .map((v) => `      <saml:AttributeValue xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xs="http://www.w3.org/2001/XMLSchema" xsi:type="xs:string">${xmlEscape(v)}</saml:AttributeValue>`)
      .join("\n");
    items.push(
      `    <saml:Attribute Name="${xmlEscape(name)}" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic">\n${vXml}\n    </saml:Attribute>`,
    );
  }
  return `  <saml:AttributeStatement>\n${items.join("\n")}\n  </saml:AttributeStatement>\n`;
}

function buildAssertionXml(input: SamlAssertionInput, assertionId: string, issueInstant: Date): string {
  const subjFormat = input.subjectFormat ?? "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress";
  const sessionIndex = input.sessionIndex ?? newSamlId("_si");
  const ctx = input.authnContextClassRef ?? "urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport";
  const inResp = input.inResponseTo
    ? ` InResponseTo="${xmlEscape(input.inResponseTo)}"`
    : "";

  return (
    `<saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="${assertionId}" IssueInstant="${isoZ(issueInstant)}" Version="2.0">\n` +
    `  <saml:Issuer>${xmlEscape(input.issuer)}</saml:Issuer>\n` +
    `  <saml:Subject>\n` +
    `    <saml:NameID Format="${xmlEscape(subjFormat)}">${xmlEscape(input.subjectNameId)}</saml:NameID>\n` +
    `    <saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">\n` +
    `      <saml:SubjectConfirmationData NotOnOrAfter="${isoZ(input.notOnOrAfter)}" Recipient="${xmlEscape(input.recipient)}"${inResp}/>\n` +
    `    </saml:SubjectConfirmation>\n` +
    `  </saml:Subject>\n` +
    `  <saml:Conditions NotBefore="${isoZ(input.notBefore)}" NotOnOrAfter="${isoZ(input.notOnOrAfter)}">\n` +
    `    <saml:AudienceRestriction><saml:Audience>${xmlEscape(input.audience)}</saml:Audience></saml:AudienceRestriction>\n` +
    `  </saml:Conditions>\n` +
    `  <saml:AuthnStatement AuthnInstant="${isoZ(issueInstant)}" SessionIndex="${xmlEscape(sessionIndex)}">\n` +
    `    <saml:AuthnContext><saml:AuthnContextClassRef>${xmlEscape(ctx)}</saml:AuthnContextClassRef></saml:AuthnContext>\n` +
    `  </saml:AuthnStatement>\n` +
    buildAttributeStatement(input.attributes) +
    `</saml:Assertion>`
  );
}

/**
 * Build the enveloped XML signature for a referenced element.
 * The element must be canonicalized as-emitted (no whitespace tweaking after).
 * We compute SHA-256 digest over the element bytes verbatim, then RSA-SHA256 sign
 * the SignedInfo block.
 *
 * NOTE: This is a deliberately narrow C14N — it works because we control the
 * generated XML (no inherited namespaces, no funky whitespace). Do NOT use this
 * to sign external XML.
 */
function buildXmlSignature(elementXml: string, referenceId: string, key: SamlIdpKey): string {
  const digest = createHash("sha256").update(elementXml, "utf8").digest("base64");
  const signedInfo =
    `<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">` +
    `<ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>` +
    `<ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>` +
    `<ds:Reference URI="#${referenceId}">` +
    `<ds:Transforms>` +
    `<ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>` +
    `<ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>` +
    `</ds:Transforms>` +
    `<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>` +
    `<ds:DigestValue>${digest}</ds:DigestValue>` +
    `</ds:Reference>` +
    `</ds:SignedInfo>`;

  const signer = createSign("RSA-SHA256");
  signer.update(signedInfo, "utf8");
  const sigB64 = signer.sign(createPrivateKey(key.privateKeyPem)).toString("base64");
  const certB64 = pemBodyOnly(key.certificatePem);

  return (
    `<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">` +
    signedInfo +
    `<ds:SignatureValue>${sigB64}</ds:SignatureValue>` +
    `<ds:KeyInfo><ds:X509Data><ds:X509Certificate>${certB64}</ds:X509Certificate></ds:X509Data></ds:KeyInfo>` +
    `</ds:Signature>`
  );
}

export function buildSignedSamlResponse(input: SamlResponseInput, key: SamlIdpKey): string {
  const issueInstant = input.issueInstant ?? new Date();
  const responseId = input.responseId ?? newSamlId("_r");
  const assertionId = input.assertionId ?? newSamlId("_a");

  const assertionXml = buildAssertionXml(input, assertionId, issueInstant);
  const assertionSig = buildXmlSignature(assertionXml, assertionId, key);
  // Insert signature immediately after <saml:Issuer> per SAML processing rules.
  const signedAssertion = assertionXml.replace(
    /(<saml:Issuer>[^<]+<\/saml:Issuer>\n)/,
    (m) => m + "  " + assertionSig + "\n",
  );

  const inResp = input.inResponseTo
    ? ` InResponseTo="${xmlEscape(input.inResponseTo)}"`
    : "";
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="${responseId}" Version="2.0" IssueInstant="${isoZ(issueInstant)}" Destination="${xmlEscape(input.destination)}"${inResp}>\n` +
    `  <saml:Issuer>${xmlEscape(input.issuer)}</saml:Issuer>\n` +
    `  <samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>\n` +
    `  ${signedAssertion}\n` +
    `</samlp:Response>\n`
  );
}

export function samlPostBindingFormHtml(opts: { acsUrl: string; samlResponseXml: string; relayState?: string }): string {
  const b64 = Buffer.from(opts.samlResponseXml, "utf8").toString("base64");
  const relay = opts.relayState
    ? `<input type="hidden" name="RelayState" value="${xmlEscape(opts.relayState)}"/>`
    : "";
  return (
    `<!doctype html>\n<html><body onload="document.forms[0].submit()">\n` +
    `<form method="post" action="${xmlEscape(opts.acsUrl)}">\n` +
    `<input type="hidden" name="SAMLResponse" value="${b64}"/>\n` +
    relay +
    `\n<noscript><button type="submit">Continue</button></noscript>\n` +
    `</form></body></html>`
  );
}

// ---------- Verify (used by tests; SP-side helper) ----------

/**
 * Verify the enveloped signature on an assertion produced by `buildSignedSamlResponse`.
 * Returns true when the digest + RSA verification both pass.
 *
 * This is intentionally narrow — it expects the exact element/structure produced
 * by this module. It is used by our own tests and by integrators who want to
 * sanity-check generated responses; do not use it as a general SAML verifier.
 */
export function verifyAssertionSignature(responseXml: string, certificatePem: string): boolean {
  // Pull <saml:Assertion ...> ... </saml:Assertion> as a substring.
  const m = responseXml.match(/<saml:Assertion\b[\s\S]*?<\/saml:Assertion>/);
  if (!m) return false;
  const assertion = m[0];

  // Reconstruct the pre-signature element by removing the exact "  <ds:Signature...>\n"
  // block we inserted right after the Issuer.
  const insertionRe = /  <ds:Signature[\s\S]*?<\/ds:Signature>\n/;
  const sigInsertion = assertion.match(insertionRe);
  if (!sigInsertion) return false;
  const stripped = assertion.replace(insertionRe, "");

  // Recompute digest over the stripped element exactly as it was when signed.
  const expectedDigest = createHash("sha256").update(stripped, "utf8").digest("base64");
  const sigBlock = sigInsertion[0];
  const digestMatch = sigBlock.match(/<ds:DigestValue>([^<]+)<\/ds:DigestValue>/);
  if (!digestMatch || digestMatch[1] !== expectedDigest) return false;

  const sigInfoMatch = sigBlock.match(/<ds:SignedInfo[\s\S]*?<\/ds:SignedInfo>/);
  const sigValMatch = sigBlock.match(/<ds:SignatureValue>([^<]+)<\/ds:SignatureValue>/);
  if (!sigInfoMatch || !sigValMatch) return false;
  const signedInfo = sigInfoMatch[0];
  const sigBytes = Buffer.from(sigValMatch[1]!, "base64");

  const v = createVerify("RSA-SHA256");
  v.update(signedInfo, "utf8");
  return v.verify(createPublicKey(certificatePem), sigBytes);
}
