"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PayrollStatus } from "@/types";

const steps = [
  { label: "Select period", hint: "Generate draft" },
  { label: "Review", hint: "Check totals & warnings" },
  { label: "Approve", hint: "Sign-off" },
  { label: "Process", hint: "Publish payslips" },
];

/** Index of the step currently in progress (4 = everything complete). */
export function activeStepIndex(status: PayrollStatus | null) {
  switch (status) {
    case null:
      return 0;
    case "Draft":
      return 1;
    case "Pending Approval":
      return 2;
    case "Approved":
      return 3;
    case "Processed":
      return 4;
  }
}

export function PayrollStepper({ status, compact = false }: { status: PayrollStatus | null; compact?: boolean }) {
  const active = activeStepIndex(status);
  return (
    <ol className="grid grid-cols-4 gap-2" aria-label="Payroll run progress">
      {steps.map((s, i) => {
        const done = i < active;
        const current = i === active;
        return (
          <li key={s.label} className="relative flex min-w-0 flex-col items-center text-center sm:items-start sm:text-left" aria-current={current ? "step" : undefined}>
            <div className="flex w-full items-center">
              <span
                className={cn(
                  "relative z-10 flex shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular transition-colors",
                  compact ? "size-7" : "size-8",
                  done && "border-primary bg-primary text-primary-foreground",
                  current && "border-primary bg-primary-soft text-primary-soft-foreground ring-4 ring-primary/15",
                  !done && !current && "border-border bg-surface text-muted-foreground",
                  "max-sm:mx-auto",
                )}
              >
                {done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
              </span>
              {i < steps.length - 1 && (
                <span className={cn("ml-2 hidden h-0.5 flex-1 rounded-full sm:block", done ? "bg-primary" : "bg-border")} aria-hidden />
              )}
            </div>
            <p className={cn("mt-2 max-w-full truncate text-xs font-medium sm:text-[13px]", current || done ? "text-foreground" : "text-muted-foreground")}>
              {compact && i === 0 ? "Period" : i === 0 ? <><span className="sm:hidden">Period</span><span className="hidden sm:inline">{s.label}</span></> : s.label}
            </p>
            {!compact && <p className="hidden truncate text-xs text-muted-foreground sm:block">{s.hint}</p>}
            <span className="sr-only">{done ? "(completed)" : current ? "(current step)" : "(upcoming)"}</span>
          </li>
        );
      })}
    </ol>
  );
}
