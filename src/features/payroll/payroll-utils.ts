"use client";

import * as React from "react";
import { addMonths, parseISO } from "date-fns";
import { useShallow } from "zustand/react/shallow";
import { useHRStore } from "@/store/hr-store";
import { now, periodKey, periodLabel } from "@/lib/dates";
import type { PayrollContext } from "@/lib/payroll";
import type { PayrollRun, PayrollStatus } from "@/types";

export const payrollTabs = [
  { href: "/payroll", label: "Overview", exact: true },
  { href: "/payroll/process", label: "Process" },
  { href: "/payroll/salary-structures", label: "Salary Structures" },
  { href: "/payroll/payslips", label: "Payslips" },
  { href: "/payroll/history", label: "History" },
  { href: "/payroll/settings", label: "Settings" },
];

export function currentPeriod() {
  return periodKey(now());
}

export function shiftPeriod(period: string, months: number) {
  return periodKey(addMonths(parseISO(`${period}-01`), months));
}

/** Periods offered by the run workflow: two previous months, the current month and the next one. */
export function periodOptions() {
  const cur = currentPeriod();
  return [1, 0, -1, -2].map((d) => shiftPeriod(cur, d));
}

export type RunState = PayrollStatus | "Not started";

export function sortRunsDesc(runs: PayrollRun[]) {
  return [...runs].sort((a, b) => b.period.localeCompare(a.period));
}

export function processedRuns(runs: PayrollRun[]) {
  return sortRunsDesc(runs.filter((r) => r.status === "Processed"));
}

export function monthLabel(period: string) {
  return periodLabel(period);
}

/** Calculation context for `calculatePayrollItem` / `generatePayrollItems`, read live from the store. */
export function usePayrollContext(period: string): PayrollContext {
  const { settings, leaveSettings, holidays, leaveRequests, attendance } = useHRStore(
    useShallow((s) => ({
      settings: s.data.payrollSettings,
      leaveSettings: s.data.leaveSettings,
      holidays: s.data.holidays,
      leaveRequests: s.data.leaveRequests,
      attendance: s.data.attendance,
    })),
  );
  return React.useMemo(
    () => ({ period, settings, leaveSettings, holidays, leaveRequests, attendance }),
    [period, settings, leaveSettings, holidays, leaveRequests, attendance],
  );
}

const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function below1000(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const parts: string[] = [];
  if (h) parts.push(`${ones[h]} Hundred`);
  if (r) parts.push(r < 20 ? ones[r] : `${tens[Math.floor(r / 10)]}${r % 10 ? `-${ones[r % 10]}` : ""}`);
  return parts.join(" ");
}

function intToWords(n: number): string {
  if (n === 0) return "Zero";
  const scales: [number, string][] = [
    [1_000_000_000, "Billion"],
    [1_000_000, "Million"],
    [1_000, "Thousand"],
  ];
  const parts: string[] = [];
  let rest = n;
  for (const [v, label] of scales) {
    if (rest >= v) {
      parts.push(`${below1000(Math.floor(rest / v))} ${label}`);
      rest %= v;
    }
  }
  if (rest) parts.push(below1000(rest));
  return parts.join(" ");
}

export function amountInWords(value: number, currencyName = "Rupees") {
  const abs = Math.abs(value);
  const whole = Math.floor(abs);
  const cents = Math.round((abs - whole) * 100);
  return `${value < 0 ? "Minus " : ""}${currencyName} ${intToWords(whole)}${cents ? ` and ${intToWords(cents)} Cents` : ""} Only`;
}

export function pctChange(current: number, previous: number) {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}
