import type { LineItemInput } from "./schemas";

export type Totals = {
  subtotal: string;
  tax: string;
  total: string;
};

/** Computes subtotal, tax, and total for a list of line items.
 *  All inputs are decimal strings; outputs are strings rounded to 2dp. */
export function computeTotals(items: LineItemInput[]): Totals {
  let subtotal = 0;
  let tax = 0;
  for (const li of items) {
    const lineSubtotal = Number(li.qty) * Number(li.unitPrice);
    const lineTax = lineSubtotal * (Number(li.taxPercent) / 100);
    subtotal += lineSubtotal;
    tax += lineTax;
  }
  const total = subtotal + tax;
  return {
    subtotal: subtotal.toFixed(2),
    tax: tax.toFixed(2),
    total: total.toFixed(2),
  };
}

export function lineAmount(li: LineItemInput): string {
  const subtotal = Number(li.qty) * Number(li.unitPrice);
  const totalLine = subtotal + subtotal * (Number(li.taxPercent) / 100);
  return totalLine.toFixed(2);
}
