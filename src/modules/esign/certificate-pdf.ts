import { PdfDoc } from "@/platform/pdf";
import type { AuditCertificate } from "@/modules/esign/engine";

/**
 * Render the eSign audit certificate as a single-page (multi-page if many events)
 * PDF using the in-house zero-dep `PdfDoc` writer.
 */
export function renderEsignCertificatePdf(cert: AuditCertificate): Buffer {
  const doc = new PdfDoc({ size: "Letter" });
  const [pageWidth, pageHeight] = doc.pageSize();
  const margin = 50;
  const right = pageWidth - margin;
  const bottom = margin + 40;
  let y = pageHeight - margin;

  function ensureRoom(needed: number): void {
    if (y - needed < bottom) {
      doc.addPage();
      y = pageHeight - margin;
    }
  }

  function heading(text: string, size = 18): void {
    ensureRoom(size + 6);
    doc.text(text, { x: margin, y: y - size, size, font: "Helvetica-Bold" });
    y -= size + 6;
  }

  function row(label: string, value: string): void {
    ensureRoom(16);
    doc.text(label, { x: margin, y: y - 11, size: 10, font: "Helvetica-Bold" });
    doc.text(value, { x: margin + 130, y: y - 11, size: 10 });
    y -= 16;
  }

  function rule(): void {
    ensureRoom(10);
    doc.line(margin, y - 4, right, y - 4);
    y -= 10;
  }

  heading("Signature Certificate");
  rule();
  row("Envelope ID:", cert.envelopeId);
  row("Title:", cert.title);
  row("Status:", cert.status);
  row("Document SHA-256:", cert.documentSha256 ?? "(not recorded)");
  row("Audit chain:", cert.chainValid ? "valid" : "BROKEN");
  rule();

  heading("Signers", 13);
  for (const s of cert.signers) {
    ensureRoom(48);
    doc.text(`${s.name} <${s.email}>`, { x: margin, y: y - 11, size: 10, font: "Helvetica-Bold" });
    y -= 14;
    doc.text(`Status: ${s.status}`, { x: margin, y: y - 10, size: 9 });
    y -= 12;
    doc.text(
      `Signed at: ${s.signedAt ? s.signedAt.toISOString() : "—"}    IP: ${s.signedIp ?? "—"}`,
      { x: margin, y: y - 10, size: 9 },
    );
    y -= 12;
    if (s.signatureName) {
      doc.text(`Typed name: ${s.signatureName}`, { x: margin, y: y - 10, size: 9 });
      y -= 12;
    }
    y -= 4;
  }
  rule();

  heading("Audit trail", 13);
  for (const e of cert.events) {
    ensureRoom(20);
    doc.text(
      `${e.createdAt.toISOString()}  ${e.type}  ip=${e.ip ?? "—"}`,
      { x: margin, y: y - 9, size: 9, font: "Courier" },
    );
    y -= 12;
    doc.text(`hash=${e.hash}`, { x: margin, y: y - 9, size: 8, font: "Courier", color: [0.4, 0.4, 0.4] });
    y -= 14;
  }

  return doc.toBuffer();
}
