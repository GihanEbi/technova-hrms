"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { CalendarDays, CalendarX2, Hourglass, ListChecks } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useHRStore } from "@/store/hr-store";
import { useLookups } from "@/hooks/use-hr";
import { format, formatDate, now, parseISO, rangesOverlap } from "@/lib/dates";
import type { LeaveRequest } from "@/types";
import { Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/tables/data-table";
import { EmptyState, KpiCard, PersonCell, SectionCard, StatusBadge } from "@/components/shared/common";
import { axisProps, ChartLegend, ChartTooltip, chartColors, gridProps, tooltipCursor, chartAnimation } from "@/components/charts/chart-kit";
import { FilterBar, MiniSelect, matches, ReportFrame, useFilterSummary, useReportFilters } from "@/features/reports/report-kit";

const typeColor = (c: string) => `var(--${c})`;

export default function LeaveReportPage() {
  const requests = useHRStore((s) => s.data.leaveRequests);
  const types = useHRStore((s) => s.data.leaveTypes);
  const lookups = useLookups();
  const [defaultRange] = React.useState(() => {
    const y = now().getFullYear();
    return { from: `${y}-01-01`, to: `${y}-12-31` };
  });
  const { filters, update, reset } = useReportFilters(defaultRange);
  const [status, setStatus] = React.useState("all");
  const [type, setType] = React.useState("all");
  const baseSummary = useFilterSummary(filters);
  const typeName = (id: string) => types.find((t) => t.id === id)?.name ?? id;

  const resetAll = () => {
    reset();
    setStatus("all");
    setType("all");
  };

  const filtered = React.useMemo(
    () =>
      requests
        .filter((r) => {
          const e = lookups.employee(r.employeeId);
          if (!e) return false;
          if (filters.range && !rangesOverlap(r.startDate, r.endDate, filters.range.from, filters.range.to)) return false;
          if (filters.dept !== "all" && e.departmentId !== filters.dept) return false;
          if (filters.employeeId && r.employeeId !== filters.employeeId) return false;
          if (status !== "all" && r.status !== status) return false;
          if (type !== "all" && r.typeId !== type) return false;
          return matches(filters.query, r.id, lookups.name(r.employeeId), r.employeeId, r.reason, typeName(r.typeId));
        })
        .sort((a, b) => b.startDate.localeCompare(a.startDate)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [requests, filters, status, type, lookups, types],
  );

  const totals = React.useMemo(() => {
    const days = (pred: (r: LeaveRequest) => boolean) => filtered.filter(pred).reduce((s, r) => s + r.days, 0);
    return {
      requests: filtered.length,
      approvedDays: days((r) => r.status === "Approved"),
      pending: filtered.filter((r) => r.status === "Pending").length,
      pendingDays: days((r) => r.status === "Pending"),
      rejected: filtered.filter((r) => r.status === "Rejected").length,
      unpaidDays: days((r) => r.status === "Approved" && r.typeId === "unpaid"),
      totalDays: days(() => true),
    };
  }, [filtered]);

  const chart = React.useMemo(() => {
    const months = new Map<string, Record<string, number | string>>();
    filtered
      .filter((r) => r.status === "Approved" || r.status === "Pending")
      .forEach((r) => {
        const key = r.startDate.slice(0, 7);
        const m = months.get(key) ?? { key, label: format(parseISO(`${key}-01`), "MMM") };
        m[r.typeId] = ((m[r.typeId] as number) ?? 0) + r.days;
        months.set(key, m);
      });
    return [...months.values()].sort((a, b) => String(a.key).localeCompare(String(b.key)));
  }, [filtered]);

  const columns: ColumnDef<LeaveRequest, unknown>[] = [
    { id: "id", header: "Request", accessorKey: "id", cell: ({ getValue }) => <span className="font-mono text-xs text-muted-foreground">{getValue() as string}</span> },
    {
      id: "employee",
      header: "Employee",
      accessorFn: (r) => lookups.name(r.employeeId),
      cell: ({ row }) => <PersonCell size="sm" name={lookups.name(row.original.employeeId)} sub={lookups.deptName(lookups.employee(row.original.employeeId)?.departmentId)} src={lookups.employee(row.original.employeeId)?.avatar} seed={row.original.employeeId} />,
    },
    { id: "type", header: "Type", accessorFn: (r) => typeName(r.typeId), meta: { className: "hidden sm:table-cell" } },
    { id: "start", header: "From", accessorKey: "startDate", meta: { className: "hidden md:table-cell" }, cell: ({ getValue }) => <span className="tabular">{formatDate(getValue() as string)}</span> },
    { id: "end", header: "To", accessorKey: "endDate", meta: { className: "hidden md:table-cell" }, cell: ({ getValue }) => <span className="tabular">{formatDate(getValue() as string)}</span> },
    { id: "days", header: "Days", accessorKey: "days", meta: { align: "right" } },
    { id: "status", header: "Status", accessorKey: "status", cell: ({ getValue }) => <StatusBadge status={getValue() as string} /> },
  ];

  const exportSpec = {
    title: "Leave Report",
    filenameBase: "leave-report",
    columns: ["Request", "Employee ID", "Employee", "Department", "Type", "From", "To", "Days", "Status", "Reason"],
    rows: filtered.map((r) => [r.id, r.employeeId, lookups.name(r.employeeId), lookups.deptName(lookups.employee(r.employeeId)?.departmentId), typeName(r.typeId), r.startDate, r.endDate, r.days, r.status, r.reason]),
    numericColumns: [7],
    filters: [...baseSummary, { label: "Status", value: status === "all" ? "All statuses" : status }, { label: "Leave type", value: type === "all" ? "All types" : typeName(type) }],
    summary: [
      { label: "Requests", value: String(totals.requests) },
      { label: "Approved days", value: String(totals.approvedDays) },
      { label: "Pending requests", value: `${totals.pending} (${totals.pendingDays} days)` },
      { label: "Rejected", value: String(totals.rejected) },
      { label: "Unpaid days", value: String(totals.unpaidDays) },
    ],
  };

  return (
    <ReportFrame permission="reports.hr" title="Leave Report" description="Leave requests, approvals and days taken by type and month." exportSpec={exportSpec}>
      <FilterBar filters={filters} update={update} reset={resetAll}>
        <MiniSelect label="Status" value={status} onChange={setStatus} options={[{ value: "all", label: "All statuses" }, ...["Approved", "Pending", "Rejected", "Cancelled"].map((s) => ({ value: s, label: s }))]} className="lg:w-40" />
        <MiniSelect label="Leave type" value={type} onChange={setType} options={[{ value: "all", label: "All leave types" }, ...types.map((t) => ({ value: t.id, label: t.name }))]} className="lg:w-44" />
      </FilterBar>
      {filtered.length === 0 ? (
        <Card>
          <EmptyState icon={CalendarX2} title="No leave requests match these filters" description="Try a wider date range, another status or clear the department and employee filters." action={<Button variant="outline" size="sm" onClick={resetAll}>Reset filters</Button>} />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Leave requests" icon={ListChecks} value={totals.requests} hint={`${totals.totalDays} days requested`} />
            <KpiCard label="Approved days" icon={CalendarDays} tone="success" value={totals.approvedDays} hint="Taken or scheduled" />
            <KpiCard label="Pending requests" icon={Hourglass} tone="warning" value={totals.pending} hint={`${totals.pendingDays} days awaiting approval`} />
            <KpiCard label="Unpaid leave days" icon={CalendarX2} tone="danger" value={totals.unpaidDays} hint={`${totals.rejected} requests rejected`} />
          </div>
          <SectionCard title="Leave days by month" description="Approved and pending days, stacked by leave type" action={<ChartLegend items={types.map((t) => ({ label: t.name, color: typeColor(t.color) }))} />}>
            {chart.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chart} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="label" {...axisProps} />
                  <YAxis {...axisProps} allowDecimals={false} width={40} />
                  <Tooltip content={<ChartTooltip formatter={(v) => `${v} days`} />} cursor={tooltipCursor} />
                  {types.map((t, i) => (
                    <Bar isAnimationActive={chartAnimation} key={t.id} dataKey={t.id} name={t.name} stackId="a" fill={typeColor(t.color) ?? chartColors[i]} maxBarSize={36} radius={i === types.length - 1 ? [3, 3, 0, 0] : 0} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState title="No approved or pending leave" description="Only rejected or cancelled requests match the filters." />
            )}
          </SectionCard>
          <Card>
            <div className="border-b border-border p-4">
              <h2 className="text-[15px] font-semibold tracking-tight">Leave requests</h2>
              <p className="text-[13px] text-muted-foreground">{filtered.length} requests overlapping the selected range</p>
            </div>
            <DataTable label="Leave requests" columns={columns} data={filtered} getRowId={(r) => r.id} rowTestId={(r) => `report-row-${r.id}`} />
            <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-border bg-subtle px-5 py-3 text-sm tabular" data-testid="report-totals">
              <span className="font-medium">Totals</span>
              <span>{totals.requests} requests</span>
              <span>{totals.totalDays} days requested</span>
              <span>{totals.approvedDays} approved</span>
              <span>{totals.pendingDays} pending</span>
            </div>
          </Card>
        </>
      )}
    </ReportFrame>
  );
}
