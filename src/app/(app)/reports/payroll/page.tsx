"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Landmark, Receipt, TrendingUp, Wallet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useHRStore } from "@/store/hr-store";
import { useLookups } from "@/hooks/use-hr";
import { periodBounds, runTotals } from "@/lib/payroll";
import { periodLabel, rangesOverlap, shortPeriodLabel } from "@/lib/dates";
import { formatAmount, formatCompactMoney, formatMoney, round2 } from "@/lib/utils";
import type { PayrollItem } from "@/types";
import { Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/tables/data-table";
import { EmptyState, KpiCard, PersonCell, SectionCard } from "@/components/shared/common";
import { axisProps, ChartLegend, ChartTooltip, chartColors, gridProps, tooltipCursor, chartAnimation } from "@/components/charts/chart-kit";
import { FilterBar, matches, ReportFrame, useFilterSummary, useReportFilters } from "@/features/reports/report-kit";

interface Row {
  key: string;
  period: string;
  item: PayrollItem;
  name: string;
  department: string;
}

const axisMoney = (v: number) => (Math.abs(v) >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : `${Math.round(v / 1000)}K`);

export default function PayrollReportPage() {
  const runs = useHRStore((s) => s.data.payrollRuns);
  const lookups = useLookups();
  const processed = React.useMemo(() => runs.filter((r) => r.status === "Processed").sort((a, b) => a.period.localeCompare(b.period)), [runs]);
  const [defaultRange] = React.useState(() =>
    processed.length ? { from: periodBounds(processed[0].period).start, to: periodBounds(processed[processed.length - 1].period).end } : null,
  );
  const { filters, update, reset } = useReportFilters(defaultRange);
  const filterSummary = useFilterSummary(filters);

  const inRangeRuns = React.useMemo(
    () => processed.filter((r) => { const b = periodBounds(r.period); return !filters.range || rangesOverlap(b.start, b.end, filters.range.from, filters.range.to); }),
    [processed, filters.range],
  );

  const rows = React.useMemo<Row[]>(
    () =>
      inRangeRuns
        .slice()
        .reverse()
        .flatMap((run) =>
          run.items
            .filter((i) => {
              const e = lookups.employee(i.employeeId);
              if (filters.dept !== "all" && e?.departmentId !== filters.dept) return false;
              if (filters.employeeId && i.employeeId !== filters.employeeId) return false;
              return matches(filters.query, i.employeeId, lookups.name(i.employeeId), lookups.deptName(e?.departmentId), run.period, periodLabel(run.period));
            })
            .map((item) => ({ key: `${run.period}-${item.employeeId}`, period: run.period, item, name: lookups.name(item.employeeId), department: lookups.deptName(lookups.employee(item.employeeId)?.departmentId) })),
        ),
    [inRangeRuns, filters, lookups],
  );

  const totals = React.useMemo(() => runTotals(rows.map((r) => r.item)), [rows]);
  const chart = React.useMemo(
    () =>
      inRangeRuns.map((run) => {
        const t = runTotals(rows.filter((r) => r.period === run.period).map((r) => r.item));
        return { label: shortPeriodLabel(run.period), gross: t.gross, net: t.net, deductions: t.deductions };
      }),
    [inRangeRuns, rows],
  );
  const statutory = round2(totals.epfEmployee + totals.epfEmployer + totals.etf + totals.apit);
  const periodsCount = new Set(rows.map((r) => r.period)).size;

  const columns: ColumnDef<Row, unknown>[] = [
    { id: "period", header: "Period", accessorKey: "period", cell: ({ getValue }) => <span className="tabular">{shortPeriodLabel(getValue() as string)}</span> },
    { id: "employee", header: "Employee", accessorFn: (r) => r.name, cell: ({ row }) => <PersonCell size="sm" name={row.original.name} sub={row.original.item.employeeId} seed={row.original.item.employeeId} src={lookups.employee(row.original.item.employeeId)?.avatar} /> },
    { id: "department", header: "Department", accessorKey: "department", meta: { className: "hidden xl:table-cell" } },
    { id: "gross", header: "Gross", accessorFn: (r) => r.item.gross, meta: { align: "right", className: "hidden sm:table-cell" }, cell: ({ getValue }) => formatAmount(getValue() as number) },
    { id: "epf", header: "EPF 8%", accessorFn: (r) => r.item.epfEmployee, meta: { align: "right", className: "hidden lg:table-cell" }, cell: ({ getValue }) => formatAmount(getValue() as number) },
    { id: "apit", header: "APIT", accessorFn: (r) => r.item.apit, meta: { align: "right", className: "hidden lg:table-cell" }, cell: ({ getValue }) => formatAmount(getValue() as number) },
    { id: "other", header: "Other ded.", accessorFn: (r) => round2(r.item.loanDeduction + r.item.otherDeduction + r.item.unpaidLeaveDeduction), meta: { align: "right", className: "hidden md:table-cell" }, cell: ({ getValue }) => formatAmount(getValue() as number) },
    { id: "net", header: "Net (LKR)", accessorFn: (r) => r.item.net, meta: { align: "right" }, cell: ({ getValue }) => <span className="font-medium">{formatAmount(getValue() as number)}</span> },
  ];

  const exportSpec = {
    title: "Payroll Report",
    filenameBase: "payroll-report",
    columns: ["Period", "Employee ID", "Employee", "Department", "Gross", "EPF employee", "APIT", "Other deductions", "Net", "EPF employer", "ETF"],
    rows: rows.map((r) => [r.period, r.item.employeeId, r.name, r.department, r.item.gross, r.item.epfEmployee, r.item.apit, round2(r.item.loanDeduction + r.item.otherDeduction + r.item.unpaidLeaveDeduction), r.item.net, r.item.epfEmployer, r.item.etfEmployer]),
    moneyColumns: [4, 5, 6, 7, 8, 9, 10],
    filters: filterSummary,
    summary: [
      { label: "Periods", value: String(periodsCount) },
      { label: "Payslips", value: String(rows.length) },
      { label: "Gross", value: formatMoney(totals.gross) },
      { label: "Deductions", value: formatMoney(totals.deductions) },
      { label: "Net", value: formatMoney(totals.net) },
      { label: "Employer cost", value: formatMoney(totals.employerCost) },
    ],
  };

  return (
    <ReportFrame permission="reports.payroll" title="Payroll Report" description="Processed payroll by period and employee — gross, statutory deductions and net pay (illustrative rates)." exportSpec={exportSpec}>
      <FilterBar filters={filters} update={update} reset={reset} rangePlaceholder="All periods" />
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={Receipt} title="No processed payroll matches these filters" description="Only processed runs are reported. Widen the period range or clear the department, employee and search filters." action={<Button variant="outline" size="sm" onClick={reset}>Reset filters</Button>} />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Gross pay" icon={TrendingUp} value={formatCompactMoney(totals.gross)} hint={`${periodsCount} periods · ${rows.length} payslips`} />
            <KpiCard label="Net pay" icon={Wallet} tone="success" value={formatCompactMoney(totals.net)} hint={`Deductions ${formatCompactMoney(totals.deductions)}`} />
            <KpiCard label="Statutory" icon={Landmark} tone="warning" value={formatCompactMoney(statutory)} hint="EPF 8% + 12%, ETF 3%, APIT" />
            <KpiCard label="Employer cost" icon={Receipt} tone="info" value={formatCompactMoney(totals.employerCost)} hint="Gross + employer EPF/ETF" />
          </div>
          <SectionCard title="Payroll by period" description="Gross, deductions and net for the filtered employees" action={<ChartLegend items={[{ label: "Gross", color: chartColors[0] }, { label: "Net", color: chartColors[1] }, { label: "Deductions", color: chartColors[3] }]} />}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chart} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} barGap={3}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis {...axisProps} tickFormatter={axisMoney} width={52} />
                <Tooltip content={<ChartTooltip formatter={(v) => formatMoney(v)} />} cursor={tooltipCursor} />
                <Bar isAnimationActive={chartAnimation} dataKey="gross" name="Gross" fill={chartColors[0]} radius={[4, 4, 0, 0]} maxBarSize={24} />
                <Bar isAnimationActive={chartAnimation} dataKey="net" name="Net" fill={chartColors[1]} radius={[4, 4, 0, 0]} maxBarSize={24} />
                <Bar isAnimationActive={chartAnimation} dataKey="deductions" name="Deductions" fill={chartColors[3]} radius={[4, 4, 0, 0]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>
          <Card>
            <div className="border-b border-border p-4">
              <h2 className="text-[15px] font-semibold tracking-tight">Payroll register</h2>
              <p className="text-[13px] text-muted-foreground">{rows.length} payslips across {periodsCount} processed periods · amounts in LKR</p>
            </div>
            <DataTable label="Payroll register" columns={columns} data={rows} getRowId={(r) => r.key} rowTestId={(r) => `report-row-${r.key}`} />
            <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-border bg-subtle px-5 py-3 text-sm tabular" data-testid="report-totals">
              <span className="font-medium">Totals</span>
              <span>Gross {formatMoney(totals.gross)}</span>
              <span>EPF {formatMoney(totals.epfEmployee)}</span>
              <span>APIT {formatMoney(totals.apit)}</span>
              <span>Deductions {formatMoney(totals.deductions)}</span>
              <span className="font-medium">Net {formatMoney(totals.net)}</span>
            </div>
          </Card>
        </>
      )}
    </ReportFrame>
  );
}
