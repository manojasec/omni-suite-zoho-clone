"use client";

import { useState, useTransition, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { createProductAction } from "./actions";

export function ProductCreateForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={(fd) =>
        start(async () => {
          const res = await createProductAction(fd);
          if (res && "error" in res && res.error) setError(res.error);
          else {
            setError(null);
            formRef.current?.reset();
          }
        })
      }
      className="grid gap-3 md:grid-cols-5"
    >
      <div className="md:col-span-2 flex flex-col gap-1">
        <Label htmlFor="name">Name *</Label>
        <Input id="name" name="name" required placeholder="Pro plan – monthly" />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="sku">SKU</Label>
        <Input id="sku" name="sku" />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="price">Price</Label>
        <Input id="price" name="price" type="number" step="0.01" defaultValue="0" />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="taxPercent">Tax %</Label>
        <Input id="taxPercent" name="taxPercent" type="number" step="0.01" defaultValue="0" />
      </div>
      {error ? <p className="md:col-span-5 text-sm text-destructive">{error}</p> : null}
      <div className="md:col-span-5 flex justify-end">
        <Button type="submit" disabled={pending}>
          <Plus className="h-4 w-4" /> {pending ? "Adding…" : "Add product"}
        </Button>
      </div>
    </form>
  );
}
