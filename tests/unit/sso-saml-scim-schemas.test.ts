import { describe, it, expect } from "vitest";
import {
  samlConnectionSchema,
  scimTokenSchema,
} from "@/modules/sso/schemas";

describe("M66 SAML/SCIM schemas", () => {
  it("samlConnectionSchema requires url and certificate", () => {
    const ok = samlConnectionSchema.parse({
      name: "Okta production",
      idpEntityId: "https://idp.example.com/entity",
      idpSsoUrl: "https://idp.example.com/sso",
      idpCertificate: "-----BEGIN CERTIFICATE-----\nABCDEF1234567890ABCDEF1234567890\n-----END CERTIFICATE-----",
      spEntityId: "urn:omnisuite:workspace:demo",
    });
    expect(ok.name).toBe("Okta production");

    expect(() =>
      samlConnectionSchema.parse({
        name: "X",
        idpEntityId: "x",
        idpSsoUrl: "not-a-url",
        idpCertificate: "short",
        spEntityId: "urn:x",
      }),
    ).toThrow();
  });

  it("scimTokenSchema requires a name", () => {
    expect(scimTokenSchema.parse({ name: "Okta SCIM" }).name).toBe("Okta SCIM");
    expect(() => scimTokenSchema.parse({ name: "" })).toThrow();
  });
});
