"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, Search, TriangleAlert } from "lucide-react";
import { useHRStore } from "@/store/hr-store";
import { useLookups } from "@/hooks/use-hr";
import { runTotals } from "@/lib/payroll";
import { periodLabel } from "@/lib/dates";
import { cn, formatMoney, round2 } from "@/lib/utils";
import type { PayrollItem } from "@/types";
import { Badge, Card, Input, Separator } from "@/components/ui/primitives";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { DataTable } from "@/components/tables/data-table";
import { PersonCell } from "@/components/shared/common";

// ---------------- Totals strip ----------------
export function RunTotalsStrip({ items }: { items: PayrollItem[] }) {
  const t = runTotals(items);
  const stats = [
    { label: "Employees", value: String(t.employees) },
    { label: "Gross pay", value: formatMoney(t.gross) },
    { label: "Deductions", value: formatMoney(t.deductions) },
    { label: "Net pay", value: formatMoney(t.net), strong: true },
    { label: "Employer cost", value: formatMoney(t.employerCost) },
    { label: "Warnings", value: String(t.warnings), warn: t.warnings > 0 },
  ];
  return (
    <Card className="grid grid-cols-2 divide-border overflow-hidden sm:grid-cols-3 lg:grid-cols-6 lg:divide-x" data-testid="payroll-totals">
      {stats.map((s) => (
        <div key={s.label} className={cn("min-w-0 border-border p-4 max-lg:border-b", s.strong && "bg-primary-soft/60")}>
          <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
          <p className={cn("mt-1 truncate text-[15px] font-semibold tabular sm:text-base", s.strong && "text-primary-soft-foreground", s.warn && "text-warning")} title={s.value}>
            {s.value}
          </p>
        </div>
      ))}
    </Card>
  );
}

