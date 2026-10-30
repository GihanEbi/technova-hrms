"use client";

// Theme-aware helpers for Recharts. Colours always come from CSS variables,
// so charts switch with the light/dark theme without re-rendering logic.
import * as React from "react";
import { cn } from "@/lib/utils";

export const chartColors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)"];

export const axisProps = {
  tickLine: false,
  axisLine: false,
  tick: { fill: "var(--muted-foreground)", fontSize: 12 },
} as const;

export const gridProps = { stroke: "var(--chart-grid)", strokeDasharray: "3 3", vertical: false } as const;

export const tooltipCursor = { fill: "var(--muted)", opacity: 0.6 };

interface TooltipPayloadItem {
  name?: string | number;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
  payload?: Record<string, unknown> & { fill?: string };
}

/** Custom tooltip for Recharts: <Tooltip content={<ChartTooltip formatter={...} />} /> */
export function ChartTooltip({
  active,
  payload,
  label,
  formatter,
  labelFormatter,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
  formatter?: (value: number, name: string) => string;
  labelFormatter?: (label: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-36 rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg" role="tooltip">
      {label !== undefined && label !== "" && <p className="mb-1.5 font-medium text-foreground">{labelFormatter ? labelFormatter(String(label)) : label}</p>}
      <ul className="space-y-1">
        {payload.map((p, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="size-2 shrink-0 rounded-full" style={{ background: p.color ?? p.payload?.fill }} />
            <span className="flex-1 text-muted-foreground">{p.name}</span>
            <span className="font-medium text-foreground tabular">{formatter ? formatter(Number(p.value), String(p.name)) : p.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ChartLegend({ items, className }: { items: { label: string; color: string; value?: React.ReactNode }[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-x-4 gap-y-1.5 text-xs", className)}>
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5 text-muted-foreground">
          <span className="size-2 rounded-full" style={{ background: i.color }} />
          {i.label}
          {i.value !== undefined && <span className="font-medium text-foreground tabular">{i.value}</span>}
        </li>
      ))}
    </ul>
  );
}

/**
 * Chart entry animations. Disabled under browser automation (Playwright freezes the clock for
 * deterministic screenshots, which would otherwise leave charts half-drawn).
 */
export const chartAnimation = typeof navigator === "undefined" ? false : !navigator.webdriver;
