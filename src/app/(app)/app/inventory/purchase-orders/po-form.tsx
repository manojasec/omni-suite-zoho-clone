"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { createPurchaseOrderAction } from "./actions";

type Supplier = { id: string; name: string };
type Item = { id: string; name: string; sku: string; costPrice: number };
type Warehouse = { id: string; name: string };

type Line = {
  itemId: string;
  warehouseId: string;
  description: string;
  qtyOrdered: number;
  unitCost: number;
  taxPercent: number;
};

function emptyLine(items: Item[], warehouses: Warehouse[]): Line {
  return {
    itemId: items[0]?.id ?? "",
    warehouseId: warehouses[0]?.id ?? "",
    description: items[0]?.name ?? "",
    qtyOrdered: 1,
    unitCost: items[0]?.costPrice ?? 0,
    taxPercent: 0,
  };
}

export default function PurchaseOrderForm({
  suppliers,
  items,
  warehouses,
}: {
  suppliers: Supplier[];
  items: Item[];
  warehouses: Warehouse[];
}) {
  const [lines, setLines] = useState<Line[]>(() => [emptyLine(items, warehouses)]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const totals = useMemo(() => {
    let subtotal = 0;
    let tax = 0;
    for (const l of lines) {
      const s = (Number(l.qtyOrdered) || 0) * (Number(l.unitCost) || 0);
      subtotal += s;
      tax += s * ((Number(l.taxPercent) || 0) / 100);
    }
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      total: Math.round((subtotal + tax) * 100) / 100,
    };
  }, [lines]);

  function update(idx: number, patch: Partial<Line>) {
    setLines((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      // Auto-fill cost & description on item change
      if (patch.itemId) {
        const it = itemMap.get(patch.itemId);
        if (it) {
          next[idx].description = next[idx].description || it.name;
          next[idx].unitCost = it.costPrice;
        }
      }
      return next;
    });
  }

  function add() {
    setLines((prev) => [...prev, emptyLine(items, warehouses)]);
  }
  function remove(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  async function onSubmit(fd: FormData) {
    setError(null);
    lines.forEach((l, i) => {
      fd.set(`line[${i}][itemId]`, l.itemId);
      fd.set(`line[${i}][warehouseId]`, l.warehouseId);
      fd.set(`line[${i}][description]`, l.description);
      fd.set(`line[${i}][qtyOrdered]`, String(l.qtyOrdered));
      fd.set(`line[${i}][unitCost]`, String(l.unitCost));
      fd.set(`line[${i}][taxPercent]`, String(l.taxPercent));
    });
    startTransition(async () => {
      const res = await createPurchaseOrderAction(fd);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <Label htmlFor="supplierId">Supplier *</Label>
          <Select id="supplierId" name="supplierId" required>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="orderDate">Order date</Label>
          <Input id="orderDate" name="orderDate" type="date" required
            defaultValue={new Date().toISOString().slice(0, 10)} />
        </div>
        <div>
          <Label htmlFor="expectedDate">Expected date</Label>
          <Input id="expectedDate" name="expectedDate" type="date" />
        </div>
        <div>
          <Label htmlFor="currency">Currency</Label>
          <Input id="currency" name="currency" defaultValue="USD" maxLength={3} />
        </div>
        <div className="md:col-span-3">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" name="notes" rows={2} />
        </div>
      </div>

      <div className="rounded border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-2 py-2 text-left">Item</th>
              <th className="px-2 py-2 text-left">Warehouse</th>
              <th className="px-2 py-2 text-left">Description</th>
              <th className="px-2 py-2 text-right w-20">Qty</th>
              <th className="px-2 py-2 text-right w-28">Unit cost</th>
              <th className="px-2 py-2 text-right w-20">Tax %</th>
              <th className="px-2 py-2 text-right w-28">Amount</th>
              <th className="px-2 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const amt = (Number(l.qtyOrdered) || 0) * (Number(l.unitCost) || 0) *
                (1 + (Number(l.taxPercent) || 0) / 100);
              return (
                <tr key={i} className="border-b last:border-b-0">
                  <td className="px-2 py-1.5">
                    <Select value={l.itemId} onChange={(e) => update(i, { itemId: e.target.value })}>
                      {items.map((it) => (
                        <option key={it.id} value={it.id}>{it.name} ({it.sku})</option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-2 py-1.5">
                    <Select value={l.warehouseId} onChange={(e) => update(i, { warehouseId: e.target.value })}>
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-2 py-1.5">
                    <Input value={l.description}
                      onChange={(e) => update(i, { description: e.target.value })} />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input type="number" min={1} value={l.qtyOrdered}
                      onChange={(e) => update(i, { qtyOrdered: Number(e.target.value) })}
                      className="text-right" />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input type="number" min={0} step="0.01" value={l.unitCost}
                      onChange={(e) => update(i, { unitCost: Number(e.target.value) })}
                      className="text-right" />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input type="number" min={0} max={100} step="0.01" value={l.taxPercent}
                      onChange={(e) => update(i, { taxPercent: Number(e.target.value) })}
                      className="text-right" />
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{amt.toFixed(2)}</td>
                  <td className="px-2 py-1.5 text-right">
                    {lines.length > 1 ? (
                      <button type="button" className="text-xs text-muted-foreground hover:text-destructive"
                        onClick={() => remove(i)}>×</button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={8} className="px-2 py-2">
                <Button type="button" size="sm" variant="outline" onClick={add}>+ Add line</Button>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex justify-end">
        <div className="w-64 space-y-1 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{totals.subtotal.toFixed(2)}</span></div>
          <div className="flex justify-between text-muted-foreground"><span>Tax</span><span className="tabular-nums">{totals.tax.toFixed(2)}</span></div>
          <div className="flex justify-between border-t pt-1 font-semibold"><span>Total</span><span className="tabular-nums">{totals.total.toFixed(2)}</span></div>
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Creating…" : "Create purchase order"}
        </Button>
      </div>
    </form>
  );
}
