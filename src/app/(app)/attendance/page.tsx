"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarOff, Clock, Search, TimerOff, UserCheck, UserX, Palmtree, AlarmClock, Users } from "lucide-react";
import { useHRStore } from "@/store/hr-store";
import { useAuth, useLookups } from "@/hooks/use-hr";
import { formatDate, formatTime, fromDateKey, minutesToHours, now, todayKey } from "@/lib/dates";
import { Card, Input } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/overlays";
import { DatePicker, Field } from "@/components/forms/fields";
import { DataTable } from "@/components/tables/data-table";
import { axisProps, ChartLegend, ChartTooltip, gridProps, tooltipCursor, chartAnimation } from "@/components/charts/chart-kit";
import { AccessDenied, EmptyState, FadeIn, KpiCard, ModuleTabs, PageHeader, PersonCell, SectionCard, StatusBadge } from "@/components/shared/common";
import type { Employee } from "@/types";
import {
  attendanceScope,
  attendanceTabs,
  buildLeaveIndex,
  buildRecordIndex,
  describeDay,
  firstRecordedDay,
  isAttendanceManager,
  recordMinutes,
  resolveStatus,
  type DayStatus,
} from "@/features/attendance/lib";

interface Row {
  employee: Employee;
  department: string;
  clockIn: string | null;
  clockOut: string | null;
  minutes: number;
  open: boolean;
  status: DayStatus;
}

const series = [
  { key: "present", label: "Present", color: "var(--chart-2)" },
  { key: "late", label: "Late", color: "var(--chart-3)" },
  { key: "absent", label: "Absent", color: "var(--chart-4)" },
  { key: "leave", label: "On leave", color: "var(--chart-5)" },
] as const;

