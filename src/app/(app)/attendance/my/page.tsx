"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { CalendarCheck, Clock, Hourglass, Palmtree, PencilLine, Timer, UserX } from "lucide-react";
import { useHRStore } from "@/store/hr-store";
import { useAuth } from "@/hooks/use-hr";
import { eachDayOfInterval, endOfMonth, startOfMonth, subMonths } from "date-fns";
import { format, formatDate, formatTime, minutesToHours, now, periodKey, periodLabel, parseISO, relativeTime, toDateKey } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { AttendanceCorrection } from "@/types";
import { Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/overlays";
import { DataTable } from "@/components/tables/data-table";
import { FadeIn, ModuleTabs, PageHeader, SectionCard, StatusBadge } from "@/components/shared/common";
import { ClockCard } from "@/features/attendance/clock-card";
import { CorrectionDialog } from "@/features/attendance/correction-dialog";
import { to12h } from "@/features/attendance/review-correction-dialog";
import {
  attendanceTabs,
  buildLeaveIndex,
  buildRecordIndex,
  describeDay,
  firstRecordedDay,
  recordMinutes,
  resolveStatus,
  type DayStatus,
} from "@/features/attendance/lib";

interface HistoryRow {
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  minutes: number;
  status: DayStatus;
  note: string;
  correctable: boolean;
}

export default function MyAttendancePage() {
  const { role, employee: me } = useAuth();
  const attendance = useHRStore((s) => s.data.attendance);
  const leaveRequests = useHRStore((s) => s.data.leaveRequests);
  const settings = useHRStore((s) => s.data.leaveSettings);
  const holidays = useHRStore((s) => s.data.holidays);
  const corrections = useHRStore((s) => s.data.corrections);

  const current = now();
  const today = toDateKey(current);
  const thisPeriod = periodKey(current);
  const [period, setPeriod] = React.useState(thisPeriod);
  const [dialog, setDialog] = React.useState<{ open: boolean; date?: string }>({ open: false });
  const tabs = attendanceTabs(role);

  const months = React.useMemo(() => Array.from({ length: 6 }, (_, i) => periodKey(subMonths(startOfMonth(now()), i))), []);
  const dataStart = React.useMemo(() => firstRecordedDay(attendance), [attendance]);

  const buildRows = React.useCallback(
    (p: string): HistoryRow[] => {
      const rec = buildRecordIndex(attendance);
      const leaveOn = buildLeaveIndex(leaveRequests);
      const start = parseISO(`${p}-01`);
      const end = endOfMonth(start);
      const last = end > current ? current : end;
      if (start > last) return [];
      return eachDayOfInterval({ start, end: last })
        .map((d) => {
          const key = toDateKey(d);
          const day = describeDay(key, settings, holidays);
          const r = rec(me.id, key);
          const leave = leaveOn(me.id, key);
          const status = resolveStatus({ key, today, day, record: r, leave, joinDate: me.joinDate, dataStart });
          return {
            date: key,
            clockIn: r?.clockIn ?? null,
            clockOut: r?.clockOut ?? null,
            minutes: recordMinutes(r, current),
            status,
            note: day.kind === "holiday" ? day.label : r?.source === "Correction" ? "Corrected" : leave ? (leave.halfDay ? "Half-day leave" : "Approved leave") : "",
            correctable: day.working && key >= me.joinDate && status !== "On Leave",
          };
        })
        .filter((r) => r.status !== "Weekend" && r.status !== "Not employed")
        .reverse();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [attendance, leaveRequests, settings, holidays, me.id, me.joinDate, today, dataStart],
  );

  const history = React.useMemo(() => buildRows(period), [buildRows, period]);
  const monthRows = React.useMemo(() => (period === thisPeriod ? history : buildRows(thisPeriod)), [buildRows, history, period, thisPeriod]);

  const summary = React.useMemo(() => {
    const s = { present: 0, late: 0, absent: 0, leave: 0, minutes: 0, worked: 0 };
    monthRows.forEach((r) => {
      if (r.status === "Present" || r.status === "Half Day") s.present++;
      if (r.status === "Late") s.late++;
      if (r.status === "Absent") s.absent++;
      if (r.status === "On Leave" || r.status === "Half Day") s.leave += r.status === "Half Day" ? 0.5 : 1;
      if (r.clockIn && r.clockOut) {
        s.minutes += r.minutes;
        s.worked++;
      }
    });
    return s;
  }, [monthRows]);

  const myCorrections = React.useMemo(() => corrections.filter((c) => c.employeeId === me.id), [corrections, me.id]);
  const pendingDates = new Set(myCorrections.filter((c) => c.status === "Pending").map((c) => c.date));

  const historyColumns: ColumnDef<HistoryRow, unknown>[] = [
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ row }) => (
        <div>
          <p className="font-medium tabular">{formatDate(row.original.date, "EEE, d MMM")}</p>
          {row.original.note && <p className="max-w-24 truncate text-xs text-muted-foreground sm:max-w-none" title={row.original.note}>{row.original.note}</p>}
        </div>
      ),
    },
    { id: "in", header: "In", accessorFn: (r) => r.clockIn ?? "", cell: ({ row }) => <span className="tabular">{formatTime(row.original.clockIn)}</span> },
    {
      id: "out",
      header: "Out",
      accessorFn: (r) => r.clockOut ?? "",
      cell: ({ row }) =>
        row.original.clockIn && !row.original.clockOut && row.original.date === today ? (
          <span className="text-xs text-muted-foreground">Working…</span>
        ) : (
          <span className="tabular">{formatTime(row.original.clockOut)}</span>
        ),
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
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      meta: { align: "right", className: "hidden md:table-cell" },
      cell: ({ row }) => {
        const r = row.original;
        if (!r.correctable) return null;
        if (pendingDates.has(r.date)) return <span className="text-xs text-muted-foreground">Correction pending</span>;
        return (
          <Button variant="ghost" size="sm" onClick={() => setDialog({ open: true, date: r.date })} aria-label={`Correct ${formatDate(r.date, "d MMM yyyy")}`}>
            <PencilLine /> Correct
          </Button>
        );
      },
    },
  ];

  const correctionColumns: ColumnDef<AttendanceCorrection, unknown>[] = [
    { accessorKey: "id", header: "Request", cell: ({ getValue }) => <span className="font-mono text-xs text-muted-foreground">{getValue() as string}</span>, meta: { className: "hidden sm:table-cell" } },
    { accessorKey: "date", header: "Date", cell: ({ getValue }) => <span className="tabular">{formatDate(getValue() as string, "EEE, d MMM")}</span> },
    {
      id: "requested",
      header: "Requested",
      accessorFn: (c) => c.clockIn,
      cell: ({ row }) => (
        <span className="tabular whitespace-nowrap">
          {to12h(row.original.clockIn)} – {to12h(row.original.clockOut)}
        </span>
      ),
    },
    {
      accessorKey: "reason",
      header: "Reason",
      cell: ({ row }) => (
        <div className="max-w-64">
          <p className="truncate" title={row.original.reason}>
            {row.original.reason}
          </p>
          {row.original.reviewerComment && <p className="truncate text-xs text-muted-foreground">Reviewer: {row.original.reviewerComment}</p>}
        </div>
      ),
      meta: { className: "hidden md:table-cell" },
    },
    { accessorKey: "createdAt", header: "Submitted", cell: ({ getValue }) => <span className="tabular text-muted-foreground">{relativeTime(getValue() as string)}</span>, meta: { className: "hidden lg:table-cell" } },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusBadge status={getValue() as string} /> },
  ];

  const avg = summary.worked ? summary.minutes / summary.worked : 0;
  const stats = [
    { label: "Present", value: summary.present, icon: CalendarCheck, tone: "text-success" },
    { label: "Late", value: summary.late, icon: Clock, tone: "text-warning" },
    { label: "Absent", value: summary.absent, icon: UserX, tone: "text-destructive" },
    { label: "Leave", value: summary.leave, icon: Palmtree, tone: "text-info" },
    { label: "Total hours", value: minutesToHours(summary.minutes), icon: Timer, tone: "text-primary" },
    { label: "Avg hours / day", value: minutesToHours(avg), icon: Hourglass, tone: "text-primary" },
  ];

  return (
    <FadeIn>
      <PageHeader
        title="My Attendance"
        description="Clock in and out, review your history and request corrections."
        actions={
          <Button variant="outline" onClick={() => setDialog({ open: true })}>
            <PencilLine /> Request correction
          </Button>
        }
      />
      {tabs.length > 1 && <ModuleTabs tabs={tabs} />}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ClockCard employeeId={me.id} />
        <SectionCard title={`This month · ${format(current, "MMMM yyyy")}`} description="Summary of working days so far this month." className="lg:col-span-2">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {stats.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="rounded-lg border border-border bg-subtle px-4 py-3" data-testid={`my-stat-${s.label.toLowerCase().replace(/[^a-z]+/g, "-")}`}>
                  <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Icon className={cn("size-3.5", s.tone)} />
                    {s.label}
                  </dt>
                  <dd className="mt-1.5 text-xl font-semibold tracking-tight tabular">{s.value}</dd>
                </div>
              );
            })}
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">
            Workday {settings.workdayStart}–{settings.workdayEnd} · clock-ins more than {settings.graceMinutes} minutes after {settings.workdayStart} are marked late.
          </p>
        </SectionCard>
      </div>

      <Card className="mt-6">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight">Attendance history</h2>
            <p className="text-[13px] text-muted-foreground">{periodLabel(period)} · {history.length} day{history.length === 1 ? "" : "s"}</p>
          </div>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="sm:w-48" aria-label="Month">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m} value={m}>
                  {periodLabel(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DataTable
          label="Attendance history"
          columns={historyColumns}
          data={history}
          getRowId={(r) => r.date}
          rowTestId={(r) => `history-row-${r.date}`}
          emptyTitle="No attendance in this month"
          emptyDescription="There are no working days recorded for the selected month."
        />
      </Card>

      <Card className="mt-6">
        <div className="border-b border-border p-4">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight">My correction requests</h2>
            <p className="text-[13px] text-muted-foreground">
              {myCorrections.filter((c) => c.status === "Pending").length} pending · {myCorrections.length} total
            </p>
          </div>
        </div>
        <DataTable
          label="My correction requests"
          columns={correctionColumns}
          data={myCorrections}
          getRowId={(c) => c.id}
          rowTestId={(c) => `my-correction-${c.id}`}
          pageSize={5}
          emptyTitle="No correction requests yet"
          emptyDescription="If you forgot to clock in or out, request a correction and your manager will review it."
        />
      </Card>

      <CorrectionDialog open={dialog.open} initialDate={dialog.date} onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))} employeeId={me.id} />
    </FadeIn>
  );
}
