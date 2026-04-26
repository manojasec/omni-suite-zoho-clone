"use client";

import { useState } from "react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { generatePassword, estimateStrength } from "@/modules/vault/schemas";

export function SecretField({
  name = "secret",
  defaultValue = "",
  optional = false,
  label = "Secret",
}: {
  name?: string;
  defaultValue?: string;
  optional?: boolean;
  label?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [show, setShow] = useState(false);
  const strength = estimateStrength(value);
  const labels = ["Very weak", "Weak", "Fair", "Strong", "Very strong"];
  const colors = ["bg-red-400", "bg-orange-400", "bg-amber-400", "bg-lime-500", "bg-emerald-500"];

  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}{optional ? " (leave blank to keep)" : ""}</Label>
      <div className="flex gap-2">
        <Input
          id={name}
          name={name}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={2000}
          autoComplete="new-password"
          required={!optional}
        />
        <Button type="button" variant="outline" size="sm" onClick={() => setShow((v) => !v)}>
          {show ? "Hide" : "Show"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setValue(generatePassword(20))}>
          Generate
        </Button>
      </div>
      {value ? (
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded bg-muted">
            <div
              className={`h-full ${colors[strength.score]} transition-all`}
              style={{ width: `${(strength.score + 1) * 20}%` }}
            />
          </div>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{labels[strength.score]}</span>
        </div>
      ) : null}
    </div>
  );
}
