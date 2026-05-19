import { describe, it, expect } from "vitest";
import { renderEsignCertificatePdf } from "@/modules/esign/certificate-pdf";
import type { AuditCertificate } from "@/modules/esign/engine";

const sampleCert: AuditCertificate = {
  envelopeId: "env_demo",
  title: "Mutual NDA",
  status: "COMPLETED",
  documentSha256: "0123456789abcdef",
  chainValid: true,
  signers: [
    {
      name: "Alice Liddell",
      email: "alice@example.com",
      status: "SIGNED",
      signedAt: new Date("2026-05-01T10:00:00Z"),
      signedIp: "1.2.3.4",
      signatureName: "Alice Liddell",
    },
    {
      name: "Bob Builder",
      email: "bob@example.com",
      status: "SIGNED",
      signedAt: new Date("2026-05-01T10:05:00Z"),
      signedIp: "5.6.7.8",
      signatureName: "Bob Builder",
    },
  ],
  events: Array.from({ length: 12 }, (_, i) => ({
    type: "SIGNER_SIGNED" as const,
    createdAt: new Date(Date.UTC(2026, 4, 1, 10, i, 0)),
    ip: "1.2.3.4",
    hash: `hash${i.toString(16).padStart(60, "0")}`,
  })),
};

describe("esign certificate PDF", () => {
  it("renders a valid PDF buffer", () => {
    const buf = renderEsignCertificatePdf(sampleCert);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(500);
    const header = buf.subarray(0, 5).toString("ascii");
    expect(header).toBe("%PDF-");
    const tail = buf.subarray(buf.length - 6).toString("ascii");
    expect(tail).toMatch(/%%EOF/);
  });

  it("paginates when audit trail is long", () => {
    const big: AuditCertificate = {
      ...sampleCert,
      events: Array.from({ length: 200 }, (_, i) => ({
        type: "SIGNER_VIEWED" as const,
        createdAt: new Date(Date.UTC(2026, 4, 1, 10, 0, i)),
        ip: "1.1.1.1",
        hash: `h${i}`,
      })),
    };
    const buf = renderEsignCertificatePdf(big);
    expect(buf.toString("latin1")).toMatch(/\/Type \/Pages/);
    // We expect at least two /Type /Page (page) markers (multi-page).
    const pageCount = (buf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length;
    expect(pageCount).toBeGreaterThanOrEqual(2);
  });
});
