"use client";

import * as React from "react";
import { Input } from "@/components/ui/primitives";

const fmt = (v: number | null | undefined) => (v == null || Number.isNaN(v) ? "" : v.toLocaleString("en-US", { maximumFractionDigits: 2 }));

/**
 * Currency field with the same look as the shared CurrencyInput. Unlike it, focusing does not
 * rewrite the displayed text, so select-all-and-type (and automated `fill()`) always replaces
 * the value instead of appending to it. Formatting is re-applied on blur.
 */
export function MoneyInput({
  id,
  value,
  onChange,
  onBlur,
  invalid,
  currency = "LKR",
  ...rest
}: {
  id?: string;
  value: number | null | undefined;
  onChange: (value: number) => void;
  onBlur?: () => void;
  invalid?: boolean;
  currency?: string;
} & Omit<React.ComponentProps<"input">, "value" | "onChange" | "onBlur" | "type">) {
  const [text, setText] = React.useState(fmt(value));
  const focused = React.useRef(false);
  React.useEffect(() => {
    if (!focused.current) setText(fmt(value));
  }, [value]);
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xs font-medium text-muted-foreground">{currency}</span>
      <Input
        {...rest}
        id={id}
        inputMode="decimal"
        aria-invalid={invalid || undefined}
        className="pl-12 text-right tabular"
        value={text}
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false;
          setText(fmt(value));
          onBlur?.();
        }}
        onChange={(e) => {
          const t = e.target.value;
          setText(t);
          const raw = t.replace(/[^0-9.]/g, "");
          onChange(raw === "" ? 0 : Number(raw));
        }}
      />
    </div>
  );
}
