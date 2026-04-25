"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { recordPaymentAction, setInvoiceStatusAction } from "./actions";

export function InvoiceActions({
  invoiceId,
  status,
  balance,
  currency,
}: {
  invoiceId: string;
  status: "DRAFT" | "SENT" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "VOID";
  balance: string;
  currency: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showPay, setShowPay] = useState(false);

  const setStatus = (target: typeof status) => {
    start(async () => {
      const fd = new FormData();
      fd.set("status", target);
      const res = await setInvoiceStatusAction(invoiceId, fd);
      if (res && "error" in res && res.error) setError(res.error);
      else setError(null);
    });
  };

  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        <div>
          <p className="text-xs text-muted-foreground">Balance due</p>
          <p className="text-xl font-semibold tabular-nums">
            {Number(balance).toLocaleString()} {currency}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {status === "DRAFT" ? (
            <Button size="sm" onClick={() => setStatus("SENT")} disabled={pending}>
              Send
            </Button>
          ) : null}
          {status !== "PAID" && status !== "VOID" ? (
            <Button size="sm" variant="outline" onClick={() => setShowPay((s) => !s)} disabled={pending}>
              Record payment
            </Button>
          ) : null}
          {status !== "VOID" && status !== "PAID" ? (
            <Button size="sm" variant="ghost" onClick={() => setStatus("VOID")} disabled={pending}>
              Void
            </Button>
          ) : null}
          {status === "VOID" ? (
            <Button size="sm" variant="outline" onClick={() => setStatus("DRAFT")} disabled={pending}>
              Reopen
            </Button>
          ) : null}
        </div>

        {showPay ? (
          <form
            action={(fd) =>
              start(async () => {
                const res = await recordPaymentAction(invoiceId, fd);
                if (res && "error" in res && res.error) setError(res.error);
                else {
                  setError(null);
                  setShowPay(false);
                }
              })
            }
            className="space-y-2 border-t pt-3"
          >
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="amount">Amount *</Label>
                <Input id="amount" name="amount" type="number" step="0.01" defaultValue={balance} required />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="method">Method *</Label>
                <Input id="method" name="method" defaultValue="bank_transfer" required />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="paidAt">Paid at</Label>
                <Input
                  id="paidAt"
                  name="paidAt"
                  type="date"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="reference">Reference</Label>
                <Input id="reference" name="reference" placeholder="Txn ID" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" type="button" variant="ghost" onClick={() => setShowPay(false)}>
                Cancel
              </Button>
              <Button size="sm" type="submit" disabled={pending}>
                {pending ? "Saving…" : "Record payment"}
              </Button>
            </div>
          </form>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