export default function AttendanceOverviewPage() {
  const { role, employee: me } = useAuth();
  const employees = useHRStore((s) => s.data.employees);
  const departments = useHRStore((s) => s.data.departments);
  const attendance = useHRStore((s) => s.data.attendance);
  const leaveRequests = useHRStore((s) => s.data.leaveRequests);
  const settings = useHRStore((s) => s.data.leaveSettings);
  const holidays = useHRStore((s) => s.data.holidays);
  const corrections = useHRStore((s) => s.data.corrections);
  const lookups = useLookups();

  const today = todayKey();
  const [date, setDate] = React.useState(today);
  const [dept, setDept] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [query, setQuery] = React.useState("");
  const isTeamLead = role === "team_lead";

  const scope = React.useMemo(() => attendanceScope(role, me, employees), [role, me, employees]);
  const day = describeDay(date, settings, holidays);
  const dataStart = React.useMemo(() => firstRecordedDay(attendance), [attendance]);

  const rows = React.useMemo<Row[]>(() => {
    const rec = buildRecordIndex(attendance);
    const leaveOn = buildLeaveIndex(leaveRequests);
    const current = now();
    return scope
      .filter((e) => e.joinDate <= date)
      .filter((e) => dept === "all" || e.departmentId === dept)
      .map((e) => {
        const r = rec(e.id, date);
        return {
          employee: e,
          department: lookups.deptName(e.departmentId),
          clockIn: r?.clockIn ?? null,
          clockOut: r?.clockOut ?? null,
          minutes: recordMinutes(r, current),
          open: !!r?.clockIn && !r.clockOut && date === today,
          status: resolveStatus({ key: date, today, day, record: r, leave: leaveOn(e.id, date), joinDate: e.joinDate, dataStart }),
        };
      });
  }, [scope, attendance, leaveRequests, date, dept, lookups, today, day, dataStart]);

  const counts = React.useMemo(() => {
    const c = { present: 0, late: 0, absent: 0, leave: 0, notIn: 0 };
    rows.forEach((r) => {
      if (r.status === "Present" || r.status === "Half Day") c.present++;
      else if (r.status === "Late") c.late++;
      else if (r.status === "Absent") c.absent++;
      else if (r.status === "On Leave") c.leave++;
      else if (r.status === "Not clocked in") c.notIn++;
    });
    return c;
  }, [rows]);

  const chartData = React.useMemo(() => {
    const visibleDepts = departments.filter((d) => !d.archived && (dept === "all" || d.id === dept));
    return visibleDepts
      .map((d) => {
        const list = rows.filter((r) => r.employee.departmentId === d.id);
        return {
          name: d.code,
          fullName: d.name,
          present: list.filter((r) => r.status === "Present" || r.status === "Half Day").length,
          late: list.filter((r) => r.status === "Late").length,
          absent: list.filter((r) => r.status === "Absent").length,
          leave: list.filter((r) => r.status === "On Leave").length,
          total: list.length,
        };
      })
      .filter((d) => d.total > 0);
  }, [departments, rows, dept]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "all" && r.status !== status && !(status === "Present" && r.status === "Half Day")) return false;
      if (!q) return true;
      const e = r.employee;
      return [`${e.firstName} ${e.lastName}`, e.id, e.email, r.department].some((v) => v.toLowerCase().includes(q));
    });
  }, [rows, query, status]);

  const lateList = React.useMemo(
    () => rows.filter((r) => r.status === "Late" && r.clockIn).sort((a, b) => (b.clockIn ?? "").localeCompare(a.clockIn ?? "")),
    [rows],
  );
  const pendingCorrections = corrections.filter((c) => c.status === "Pending" && scope.some((e) => e.id === c.employeeId)).length;

  if (!isAttendanceManager(role)) return <AccessDenied />;

  const isToday = date === today;
  const expected = rows.filter((r) => r.status !== "Weekend" && r.status !== "Holiday" && r.status !== "No record").length;
  const rate = expected - counts.leave > 0 ? Math.round(((counts.present + counts.late) / (expected - counts.leave)) * 100) : 0;

  const columns: ColumnDef<Row, unknown>[] = [
    {
      id: "employee",
      header: "Employee",
      accessorFn: (r) => `${r.employee.firstName} ${r.employee.lastName}`,
      cell: ({ row }) => {
        const e = row.original.employee;
        return (
          <div className="max-w-40 min-w-0 sm:max-w-none">
            <PersonCell name={`${e.firstName} ${e.lastName}`} sub={`${e.id} · ${lookups.desName(e.designationId)}`} src={e.avatar} seed={e.id} />
          </div>
        );
      },
    },
    { accessorKey: "department", header: "Department", meta: { className: "hidden md:table-cell" } },
    {
      id: "clockIn",
      header: "Clock in",
      accessorFn: (r) => r.clockIn ?? "",
      cell: ({ row }) => <span className="tabular">{formatTime(row.original.clockIn)}</span>,
      meta: { className: "hidden sm:table-cell" },
    },
    {
      id: "clockOut",
      header: "Clock out",
      accessorFn: (r) => r.clockOut ?? "",
      cell: ({ row }) => (row.original.open ? <span className="text-xs text-muted-foreground">Working…</span> : <span className="tabular">{formatTime(row.original.clockOut)}</span>),
      meta: { className: "hidden sm:table-cell" },
    },
    {
      id: "worked",
      header: "Worked",
      accessorFn: (r) => r.minutes,
      cell: ({ row }) => <span className="tabular">{row.original.minutes ? minutesToHours(row.original.minutes) : "—"}</span>,
      meta: { align: "right", className: "hidden sm:table-cell" },
    },
    { id: "status", header: "Status", accessorFn: (r) => r.status, cell: ({ getValue }) => <StatusBadge status={getValue() as string} /> },
  ];

  return (
    <FadeIn>
      <PageHeader
        title="Attendance"
        description={isTeamLead ? `Daily attendance for the ${scope.length} people who report to you.` : `Daily attendance across ${scope.length} active employees.`}
        actions={
          <Button asChild variant="outline">
            <Link href="/attendance/corrections">
              <AlarmClock /> Corrections{pendingCorrections > 0 && <span className="rounded-full bg-warning-soft px-1.5 text-xs text-warning-soft-foreground tabular">{pendingCorrections}</span>}
            </Link>
          </Button>
        }
      />
      <ModuleTabs tabs={attendanceTabs(role)} />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field label="Date" htmlFor="attendance-date" className="sm:w-64">
          <DatePicker
            id="attendance-date"
            value={date}
            onChange={setDate}
            disabledDays={{ after: now() }}
          />
        </Field>
        {!isTeamLead && (
          <Field label="Department" htmlFor="attendance-dept" className="sm:w-56">
            <Select value={dept} onValueChange={setDept}>
              <SelectTrigger id="attendance-dept" aria-label="Filter by department">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {departments
                  .filter((d) => !d.archived)
                  .map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        {!isToday && (
          <Button variant="ghost" onClick={() => setDate(today)} className="self-start sm:self-auto">
            Back to today
          </Button>
        )}
        <p className="text-sm text-muted-foreground sm:ml-auto sm:pb-2">
          {formatDate(date, "EEEE, d MMMM yyyy")}
          {isToday && " · Live"}
        </p>
      </div>

      {!day.working ? (
        <Card>
          <EmptyState
            icon={CalendarOff}
            title={`No working day — ${day.label}`}
            description={
              day.kind === "holiday"
                ? `${formatDate(date, "d MMMM yyyy")} is a public holiday, so attendance isn't tracked.`
                : `Attendance is only recorded on working days (${settings.workingDays.length} days a week).`
            }
            action={
              <Button variant="outline" size="sm" onClick={() => setDate(today)}>
                Go to today
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <div className={`grid gap-4 sm:grid-cols-2 ${isToday ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
            <KpiCard label="Present" value={counts.present} icon={UserCheck} tone="success" hint={`${rate}% attendance rate`} testId="kpi-present" />
            <KpiCard label="Late" value={counts.late} icon={Clock} tone="warning" hint={`After ${settings.workdayStart} + ${settings.graceMinutes} min grace`} testId="kpi-late" />
            <KpiCard label="Absent" value={counts.absent} icon={UserX} tone="danger" hint={isToday ? "Marked absent today" : "No attendance recorded"} testId="kpi-absent" />
            <KpiCard label="On leave" value={counts.leave} icon={Palmtree} tone="info" hint="Approved leave" testId="kpi-leave" />
            {isToday && <KpiCard label="Not clocked in yet" value={counts.notIn} icon={TimerOff} tone="primary" hint="Expected today" testId="kpi-not-in" />}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <SectionCard title="Department attendance" description={`Headcount by status for ${formatDate(date, "d MMM yyyy")}.`} className="lg:col-span-2">
              {chartData.length === 0 ? (
                <EmptyState icon={Users} title="No employees in scope" description="Nobody in the selected department was employed on this date." />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barCategoryGap="28%">
                      <CartesianGrid {...gridProps} />
                      <XAxis dataKey="name" {...axisProps} />
                      <YAxis allowDecimals={false} {...axisProps} />
                      <Tooltip
                        cursor={tooltipCursor}
                        content={<ChartTooltip formatter={(v) => `${v} ${v === 1 ? "person" : "people"}`} labelFormatter={(l) => chartData.find((d) => d.name === l)?.fullName ?? l} />}
                      />
                      {series.map((s, i) => (
                        <Bar isAnimationActive={chartAnimation} key={s.key} dataKey={s.key} name={s.label} stackId="a" fill={s.color} radius={i === series.length - 1 ? [4, 4, 0, 0] : 0} maxBarSize={56} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                  <ChartLegend className="mt-3" items={series.map((s) => ({ label: s.label, color: s.color }))} />
                </>
              )}
            </SectionCard>

            <SectionCard title="Late arrivals" description={lateList.length ? `${lateList.length} late clock-in${lateList.length === 1 ? "" : "s"}` : "Everyone was on time"}>
              {lateList.length === 0 ? (
                <EmptyState icon={Clock} title="No late arrivals" description="All clock-ins were within the grace period." className="py-8" />
              ) : (
                <ul className="divide-y divide-border">
                  {lateList.slice(0, 6).map((r) => (
                    <li key={r.employee.id} className="flex items-center justify-between gap-3 py-2.5">
                      <PersonCell size="sm" name={`${r.employee.firstName} ${r.employee.lastName}`} sub={r.department} src={r.employee.avatar} seed={r.employee.id} />
                      <span className="shrink-0 text-sm font-medium text-warning-soft-foreground tabular">{formatTime(r.clockIn)}</span>
                    </li>
                  ))}
                  {lateList.length > 6 && <li className="pt-2.5 text-xs text-muted-foreground">+{lateList.length - 6} more in the table below</li>}
                </ul>
              )}
            </SectionCard>
          </div>

          <Card className="mt-6">
            <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 sm:mr-2">
                <h2 className="text-[15px] font-semibold tracking-tight">Daily attendance</h2>
                <p className="text-[13px] text-muted-foreground">{formatDate(fromDateKey(date), "EEE, d MMM yyyy")}</p>
              </div>
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, ID or department…" className="pl-9" aria-label="Search employees" />
              </div>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="sm:w-44" aria-label="Filter by status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="Present">Present</SelectItem>
                  <SelectItem value="Late">Late</SelectItem>
                  <SelectItem value="Absent">Absent</SelectItem>
                  <SelectItem value="On Leave">On leave</SelectItem>
                  {isToday && <SelectItem value="Not clocked in">Not clocked in</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <DataTable
              label="Daily attendance"
              columns={columns}
              data={filtered}
              getRowId={(r) => r.employee.id}
              rowTestId={(r) => `attendance-row-${r.employee.id}`}
              initialSorting={[{ id: "employee", desc: false }]}
              emptyTitle="No matching employees"
              emptyDescription="Try a different search term or status filter."
            />
          </Card>
        </>
      )}
    </FadeIn>
  );
}
