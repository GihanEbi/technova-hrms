"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { AlarmClock, CalendarCheck, Clock, UserX } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useHRStore } from "@/store/hr-store";
import { useLookups } from "@/hooks/use-hr";
import { addDays, formatDate, minutesToHours, now, toDateKey, workedMinutes } from "@/lib/dates";
import { round2 } from "@/lib/utils";
import type { AttendanceStatus, Employee } from "@/types";
import { Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/tables/data-table";
import { EmptyState, KpiCard, PersonCell, SectionCard } from "@/components/shared/common";
import { axisProps, ChartLegend, ChartTooltip, chartColors, gridProps, tooltipCursor, chartAnimation } from "@/components/charts/chart-kit";
import { FilterBar, matches, ReportFrame, useFilterSummary, useReportFilters } from "@/features/reports/report-kit";

const statuses: { key: AttendanceStatus; color: string }[] = [
  { key: "Present", color: chartColors[1] },
  { key: "Late", color: chartColors[2] },
  { key: "Half Day", color: chartColors[4] },
  { key: "On Leave", color: chartColors[0] },
  { key: "Absent", color: chartColors[3] },
];

interface Row {
  employee: Employee;
  name: string;
  department: string;
  present: number;
  late: number;
  halfDay: number;
  onLeave: number;
  absent: number;
  rate: number;
  avgMinutes: number;
}

export default function AttendanceReportPage() {
  const attendance = useHRStore((s) => s.data.attendance);
  const employees = useHRStore((s) => s.data.employees);
  const lookups = useLookups();
  const [defaultRange] = React.useState(() => ({ from: toDateKey(addDays(now(), -29)), to: toDateKey(now()) }));
  const { filters, update, reset } = useReportFilters(defaultRange);
  const filterSummary = useFilterSummary(filters);

  const scopedEmployees = React.useMemo(
    () =>
      employees.filter(
        (e) =>
          !e.archived &&
          (filters.dept === "all" || e.departmentId === filters.dept) &&
          (!filters.employeeId || e.id === filters.employeeId) &&
          matches(filters.query, `${e.firstName} ${e.lastName}`, e.id, lookups.deptName(e.departmentId)),
      ),
    [employees, filters, lookups],
  );

  const records = React.useMemo(() => {
    const ids = new Set(scopedEmployees.map((e) => e.id));
    return attendance.filter((a) => ids.has(a.employeeId) && (!filters.range || (a.date >= filters.range.from && a.date <= filters.range.to)));
  }, [attendance, scopedEmployees, filters.range]);

  const rows = React.useMemo<Row[]>(() => {
    const by = new Map<string, typeof records>();
    records.forEach((r) => (by.get(r.employeeId) ?? by.set(r.employeeId, []).get(r.employeeId)!).push(r));
    return scopedEmployees
      .filter((e) => by.has(e.id))
      .map((e) => {
        const list = by.get(e.id)!;
        const count = (s: AttendanceStatus) => list.filter((r) => r.status === s).length;
        const worked = list.filter((r) => r.clockIn && r.clockOut);
        const mins = worked.reduce((s, r) => s + workedMinutes(r.clockIn, r.clockOut), 0);
        const onLeave = count("On Leave");
        const attended = count("Present") + count("Late") + count("Half Day");
        const expected = list.length - onLeave;
        return {
          employee: e,
          name: `${e.firstName} ${e.lastName}`,
          department: lookups.deptName(e.departmentId),
          present: count("Present"),
          late: count("Late"),
          halfDay: count("Half Day"),
          onLeave,
          absent: count("Absent"),
          rate: expected ? round2((attended / expected) * 100) : 100,
          avgMinutes: worked.length ? mins / worked.length : 0,
        };
      })
      .sort((a, b) => a.employee.id.localeCompare(b.employee.id));
  }, [records, scopedEmployees, lookups]);

  const totals = React.useMemo(() => {
    const c = (s: AttendanceStatus) => records.filter((r) => r.status === s).length;
    const onLeave = c("On Leave");
    const attended = c("Present") + c("Late") + c("Half Day");
    const worked = records.filter((r) => r.clockIn && r.clockOut);
    const mins = worked.reduce((s, r) => s + workedMinutes(r.clockIn, r.clockOut), 0);
    return {
      records: records.length,
      rate: records.length - onLeave ? (attended / (records.length - onLeave)) * 100 : 0,
      late: c("Late"),
      absent: c("Absent"),
      onLeave,
      present: c("Present"),
      halfDay: c("Half Day"),
      avg: worked.length ? mins / worked.length : 0,
    };
  }, [records]);

  const chart = React.useMemo(() => {
    const days = new Map<string, Record<string, number | string>>();
    records.forEach((r) => {
      const d = days.get(r.date) ?? { date: r.date, label: formatDate(r.date, "d MMM") };
      d[r.status] = ((d[r.status] as number) ?? 0) + 1;
      days.set(r.date, d);
    });
    return [...days.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [records]);

  const columns: ColumnDef<Row, unknown>[] = [
    { id: "employee", header: "Employee", accessorFn: (r) => r.name, cell: ({ row }) => <PersonCell size="sm" name={row.original.name} sub={row.original.employee.id} src={row.original.employee.avatar} seed={row.original.employee.id} /> },
    { id: "department", header: "Department", accessorFn: (r) => r.department, meta: { className: "hidden lg:table-cell" } },
    { id: "present", header: "Present", accessorKey: "present", meta: { align: "right", className: "hidden sm:table-cell" } },
    { id: "late", header: "Late", accessorKey: "late", meta: { align: "right" } },
    { id: "halfDay", header: "Half day", accessorKey: "halfDay", meta: { align: "right", className: "hidden md:table-cell" } },
    { id: "onLeave", header: "On leave", accessorKey: "onLeave", meta: { align: "right", className: "hidden md:table-cell" } },
    { id: "absent", header: "Absent", accessorKey: "absent", meta: { align: "right" }, cell: ({ getValue }) => <span className={(getValue() as number) >= 3 ? "font-medium text-destructive" : ""}>{getValue() as number}</span> },
    { id: "rate", header: "Rate", accessorKey: "rate", meta: { align: "right" }, cell: ({ getValue }) => `${(getValue() as number).toFixed(1)}%` },
    { id: "avg", header: "Avg hours", accessorKey: "avgMinutes", meta: { align: "right", className: "hidden lg:table-cell" }, cell: ({ getValue }) => ((getValue() as number) ? minutesToHours(getValue() as number) : "—") },
  ];

  const exportSpec = {
    title: "Attendance Report",
    filenameBase: "attendance-report",
    columns: ["Employee ID", "Name", "Department", "Present", "Late", "Half day", "On leave", "Absent", "Attendance rate %", "Avg hours"],
    rows: rows.map((r) => [r.employee.id, r.name, r.department, r.present, r.late, r.halfDay, r.onLeave, r.absent, r.rate.toFixed(1), r.avgMinutes ? minutesToHours(r.avgMinutes) : "-"]),
    numericColumns: [3, 4, 5, 6, 7, 8, 9],
    filters: filterSummary,
    summary: [
      { label: "Records", value: String(totals.records) },
      { label: "Attendance rate", value: `${totals.rate.toFixed(1)}%` },
      { label: "Late arrivals", value: String(totals.late) },
      { label: "Absences", value: String(totals.absent) },
      { label: "On leave", value: String(totals.onLeave) },
      { label: "Avg hours / day", value: totals.avg ? minutesToHours(totals.avg) : "-" },
    ],
  };

  return (
    <ReportFrame permission="reports.hr" title="Attendance Report" description="Daily attendance, punctuality and absences from live clock-in records." exportSpec={exportSpec}>
      <FilterBar filters={filters} update={update} reset={reset} />
      {records.length === 0 ? (
        <Card>
          <EmptyState
            icon={CalendarCheck}
            title="No attendance records match these filters"
            description="Attendance is recorded for the last 30 days in this demo. Widen the date range or clear the department, employee or search filters."
            action={<Button variant="outline" size="sm" onClick={reset}>Reset filters</Button>}
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Attendance rate" icon={CalendarCheck} tone="success" value={`${totals.rate.toFixed(1)}%`} hint={`${totals.records} records · excl. leave`} />
            <KpiCard label="Late arrivals" icon={AlarmClock} tone="warning" value={totals.late} hint={`${totals.records ? ((totals.late / totals.records) * 100).toFixed(1) : 0}% of records`} />
            <KpiCard label="Absences" icon={UserX} tone="danger" value={totals.absent} hint={`${totals.onLeave} days on approved leave`} />
            <KpiCard label="Avg hours worked" icon={Clock} tone="info" value={totals.avg ? minutesToHours(totals.avg) : "—"} hint="Per completed day" />
          </div>
          <SectionCard title="Daily attendance" description="Employees by status per working day" action={<ChartLegend items={statuses.map((s) => ({ label: s.key, color: s.color }))} />}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chart} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="label" {...axisProps} minTickGap={16} />
                <YAxis {...axisProps} allowDecimals={false} width={40} />
                <Tooltip content={<ChartTooltip />} cursor={tooltipCursor} />
                {statuses.map((s, i) => (
                  <Bar isAnimationActive={chartAnimation} key={s.key} dataKey={s.key} name={s.key} stackId="a" fill={s.color} maxBarSize={22} radius={i === statuses.length - 1 ? [3, 3, 0, 0] : 0} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>
          <Card>
            <div className="border-b border-border p-4">
              <h2 className="text-[15px] font-semibold tracking-tight">By employee</h2>
              <p className="text-[13px] text-muted-foreground">{rows.length} employees · {totals.records} attendance records</p>
            </div>
            <DataTable label="Attendance by employee" columns={columns} data={rows} getRowId={(r) => r.employee.id} pageSize={20} rowTestId={(r) => `report-row-${r.employee.id}`} />
            <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-border bg-subtle px-5 py-3 text-sm tabular" data-testid="report-totals">
              <span className="font-medium">Totals</span>
              <span>Present {totals.present}</span>
              <span>Late {totals.late}</span>
              <span>Half day {totals.halfDay}</span>
              <span>On leave {totals.onLeave}</span>
              <span>Absent {totals.absent}</span>
              <span>Rate {totals.rate.toFixed(1)}%</span>
            </div>
          </Card>
        </>
      )}
    </ReportFrame>
  );
}
