"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Hourglass, UserPlus, Users, UserCheck } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useHRStore } from "@/store/hr-store";
import { useLookups } from "@/hooks/use-hr";
import { differenceInCalendarDays, formatDate, fromDateKey, now } from "@/lib/dates";
import type { Employee } from "@/types";
import { Card, Progress } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/tables/data-table";
import { EmptyState, KpiCard, PersonCell, SectionCard, StatusBadge } from "@/components/shared/common";
import { axisProps, ChartTooltip, gridProps, tooltipCursor, chartAnimation } from "@/components/charts/chart-kit";
import { FilterBar, MiniSelect, matches, rangeLabel, ReportFrame, useFilterSummary, useReportFilters } from "@/features/reports/report-kit";

const tenureYears = (join: string) => Math.max(0, differenceInCalendarDays(now(), fromDateKey(join)) / 365);

export default function EmployeeReportPage() {
  const employees = useHRStore((s) => s.data.employees);
  const departments = useHRStore((s) => s.data.departments);
  const lookups = useLookups();
  const [defaultRange] = React.useState(() => ({ from: `${now().getFullYear()}-01-01`, to: formatDate(now(), "yyyy-MM-dd") }));
  const { filters, update, reset } = useReportFilters(defaultRange);
  const [scope, setScope] = React.useState<"all" | "joiners">("all");
  const baseSummary = useFilterSummary(filters);

  const resetAll = () => {
    reset();
    setScope("all");
  };

  const inRange = React.useCallback((e: Employee) => !filters.range || (e.joinDate >= filters.range.from && e.joinDate <= filters.range.to), [filters.range]);

  const base = React.useMemo(
    () =>
      employees
        .filter(
          (e) =>
            !e.archived &&
            (filters.dept === "all" || e.departmentId === filters.dept) &&
            (!filters.employeeId || e.id === filters.employeeId) &&
            matches(filters.query, `${e.firstName} ${e.lastName}`, e.id, e.email, lookups.desName(e.designationId), lookups.deptName(e.departmentId)),
        )
        .sort((a, b) => a.id.localeCompare(b.id)),
    [employees, filters, lookups],
  );
  const rows = React.useMemo(() => (scope === "joiners" ? base.filter(inRange) : base), [base, scope, inRange]);

  const totals = React.useMemo(() => {
    const joiners = base.filter(inRange).length;
    const avgTenure = rows.length ? rows.reduce((s, e) => s + tenureYears(e.joinDate), 0) / rows.length : 0;
    const by = <K extends string>(key: (e: Employee) => K) => {
      const m = new Map<K, number>();
      rows.forEach((e) => m.set(key(e), (m.get(key(e)) ?? 0) + 1));
      return [...m.entries()].sort((a, b) => b[1] - a[1]);
    };
    return {
      headcount: rows.length,
      joiners,
      probation: rows.filter((e) => e.status === "Probation").length,
      notice: rows.filter((e) => e.status === "Notice Period").length,
      avgTenure,
      byType: by((e) => e.employmentType),
      byStatus: by((e) => e.status),
    };
  }, [rows, base, inRange]);

  const deptChart = React.useMemo(
    () =>
      departments
        .filter((d) => !d.archived)
        .map((d) => ({ name: d.code, full: d.name, value: rows.filter((e) => e.departmentId === d.id).length, color: `var(--${d.color})` }))
        .filter((d) => d.value > 0),
    [departments, rows],
  );

  const columns: ColumnDef<Employee, unknown>[] = [
    { id: "name", header: "Employee", accessorFn: (e) => `${e.firstName} ${e.lastName}`, cell: ({ row }) => <PersonCell size="sm" name={`${row.original.firstName} ${row.original.lastName}`} sub={row.original.id} src={row.original.avatar} seed={row.original.id} href={`/employees/${row.original.id}`} /> },
    { id: "department", header: "Department", accessorFn: (e) => lookups.deptName(e.departmentId), meta: { className: "hidden md:table-cell" } },
    { id: "designation", header: "Designation", accessorFn: (e) => lookups.desName(e.designationId), meta: { className: "hidden lg:table-cell" } },
    { id: "type", header: "Type", accessorKey: "employmentType", meta: { className: "hidden sm:table-cell" } },
    { id: "status", header: "Status", accessorKey: "status", cell: ({ getValue }) => <StatusBadge status={getValue() as string} /> },
    { id: "join", header: "Joined", accessorKey: "joinDate", meta: { className: "hidden md:table-cell" }, cell: ({ row }) => <span className="tabular">{formatDate(row.original.joinDate)}{inRange(row.original) && filters.range ? <span className="ml-1.5 text-xs text-primary">new</span> : null}</span> },
    { id: "tenure", header: "Tenure", accessorFn: (e) => tenureYears(e.joinDate), meta: { align: "right", className: "hidden xl:table-cell" }, cell: ({ getValue }) => `${(getValue() as number).toFixed(1)} yr` },
  ];

  const exportSpec = {
    title: "Employee Report",
    filenameBase: "employee-report",
    columns: ["Employee ID", "Name", "Email", "Department", "Designation", "Type", "Status", "Joined", "Tenure (yrs)"],
    rows: rows.map((e) => [e.id, `${e.firstName} ${e.lastName}`, e.email, lookups.deptName(e.departmentId), lookups.desName(e.designationId), e.employmentType, e.status, e.joinDate, tenureYears(e.joinDate).toFixed(1)]),
    numericColumns: [8],
    filters: [{ label: "Joiners range", value: rangeLabel(filters.range) }, ...baseSummary.filter((f) => f.label !== "Date range"), { label: "Show", value: scope === "all" ? "All active employees" : "Joiners in range" }],
    summary: [
      { label: "Headcount", value: String(totals.headcount) },
      { label: "Joiners in range", value: String(totals.joiners) },
      { label: "On probation", value: String(totals.probation) },
      { label: "Notice period", value: String(totals.notice) },
      { label: "Average tenure", value: `${totals.avgTenure.toFixed(1)} yrs` },
    ],
  };

  return (
    <ReportFrame permission="reports.hr" title="Employee Report" description="Active headcount by department, employment type and status, with joiners in the selected range." exportSpec={exportSpec}>
      <FilterBar filters={filters} update={update} reset={resetAll} rangePlaceholder="Joining date range">
        <MiniSelect label="Show" value={scope} onChange={(v) => setScope(v as "all" | "joiners")} options={[{ value: "all", label: "All active employees" }, { value: "joiners", label: "Joiners in range" }]} className="lg:w-48" />
      </FilterBar>
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={Users} title="No employees match these filters" description={scope === "joiners" ? "Nobody joined in the selected date range. Try a wider range or show all active employees." : "Clear the department, employee or search filters to see your headcount."} action={<Button variant="outline" size="sm" onClick={resetAll}>Reset filters</Button>} />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Headcount" icon={Users} value={totals.headcount} hint={`Avg tenure ${totals.avgTenure.toFixed(1)} yrs`} />
            <KpiCard label="Joiners in range" icon={UserPlus} tone="success" value={totals.joiners} hint={rangeLabel(filters.range)} />
            <KpiCard label="On probation" icon={Hourglass} tone="info" value={totals.probation} hint="Confirm before probation ends" />
            <KpiCard label="Notice period" icon={UserCheck} tone="warning" value={totals.notice} hint="Upcoming leavers" />
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <SectionCard className="lg:col-span-2" title="Headcount by department" description="Employees matching the filters">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={deptChart} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="name" {...axisProps} />
                  <YAxis {...axisProps} allowDecimals={false} width={40} />
                  <Tooltip content={<ChartTooltip labelFormatter={(l) => deptChart.find((d) => d.name === l)?.full ?? l} />} cursor={tooltipCursor} />
                  <Bar isAnimationActive={chartAnimation} dataKey="value" name="Employees" radius={[4, 4, 0, 0]} maxBarSize={48}>
                    {deptChart.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>
            <SectionCard title="Mix" description="Employment type and status">
              <div className="space-y-5">
                {[
                  { title: "Employment type", data: totals.byType },
                  { title: "Status", data: totals.byStatus },
                ].map((g) => (
                  <div key={g.title}>
                    <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{g.title}</p>
                    <ul className="space-y-2.5">
                      {g.data.map(([label, count]) => (
                        <li key={label}>
                          <div className="flex justify-between text-sm">
                            <span>{label}</span>
                            <span className="font-medium tabular">{count}</span>
                          </div>
                          <Progress value={(count / Math.max(1, totals.headcount)) * 100} className="mt-1 h-1.5" />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
          <Card>
            <div className="border-b border-border p-4">
              <h2 className="text-[15px] font-semibold tracking-tight">{scope === "joiners" ? "Joiners in range" : "Active employees"}</h2>
              <p className="text-[13px] text-muted-foreground">{rows.length} employees</p>
            </div>
            <DataTable label="Employee report" columns={columns} data={rows} getRowId={(e) => e.id} rowTestId={(e) => `report-row-${e.id}`} />
            <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-border bg-subtle px-5 py-3 text-sm tabular" data-testid="report-totals">
              <span className="font-medium">Totals</span>
              <span>{totals.headcount} employees</span>
              <span>{totals.joiners} joiners</span>
              <span>{totals.probation} on probation</span>
              <span>{totals.notice} on notice</span>
            </div>
          </Card>
        </>
      )}
    </ReportFrame>
  );
}
