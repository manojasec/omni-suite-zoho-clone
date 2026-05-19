/**
 * Zero-dependency PDF generator. Produces a valid PDF 1.4 document with
 * Helvetica text + simple lines. Designed for invoice/quote/receipt output;
 * not a general typesetting system.
 *
 * Coordinate system: PDF origin is bottom-left in points (1pt = 1/72 inch).
 * Helvetica is one of the 14 "standard" fonts every PDF reader ships, so we
 * don't have to embed font files.
 *
 * Public API:
 *   const pdf = new PdfDoc({ size: "A4" });
 *   pdf.text("Hello", { x: 50, y: 800, size: 18, font: "Helvetica-Bold" });
 *   pdf.line(50, 750, 545, 750);
 *   pdf.rect(50, 600, 200, 30, { fill: true, color: [0.95, 0.95, 0.95] });
 *   const bytes = pdf.toBuffer();
 *
 * Multiple pages: call `pdf.addPage()` between drawing calls.
 */

export type PdfFont =
  | "Helvetica"
  | "Helvetica-Bold"
  | "Helvetica-Oblique"
  | "Times-Roman"
  | "Courier";

export type PageSize = "A4" | "Letter";

const PAGE_SIZES: Record<PageSize, [number, number]> = {
  A4: [595.28, 841.89],
  Letter: [612, 792],
};

type TextOpts = {
  x: number;
  y: number;
  size?: number;
  font?: PdfFont;
  color?: [number, number, number]; // rgb 0..1
};

type RectOpts = {
  fill?: boolean;
  stroke?: boolean;
  color?: [number, number, number];
};

export class PdfDoc {
  private pages: string[] = []; // each page = content stream string
  private currentPage = 0;
  private fonts = new Set<PdfFont>(["Helvetica"]);
  private size: [number, number];

  constructor(opts: { size?: PageSize } = {}) {
    this.size = PAGE_SIZES[opts.size ?? "A4"];
    this.pages.push("");
  }

  /** Add a new page and switch drawing context to it. */
  addPage(): void {
    this.pages.push("");
    this.currentPage = this.pages.length - 1;
  }

  pageSize(): [number, number] {
    return [this.size[0], this.size[1]];
  }

  text(value: string, opts: TextOpts): void {
    const size = opts.size ?? 11;
    const font = opts.font ?? "Helvetica";
    this.fonts.add(font);
    const fontKey = `F${[...this.fonts].indexOf(font) + 1}`;
    const color = opts.color ?? [0, 0, 0];
    const escaped = escapePdfString(value);
    this.append(
      [
        `q`,
        `${color[0]} ${color[1]} ${color[2]} rg`,
        `BT`,
        `/${fontKey} ${size} Tf`,
        `${opts.x} ${opts.y} Td`,
        `(${escaped}) Tj`,
        `ET`,
        `Q`,
      ].join("\n"),
    );
  }

  line(x1: number, y1: number, x2: number, y2: number, color: [number, number, number] = [0.6, 0.6, 0.6]): void {
    this.append(
      [
        `q`,
        `${color[0]} ${color[1]} ${color[2]} RG`,
        `${x1} ${y1} m`,
        `${x2} ${y2} l`,
        `S`,
        `Q`,
      ].join("\n"),
    );
  }

  rect(x: number, y: number, w: number, h: number, opts: RectOpts = {}): void {
    const color = opts.color ?? [0, 0, 0];
    const op = opts.fill && opts.stroke ? "B" : opts.fill ? "f" : "S";
    this.append(
      [
        `q`,
        `${color[0]} ${color[1]} ${color[2]} ${opts.fill ? "rg" : "RG"}`,
        `${x} ${y} ${w} ${h} re`,
        op,
        `Q`,
      ].join("\n"),
    );
  }

  /** Serialise the document to a Buffer. */
  toBuffer(): Buffer {
    const fontList = [...this.fonts];
    // Object ids:
    //   1 = Catalog, 2 = Pages, 3..(3+F-1) = Fonts,
    //   then per page: PageObj + ContentStreamObj
    const FONT_BASE = 3;
    const FIRST_PAGE_OBJ = FONT_BASE + fontList.length;
    const pageObjs: number[] = [];
    const contentObjs: number[] = [];
    for (let i = 0; i < this.pages.length; i++) {
      pageObjs.push(FIRST_PAGE_OBJ + i * 2);
      contentObjs.push(FIRST_PAGE_OBJ + i * 2 + 1);
    }

    const objects: { id: number; body: string }[] = [];

    // Catalog
    objects.push({ id: 1, body: `<< /Type /Catalog /Pages 2 0 R >>` });

    // Pages tree
    const kids = pageObjs.map((id) => `${id} 0 R`).join(" ");
    objects.push({
      id: 2,
      body: `<< /Type /Pages /Count ${this.pages.length} /Kids [${kids}] >>`,
    });

    // Fonts
    fontList.forEach((f, idx) => {
      objects.push({
        id: FONT_BASE + idx,
        body: `<< /Type /Font /Subtype /Type1 /BaseFont /${f} /Encoding /WinAnsiEncoding >>`,
      });
    });

    // Pages + content streams
    const fontResources = fontList
      .map((_, idx) => `/F${idx + 1} ${FONT_BASE + idx} 0 R`)
      .join(" ");
    for (let i = 0; i < this.pages.length; i++) {
      const pageId = pageObjs[i];
      const contentId = contentObjs[i];
      objects.push({
        id: pageId,
        body:
          `<< /Type /Page /Parent 2 0 R ` +
          `/MediaBox [0 0 ${this.size[0]} ${this.size[1]}] ` +
          `/Resources << /Font << ${fontResources} >> >> ` +
          `/Contents ${contentId} 0 R >>`,
      });
      const stream = this.pages[i] || " ";
      objects.push({
        id: contentId,
        body: `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`,
      });
    }

    // Assemble file with xref.
    const headerStr = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
    const parts: Buffer[] = [Buffer.from(headerStr, "latin1")];
    let offset = parts[0].length;
    const offsets: number[] = [];
    objects.sort((a, b) => a.id - b.id);
    for (const o of objects) {
      offsets[o.id] = offset;
      const bytes = Buffer.from(`${o.id} 0 obj\n${o.body}\nendobj\n`, "latin1");
      parts.push(bytes);
      offset += bytes.length;
    }
    const xrefOffset = offset;
    let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (let id = 1; id <= objects.length; id++) {
      xref += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
    }
    xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
    parts.push(Buffer.from(xref, "latin1"));
    return Buffer.concat(parts);
  }

