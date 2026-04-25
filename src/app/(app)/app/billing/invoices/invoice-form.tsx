"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Trash2, Plus } from "lucide-react";

type Customer = { id: string; name: string; currency: string };

export type InvoiceLineItemValues = {
  description?: string;
  qty?: string;
  unitPrice?: string;
  taxPercent?: string;
};

export type InvoiceValues = {
  customerId?: string;
  number?: string | null;
  issueDate?: string;
  dueDate?: string | null;
  currency?: string;
  notes?: string | null;
  lineItems?: InvoiceLineItemValues[];
};

const emptyLine: Required<InvoiceLineItemValues> = {
  description: "",
  qty: "1",
  unitPrice: "0",
  taxPercent: "0",
};

export function InvoiceForm({
  action,
  initial,
  customers,
  submitLabel,
  numberLocked = false,
}: {
  action: (fd: FormData) => Promise<{ error?: string; ok?: boolean } | void>;
  initial?: InvoiceValues;
  customers: Customer[];
  submitLabel: string;
  numberLocked?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [items, setItems] = useState<Required<InvoiceLineItemValues>[]>(
    initial?.lineItems && initial.lineItems.length > 0
      ? initial.lineItems.map((li) => ({ ...emptyLine, ...li })) as Required<InvoiceLineItemValues>[]
      : [{ ...emptyLine }],
  );

  const totals = useMemo(() => {
    let subtotal = 0;
    let tax = 0;
    for (const li of items) {
      const lineSubtotal = Number(li.qty || 0) * Number(li.unitPrice || 0);
      const lineTax = lineSubtotal * (Number(li.taxPercent || 0) / 100);
      subtotal += lineSubtotal;
      tax += lineTax;
    }
    return {
      subtotal: subtotal.toFixed(2),
      tax: tax.toFixed(2),
      total: (subtotal + tax).toFixed(2),
    };
  }, [items]);

  const updateItem = (i: number, patch: Partial<InvoiceLineItemValues>) =>
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const removeItem = (i: number) => setItems((arr) => (arr.length > 1 ? arr.filter((_, idx) => idx !== i) : arr));
  const addItem = () => setItems((arr) => [...arr, { ...emptyLine }]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Card>
      <CardContent className="pt-6">
        <form
          action={(fd) =>
            start(async () => {
              const res = await action(fd);
              if (res && "error" in res && res.error) setError(res.error);
              else setError(null);
            })
          }
          className="space-y-6"
        >
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="customerId">Customer *</Label>
              <select
                id="customerId"
                name="customerId"
                defaultValue={initial?.customerId ?? ""}
                required
                className="h-9 rounded-md border bg-background px-3 text-sm"
              >
                <option value="" disabled>Select customer…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="number">Invoice number</Label>
              <Input
                id="number"
                name="number"
                defaultValue={initial?.number ?? ""}
                placeholder="Auto"
                disabled={numberLocked}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" name="currency" defaultValue={initial?.currency ?? "USD"} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="issueDate">Issue date</Label>
              <Input
                id="issueDate"
                name="issueDate"
                type="date"
                defaultValue={initial?.issueDate ? initial.issueDate.slice(0, 10) : today}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="dueDate">Due date</Label>
              <Input
                id="dueDate"
                name="dueDate"
                type="date"
                defaultValue={initial?.dueDate ? initial.dueDate.slice(0, 10) : ""}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Line items</Label>
              <Button type="button" size="sm" variant="outline" onClick={addItem}>
                <Plus className="h-3 w-3" /> Add line
              </Button>
            </div>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 text-left">Description</th>
                    <th className="px-2 py-2 text-right w-20">Qty</th>
                    <th className="px-2 py-2 text-right w-28">Unit price</th>
                    <th className="px-2 py-2 text-right w-20">Tax %</th>
                    <th className="px-2 py-2 text-right w-28">Line total</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((li, i) => {
                    const subtotal = Number(li.qty || 0) * Number(li.unitPrice || 0);
                    const lineTotal = subtotal + subtotal * (Number(li.taxPercent || 0) / 100);
                    return (
                      <tr key={i} className="border-t">
                        <td className="p-1">
                          <Input
                            name="li_description"
                            value={li.description}
                            onChange={(e) => updateItem(i, { description: e.target.value })}
                            placeholder="Description"
                          />
                        </td>
                        <td className="p-1">
                          <Input
                            name="li_qty"
                            type="number"
                            step="0.01"
                            value={li.qty}
                            onChange={(e) => updateItem(i, { qty: e.target.value })}
                            className="text-right"
                          />
                        </td>
                        <td className="p-1">
                          <Input
                            name="li_unitPrice"
                            type="number"
                            step="0.01"
                            value={li.unitPrice}
                            onChange={(e) => updateItem(i, { unitPrice: e.target.value })}
                            className="text-right"
                          />
                        </td>
                        <td className="p-1">
                          <Input
                            name="li_taxPercent"
                            type="number"
                            step="0.01"
                            value={li.taxPercent}
                            onChange={(e) => updateItem(i, { taxPercent: e.target.value })}
                            className="text-right"
                          />
                        </td>
                        <td className="p-1 text-right tabular-nums">{lineTotal.toFixed(2)}</td>
                        <td className="p-1 text-right">
                          <button
                            type="button"
                            onClick={() => removeItem(i)}
                            className="rounded p-1 text-muted-foreground hover:bg-accent"
                            aria-label="Remove line"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-muted/30 text-sm">
                  <tr>
                    <td colSpan={4} className="px-2 py-2 text-right font-medium">Subtotal</td>
                    <td className="px-2 py-2 text-right tabular-nums">{totals.subtotal}</td>
                    <td></td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="px-2 py-2 text-right font-medium">Tax</td>
                    <td className="px-2 py-2 text-right tabular-nums">{totals.tax}</td>
                    <td></td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="px-2 py-2 text-right font-semibold">Total</td>
                    <td className="px-2 py-2 text-right font-semibold tabular-nums">{totals.total}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={3} defaultValue={initial?.notes ?? ""} />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : submitLabel}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