// ---------------- Warnings panel ----------------
export function WarningsPanel({ items, onSelect }: { items: PayrollItem[]; onSelect: (item: PayrollItem) => void }) {
  const lookups = useLookups();
  const flagged = items.filter((i) => i.warnings.length > 0);
  if (!flagged.length) {
    return (
      <Card className="flex items-center gap-3 p-4 text-sm" data-testid="payroll-warnings">
        <span className="flex size-8 items-center justify-center rounded-full bg-success-soft text-success-soft-foreground">
          <AlertTriangle className="size-4" />
        </span>
        <p>No warnings — every employee calculated cleanly.</p>
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden border-warning/30" data-testid="payroll-warnings">
      <div className="flex items-center gap-3 border-b border-warning/20 bg-warning-soft px-5 py-3">
        <TriangleAlert className="size-4 text-warning" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-warning-soft-foreground">
            {flagged.length} employee{flagged.length === 1 ? "" : "s"} need{flagged.length === 1 ? "s" : ""} review
          </p>
          <p className="text-xs text-warning-soft-foreground/80">Warnings don't block processing, but check them before submitting.</p>
        </div>
      </div>
      <ul className="scrollbar-thin max-h-72 divide-y divide-border overflow-y-auto">
        {flagged.map((i) => {
          const e = lookups.employee(i.employeeId);
          return (
            <li key={i.employeeId}>
              <button type="button" onClick={() => onSelect(i)} className="flex w-full flex-col gap-2 px-5 py-3 text-left transition-colors hover:bg-subtle sm:flex-row sm:items-start sm:gap-4" aria-label={`Review warnings for ${i.employeeId}`}>
                <div className="sm:w-56 sm:shrink-0">
                  <PersonCell size="sm" name={lookups.name(i.employeeId)} sub={i.employeeId} src={e?.avatar} seed={i.employeeId} />
                </div>
                <ul className="flex min-w-0 flex-1 flex-col gap-1 text-[13px] text-muted-foreground">
                  {i.warnings.map((w) => (
                    <li key={w} className="flex gap-2">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-warning" aria-hidden />
                      {w}
                    </li>
                  ))}
                </ul>
                <span className="text-sm font-medium tabular sm:text-right">{formatMoney(i.net)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// ---------------- Items table ----------------
export function PayrollItemsTable({ items, onSelect, title = "Payroll preview" }: { items: PayrollItem[]; onSelect: (item: PayrollItem) => void; title?: string }) {
  const lookups = useLookups();
  const [query, setQuery] = React.useState("");
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => {
      const e = lookups.employee(i.employeeId);
      return [i.employeeId, lookups.name(i.employeeId), lookups.deptName(e?.departmentId)].some((v) => v.toLowerCase().includes(q));
    });
  }, [items, query, lookups]);

  const money = (v: number) => formatMoney(v, "").trim();
  const columns: ColumnDef<PayrollItem, unknown>[] = [
    {
      id: "employee",
      header: "Employee",
      accessorFn: (i) => lookups.name(i.employeeId),
      cell: ({ row }) => {
        const i = row.original;
        const e = lookups.employee(i.employeeId);
        return (
          <div className="flex items-center gap-2">
            <PersonCell size="sm" name={lookups.name(i.employeeId)} sub={`${i.employeeId} · ${lookups.deptName(e?.departmentId)}`} src={e?.avatar} seed={i.employeeId} />
            {i.warnings.length > 0 && (
              <span title={i.warnings.join(" ")} className="text-warning">
                <TriangleAlert className="size-3.5" aria-label={`${i.warnings.length} warning(s)`} />
              </span>
            )}
          </div>
        );
      },
    },
    { id: "basic", header: "Basic", accessorKey: "basic", meta: { align: "right", className: "hidden md:table-cell" }, cell: ({ getValue }) => money(getValue() as number) },
    { id: "allowances", header: "Allowances", accessorFn: (i) => round2(i.transportAllowance + i.mealAllowance + i.otherAllowance), meta: { align: "right", className: "hidden lg:table-cell" }, cell: ({ getValue }) => money(getValue() as number) },
    { id: "otBonus", header: "OT + bonus", accessorFn: (i) => round2(i.overtimePay + i.bonus), meta: { align: "right", className: "hidden xl:table-cell" }, cell: ({ getValue }) => money(getValue() as number) },
    { id: "gross", header: "Gross", accessorKey: "gross", meta: { align: "right", className: "hidden sm:table-cell" }, cell: ({ getValue }) => <span className="font-medium">{money(getValue() as number)}</span> },
    { id: "epf", header: "EPF 8%", accessorKey: "epfEmployee", meta: { align: "right", className: "hidden lg:table-cell" }, cell: ({ getValue }) => money(getValue() as number) },
    { id: "apit", header: "APIT", accessorKey: "apit", meta: { align: "right", className: "hidden lg:table-cell" }, cell: ({ getValue }) => money(getValue() as number) },
    { id: "other", header: "Other ded.", accessorFn: (i) => round2(i.loanDeduction + i.otherDeduction + i.unpaidLeaveDeduction), meta: { align: "right", className: "hidden xl:table-cell" }, cell: ({ getValue }) => money(getValue() as number) },
    { id: "net", header: "Net (LKR)", accessorKey: "net", meta: { align: "right" }, cell: ({ getValue }) => <span className="font-semibold">{money(getValue() as number)}</span> },
  ];

  return (
    <Card>
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          <p className="text-[13px] text-muted-foreground">Click a row for the full breakdown · amounts in LKR</p>
        </div>
        <div className="relative sm:ml-auto sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search employees…" className="pl-9" aria-label="Search payroll items" />
        </div>
      </div>
      <DataTable
        label={title}
        columns={columns}
        data={filtered}
        getRowId={(i) => i.employeeId}
        onRowClick={onSelect}
        rowTestId={(i) => `payroll-row-${i.employeeId}`}
        emptyTitle="No employees match your search"
        emptyDescription="Try a different name or employee ID."
      />
    </Card>
  );
}

// ---------------- Breakdown dialog ----------------
export function BreakdownDialog({ item, period, onOpenChange }: { item: PayrollItem | null; period: string; onOpenChange: (open: boolean) => void }) {
  const lookups = useLookups();
  const settings = useHRStore((s) => s.data.payrollSettings);
  const e = item ? lookups.employee(item.employeeId) : undefined;
  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Payroll breakdown</DialogTitle>
          <DialogDescription>
            {item ? `${lookups.name(item.employeeId)} (${item.employeeId}) · ${periodLabel(period)} · ${item.workingDays} working days` : ""}
          </DialogDescription>
        </DialogHeader>
        {item && (
          <DialogBody className="space-y-5">
            <PersonCell name={lookups.name(item.employeeId)} sub={`${lookups.desName(e?.designationId)} · ${lookups.deptName(e?.departmentId)}`} src={e?.avatar} seed={item.employeeId} />
            <div className="grid gap-5 sm:grid-cols-2">
              <BreakdownList
                title="Earnings"
                rows={[
                  ["Basic salary", item.basic],
                  ["Transport allowance", item.transportAllowance],
                  ["Meal allowance", item.mealAllowance],
                  ["Other allowances", item.otherAllowance],
                  ["Overtime", item.overtimePay],
                  ["Bonus", item.bonus],
                ]}
                totalLabel="Gross pay"
                total={item.gross}
              />
              <BreakdownList
                title="Deductions"
                rows={[
                  [`EPF employee (${settings.epfEmployeeRate}%)`, item.epfEmployee],
                  ["APIT", item.apit],
                  ["Loan deduction", item.loanDeduction],
                  ["Other deductions", item.otherDeduction],
                  [`Unpaid leave${item.unpaidLeaveDays ? ` (${item.unpaidLeaveDays} d)` : ""}`, item.unpaidLeaveDeduction],
                ]}
                totalLabel="Total deductions"
                total={item.totalDeductions}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg bg-primary-soft px-4 py-3 text-primary-soft-foreground">
              <span className="text-sm font-medium">Net pay</span>
              <span className="text-lg font-semibold tabular">{formatMoney(item.net)}</span>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-muted-foreground">
              <span>
                Employer EPF ({settings.epfEmployerRate}%): <span className="font-medium text-foreground tabular">{formatMoney(item.epfEmployer)}</span>
              </span>
              <span>
                ETF ({settings.etfRate}%): <span className="font-medium text-foreground tabular">{formatMoney(item.etfEmployer)}</span>
              </span>
              <Badge variant="secondary">illustrative</Badge>
            </div>
            {item.warnings.length > 0 && (
              <div className="rounded-lg border border-warning/30 bg-warning-soft p-3 text-[13px] text-warning-soft-foreground">
                <p className="mb-1 font-medium">Warnings</p>
                <ul className="list-disc space-y-0.5 pl-4">
                  {item.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </DialogBody>
        )}
      </DialogContent>
    </Dialog>
  );
}

function BreakdownList({ title, rows, totalLabel, total }: { title: string; rows: [string, number][]; totalLabel: string; total: number }) {
  return (
    <div className="rounded-lg border border-border">
      <p className="border-b border-border bg-subtle px-3 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</p>
      <dl className="space-y-1.5 px-3 py-2.5 text-sm">
        {rows.map(([l, v]) => (
          <div key={l} className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{l}</dt>
            <dd className={cn("tabular", v === 0 && "text-muted-foreground")}>{formatMoney(v, "").trim()}</dd>
          </div>
        ))}
        <Separator className="my-1.5" />
        <div className="flex justify-between gap-3 font-medium">
          <dt>{totalLabel}</dt>
          <dd className="tabular">{formatMoney(total, "").trim()}</dd>
        </div>
      </dl>
    </div>
  );
}