  private append(s: string): void {
    this.pages[this.currentPage] += (this.pages[this.currentPage] ? "\n" : "") + s;
  }
}

function escapePdfString(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\r?\n/g, " ");
}

// ---------------- Higher-level: invoice template ----------------

export type InvoicePdfInput = {
  workspaceName: string;
  invoiceNumber: string;
  status: string;
  issuedAt: Date;
  dueAt?: Date | null;
  customer: {
    name: string;
    email?: string | null;
    address?: string | null;
  };
  currency: string;
  lines: { description: string; quantity: number; unitPrice: number; total: number }[];
  subtotal: number;
  tax: number;
  total: number;
  notes?: string | null;
};

/**
 * Render an invoice as a single-page PDF.
 *
 * Money is rendered as plain numbers with the currency code (no symbol
 * lookup) — keeps the renderer locale-free.
 */
export function renderInvoicePdf(input: InvoicePdfInput): Buffer {
  const pdf = new PdfDoc({ size: "A4" });
  const [W] = pdf.pageSize();
  const margin = 50;
  let y = 800;

  pdf.text(input.workspaceName, { x: margin, y, size: 20, font: "Helvetica-Bold" });
  pdf.text(`INVOICE ${input.invoiceNumber}`, {
    x: W - margin - 200,
    y,
    size: 14,
    font: "Helvetica-Bold",
    color: [0.1, 0.1, 0.1],
  });
  y -= 30;
  pdf.text(`Status: ${input.status}`, { x: W - margin - 200, y, size: 10 });
  y -= 14;
  pdf.text(`Issued: ${fmtDate(input.issuedAt)}`, { x: W - margin - 200, y, size: 10 });
  if (input.dueAt) {
    y -= 12;
    pdf.text(`Due: ${fmtDate(input.dueAt)}`, { x: W - margin - 200, y, size: 10 });
  }

  // Bill-to box.
  y = 720;
  pdf.text("Bill to", { x: margin, y, size: 10, color: [0.4, 0.4, 0.4] });
  y -= 14;
  pdf.text(input.customer.name, { x: margin, y, size: 12, font: "Helvetica-Bold" });
  if (input.customer.email) {
    y -= 13;
    pdf.text(input.customer.email, { x: margin, y, size: 10 });
  }
  if (input.customer.address) {
    y -= 13;
    pdf.text(input.customer.address, { x: margin, y, size: 10 });
  }

  // Line-items table.
  let row = 640;
  pdf.rect(margin, row, W - margin * 2, 22, { fill: true, color: [0.95, 0.95, 0.95] });
  pdf.text("Description", { x: margin + 6, y: row + 7, size: 10, font: "Helvetica-Bold" });
  pdf.text("Qty", { x: margin + 280, y: row + 7, size: 10, font: "Helvetica-Bold" });
  pdf.text("Unit", { x: margin + 340, y: row + 7, size: 10, font: "Helvetica-Bold" });
  pdf.text("Total", { x: margin + 430, y: row + 7, size: 10, font: "Helvetica-Bold" });

  row -= 18;
  for (const ln of input.lines) {
    if (row < 120) {
      pdf.addPage();
      row = 800;
    }
    pdf.text(truncate(ln.description, 60), { x: margin + 6, y: row, size: 10 });
    pdf.text(String(ln.quantity), { x: margin + 280, y: row, size: 10 });
    pdf.text(fmtMoney(ln.unitPrice, input.currency), { x: margin + 340, y: row, size: 10 });
    pdf.text(fmtMoney(ln.total, input.currency), { x: margin + 430, y: row, size: 10 });
    row -= 16;
  }

  row -= 8;
  pdf.line(margin + 280, row + 14, W - margin, row + 14);
  pdf.text("Subtotal", { x: margin + 340, y: row, size: 10 });
  pdf.text(fmtMoney(input.subtotal, input.currency), { x: margin + 430, y: row, size: 10 });
  row -= 14;
  pdf.text("Tax", { x: margin + 340, y: row, size: 10 });
  pdf.text(fmtMoney(input.tax, input.currency), { x: margin + 430, y: row, size: 10 });
  row -= 16;
  pdf.text("TOTAL", { x: margin + 340, y: row, size: 12, font: "Helvetica-Bold" });
  pdf.text(fmtMoney(input.total, input.currency), {
    x: margin + 430,
    y: row,
    size: 12,
    font: "Helvetica-Bold",
  });

  if (input.notes) {
    row -= 40;
    pdf.text("Notes", { x: margin, y: row, size: 10, color: [0.4, 0.4, 0.4] });
    row -= 14;
    pdf.text(truncate(input.notes, 120), { x: margin, y: row, size: 10 });
  }

  return pdf.toBuffer();
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function fmtMoney(amount: number, currency: string): string {
  return `${amount.toFixed(2)} ${currency}`;
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}
