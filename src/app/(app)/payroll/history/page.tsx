"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, Download, Landmark, Receipt, Wallet } from "lucide-react";
import { useHRStore } from "@/store/hr-store";
import { useLookups } from "@/hooks/use-hr";
import { runTotals } from "@/lib/payroll";
import { formatDate, now, periodLabel } from "@/lib/dates";
import { formatCompactMoney, formatMoney, round2 } from "@/lib/utils";
import type { PayrollRun } from "@/types";
import { Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/tables/data-table";
import { KpiCard, StatusBadge } from "@/components/shared/common";
import { PayrollPageFrame } from "@/features/payroll/payroll-shell";
import { sortRunsDesc } from "@/features/payroll/payroll-utils";
import { downloadRunRegister } from "@/features/payroll/register-csv";

type Row = PayrollRun & { totals: ReturnType<typeof runTotals> };

export default function PayrollHistoryPage() {
  const runs = useHRStore((s) => s.data.payrollRuns);
  const employees = useHRStore((s) => s.data.employees);
  const lookups = useLookups();

  const rows = React.useMemo<Row[]>(() => sortRunsDesc(runs).map((r) => ({ ...r, totals: runTotals(r.items) })), [runs]);
  const year = String(now().getFullYear());
  const ytd = rows.filter((r) => r.status === "Processed" && r.period.startsWith(year));
  const ytdNet = round2(ytd.reduce((s, r) => s + r.totals.net, 0));
  const ytdCost = round2(ytd.reduce((s, r) => s + r.totals.employerCost, 0));
  const ytdStat = round2(ytd.reduce((s, r) => s + r.totals.epfEmployee + r.totals.epfEmployer + r.totals.etf + r.totals.apit, 0));

  const download = (r: PayrollRun) => {
    const n = downloadRunRegister(r, employees, (id) => lookups.deptName(id));
    toast.success("Register downloaded", { description: `${periodLabel(r.period)} · ${n} employees exported to CSV.` });
  };

  const columns: ColumnDef<Row, unknown>[] = [
    {
      id: "period",
      header: "Period",
      accessorKey: "period",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{periodLabel(row.original.period)}</p>
          <p className="font-mono text-xs text-muted-foreground">{row.original.id}</p>
        </div>
      ),
    },
    { id: "status", header: "Status", accessorKey: "status", cell: ({ getValue }) => <StatusBadge status={getValue() as string} /> },
    { id: "employees", header: "Employees", accessorFn: (r) => r.totals.employees, meta: { align: "right", className: "hidden sm:table-cell" } },
    { id: "gross", header: "Gross", accessorFn: (r) => r.totals.gross, meta: { align: "right", className: "hidden lg:table-cell" }, cell: ({ getValue }) => formatMoney(getValue() as number) },
    { id: "deductions", header: "Deductions", accessorFn: (r) => r.totals.deductions, meta: { align: "right", className: "hidden xl:table-cell" }, cell: ({ getValue }) => formatMoney(getValue() as number) },
    { id: "net", header: "Net", accessorFn: (r) => r.totals.net, meta: { align: "right" }, cell: ({ getValue }) => <span className="font-medium">{formatMoney(getValue() as number)}</span> },
    { id: "processedAt", header: "Processed", accessorFn: (r) => r.processedAt ?? "", meta: { className: "hidden md:table-cell" }, cell: ({ row }) => <span className="text-muted-foreground tabular">{row.original.processedAt ? formatDate(row.original.processedAt) : "—"}</span> },
    { id: "processedBy", header: "Processed by", accessorFn: (r) => (r.processedBy ? lookups.name(r.processedBy) : ""), meta: { className: "hidden xl:table-cell" }, cell: ({ getValue }) => (getValue() as string) || <span className="text-muted-foreground">—</span> },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      meta: { align: "right" },
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="flex items-center justify-end gap-1">
            {r.status === "Processed" ? (
              <Button asChild variant="ghost" size="sm">
                <Link href={`/payroll/payslips?period=${r.period}`} aria-label={`View payslips for ${r.period}`}>
                  <Receipt /> <span className="hidden sm:inline">View payslips</span>
                </Link>
              </Button>
            ) : (
              <Button asChild variant="ghost" size="sm">
                <Link href={`/payroll/process?period=${r.period}`} aria-label={`Continue payroll for ${r.period}`}>
                  <ArrowRight /> <span className="hidden sm:inline">Continue</span>
                </Link>
              </Button>
            )}
            <Button variant="ghost" size="icon-sm" aria-label={`Download CSV for ${r.period}`} onClick={() => download(r)}>
              <Download />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <PayrollPageFrame title="Payroll History" description="Every payroll run with its totals, status and registers.">
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Processed this year" icon={CheckCircle2} tone="success" value={ytd.length} hint={`${rows.length} runs in total`} />
          <KpiCard label="Net paid YTD" icon={Wallet} value={formatCompactMoney(ytdNet)} hint={year} />
          <KpiCard label="Employer cost YTD" icon={Landmark} tone="info" value={formatCompactMoney(ytdCost)} hint="Gross + EPF 12% + ETF 3%" />
          <KpiCard label="Statutory YTD" icon={Receipt} tone="warning" value={formatCompactMoney(ytdStat)} hint="EPF, ETF and APIT (illustrative)" />
        </div>
        <Card>
          <div className="flex flex-col gap-1 border-b border-border p-4">
            <h2 className="text-[15px] font-semibold tracking-tight">Payroll runs</h2>
            <p className="text-[13px] text-muted-foreground">Newest first. Download a run's register as CSV or open its payslips.</p>
          </div>
          <DataTable
            label="Payroll runs"
            columns={columns}
            data={rows}
            getRowId={(r) => r.id}
            rowTestId={(r) => `run-row-${r.period}`}
            emptyTitle="No payroll runs yet"
            emptyDescription="Generate the first run from the Process tab."
          />
        </Card>
      </div>
    </PayrollPageFrame>
  );
}
