import { describe, it, expect } from "vitest";
import { PdfDoc, renderInvoicePdf } from "@/platform/pdf";

describe("PdfDoc", () => {
  it("emits a valid PDF 1.4 header and EOF marker", () => {
    const pdf = new PdfDoc();
    pdf.text("Hello", { x: 50, y: 800 });
    const buf = pdf.toBuffer();
    const ascii = buf.toString("latin1");
    expect(ascii.startsWith("%PDF-1.4")).toBe(true);
    expect(ascii.trimEnd().endsWith("%%EOF")).toBe(true);
  });

  it("contains an xref table and trailer with /Root", () => {
    const pdf = new PdfDoc();
    pdf.text("Hi", { x: 50, y: 800 });
    const ascii = pdf.toBuffer().toString("latin1");
    expect(ascii).toMatch(/\nxref\n/);
    expect(ascii).toMatch(/\ntrailer\n/);
    expect(ascii).toContain("/Root 1 0 R");
    expect(ascii).toMatch(/\nstartxref\n\d+\n/);
  });

  it("escapes parentheses in text strings", () => {
    const pdf = new PdfDoc();
    pdf.text("Hello (world)", { x: 50, y: 800 });
    const ascii = pdf.toBuffer().toString("latin1");
    expect(ascii).toContain("Hello \\(world\\)");
  });

  it("supports multiple pages", () => {
    const pdf = new PdfDoc();
    pdf.text("Page 1", { x: 50, y: 800 });
    pdf.addPage();
    pdf.text("Page 2", { x: 50, y: 800 });
    const ascii = pdf.toBuffer().toString("latin1");
    expect(ascii).toContain("/Count 2");
    expect(ascii).toContain("Page 1");
    expect(ascii).toContain("Page 2");
  });

  it("registers a font when used", () => {
    const pdf = new PdfDoc();
    pdf.text("Bold", { x: 50, y: 800, font: "Helvetica-Bold" });
    const ascii = pdf.toBuffer().toString("latin1");
    expect(ascii).toContain("/BaseFont /Helvetica-Bold");
  });
});

describe("renderInvoicePdf", () => {
  it("produces a valid PDF buffer for a complete invoice", () => {
    const buf = renderInvoicePdf({
      workspaceName: "Acme Inc",
      invoiceNumber: "INV-0001",
      status: "SENT",
      issuedAt: new Date("2025-02-01T00:00:00Z"),
      dueAt: new Date("2025-03-01T00:00:00Z"),
      customer: { name: "Initech", email: "ap@initech.com", address: "1 Cubicle Way" },
      currency: "USD",
      lines: [
        { description: "Consulting", quantity: 10, unitPrice: 150, total: 1500 },
        { description: "Hosting", quantity: 1, unitPrice: 50, total: 50 },
      ],
      subtotal: 1550,
      tax: 155,
      total: 1705,
      notes: "Thanks for your business",
    });
    const ascii = buf.toString("latin1");
    expect(ascii.startsWith("%PDF-1.4")).toBe(true);
    expect(ascii).toContain("INVOICE INV-0001");
    expect(ascii).toContain("Initech");
    expect(ascii).toContain("Consulting");
    expect(ascii).toContain("1500.00 USD");
  });

  it("paginates when there are many line items", () => {
    const lines = Array.from({ length: 80 }, (_, i) => ({
      description: `Line ${i + 1}`,
      quantity: 1,
      unitPrice: 1,
      total: 1,
    }));
    const buf = renderInvoicePdf({
      workspaceName: "Acme",
      invoiceNumber: "INV-0002",
      status: "DRAFT",
      issuedAt: new Date(),
      dueAt: null,
      customer: { name: "A", email: null, address: null },
      currency: "USD",
      lines,
      subtotal: 80,
      tax: 0,
      total: 80,
      notes: null,
    });
    const ascii = buf.toString("latin1");
    expect(ascii).toMatch(/\/Count [2-9]/);
  });
});
