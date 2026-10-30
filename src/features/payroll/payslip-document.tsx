"use client";

import * as React from "react";
import { Info } from "lucide-react";
import { useHRStore } from "@/store/hr-store";
import { useLookups } from "@/hooks/use-hr";
import { formatDate, periodLabel } from "@/lib/dates";
import { periodBounds } from "@/lib/payroll";
import { cn, formatAmount, formatMoney } from "@/lib/utils";
import { Card } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/shared/common";
import { LogoGlyph } from "@/components/layout/brand";
import { amountInWords } from "./payroll-utils";
import type { PayslipRow } from "./payslip-data";

export function PayslipDocument({ row }: { row: PayslipRow }) {
  const company = useHRStore((s) => s.data.company);
  const settings = useHRStore((s) => s.data.payrollSettings);
  const lookups = useLookups();
  const e = lookups.employee(row.employeeId);
  const it = row.item;
  const cur = company.currency || "LKR";

  const details = [
    { label: "Employee name", value: lookups.name(row.employeeId) },
    { label: "Employee ID", value: row.employeeId },
    { label: "Designation", value: lookups.desName(e?.designationId) },
    { label: "Department", value: lookups.deptName(e?.departmentId) },
    { label: "Join date", value: formatDate(e?.joinDate) },
    { label: "Pay date", value: formatDate(row.payDate) },
    { label: "Working days", value: String(it.workingDays) },
    { label: "Payment status", value: <StatusBadge status="Paid" /> },
  ];
  const earnings: [string, number][] = [
    ["Basic salary", it.basic],
    ["Transport allowance", it.transportAllowance],
    ["Meal allowance", it.mealAllowance],
    ["Other allowances", it.otherAllowance],
    ["Overtime", it.overtimePay],
    ["Bonus", it.bonus],
  ];
  const deductions: [string, number][] = [
    [`EPF employee (${settings.epfEmployeeRate}%)`, it.epfEmployee],
    ["APIT (PAYE)", it.apit],
    ["Loan deduction", it.loanDeduction],
    ["Other deductions", it.otherDeduction],
    [`Unpaid leave${it.unpaidLeaveDays ? ` (${it.unpaidLeaveDays} day${it.unpaidLeaveDays === 1 ? "" : "s"})` : ""}`, it.unpaidLeaveDeduction],
  ];

  return (
    <Card className="print-area mx-auto w-full max-w-4xl overflow-hidden" data-testid="payslip-document">
      {/* Header */}
      <div className="flex flex-col gap-5 border-b border-border p-6 sm:flex-row sm:items-start sm:justify-between sm:p-8">
        <div className="flex min-w-0 items-start gap-4">
          {company.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.logo} alt={`${company.name} logo`} className="size-12 shrink-0 rounded-xl object-cover" />
          ) : (
            <LogoGlyph className="size-12 shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-base font-semibold tracking-tight">{company.legalName}</p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">{company.address}</p>
            <p className="text-[13px] text-muted-foreground">
              {company.email} · {company.phone}
            </p>
          </div>
        </div>
        <div className="sm:text-right">
          <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">Payslip</p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">{row.id}</p>
          <p className="text-xs text-muted-foreground">Reg. {company.registrationNo}</p>
        </div>
      </div>

      <div className="space-y-7 p-6 sm:p-8">
        <div>
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Payslip for {periodLabel(row.period)}</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">Pay period {formatDate(periodBounds(row.period).start)} – {formatDate(periodBounds(row.period).end)}</p>
        </div>

        {/* Employee details */}
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl border border-border bg-subtle p-5 sm:grid-cols-4 print-break-avoid">
          {details.map((d) => (
            <div key={d.label} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{d.label}</dt>
              <dd className="mt-1 text-sm font-medium break-words">{d.value}</dd>
            </div>
          ))}
        </dl>

        {/* Earnings / deductions */}
        <div className="grid gap-5 md:grid-cols-2 print:grid-cols-2">
          <LineTable title="Earnings" rows={earnings} totalLabel="Gross earnings" total={it.gross} currency={cur} />
          <LineTable title="Deductions" rows={deductions} totalLabel="Total deductions" total={it.totalDeductions} currency={cur} />
        </div>

        {/* Net pay */}
        <div className="flex flex-col gap-3 rounded-xl border border-primary/25 bg-primary-soft p-5 sm:flex-row sm:items-center sm:justify-between print-break-avoid" data-testid="payslip-net">
          <div>
            <p className="text-xs font-semibold tracking-wide text-primary-soft-foreground uppercase">Net pay</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight tabular">{formatMoney(it.net, cur)}</p>
          </div>
          <div className="text-[13px] text-muted-foreground sm:max-w-sm sm:text-right">
            <p className="italic">{amountInWords(it.net)}</p>
            <p className="mt-1 tabular">
              {formatMoney(it.gross, cur)} gross − {formatMoney(it.totalDeductions, cur)} deductions
            </p>
          </div>
        </div>

        {/* Employer contributions */}
        <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-[13px] sm:flex-row sm:items-center sm:gap-6 print-break-avoid">
          <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
            <Info className="size-3.5" /> Employer contributions (not deducted)
          </span>
          <span>
            EPF employer ({settings.epfEmployerRate}%): <span className="font-medium tabular">{formatMoney(it.epfEmployer, cur)}</span>
          </span>
          <span>
            ETF ({settings.etfRate}%): <span className="font-medium tabular">{formatMoney(it.etfEmployer, cur)}</span>
          </span>
        </div>

        {it.warnings.length > 0 && (
          <p className="text-xs text-muted-foreground">Notes: {it.warnings.join(" ")}</p>
        )}
      </div>

      <div className="border-t border-border bg-subtle px-6 py-4 text-center text-xs text-muted-foreground sm:px-8">
        Computer-generated payslip (demo) — illustrative statutory values. No signature required.
      </div>
    </Card>
  );
}

function LineTable({ title, rows, totalLabel, total, currency }: { title: string; rows: [string, number][]; totalLabel: string; total: number; currency: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border print-break-avoid">
      <div className="flex items-center justify-between bg-subtle px-4 py-2.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        <span>{title}</span>
        <span>Amount ({currency})</span>
      </div>
      <table className="w-full text-sm">
        <caption className="sr-only">{title}</caption>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} className="border-t border-border">
              <th scope="row" className="px-4 py-2.5 text-left font-normal text-muted-foreground">{label}</th>
              <td className={cn("px-4 py-2.5 text-right tabular", value === 0 && "text-muted-foreground")}>{formatAmount(value)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-border bg-subtle">
            <th scope="row" className="px-4 py-3 text-left font-semibold">{totalLabel}</th>
            <td className="px-4 py-3 text-right font-semibold tabular">{formatAmount(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
