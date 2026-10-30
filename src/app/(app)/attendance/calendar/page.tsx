"use client";

import * as React from "react";
import { addMonths, isSameMonth, startOfMonth, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useHRStore } from "@/store/hr-store";
import { useAuth, useLookups } from "@/hooks/use-hr";
import { format, formatTime, minutesToHours, now, timeOf, toDateKey } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Field, SearchableSelect } from "@/components/forms/fields";
import { AccessDenied, EmptyState, FadeIn, ModuleTabs, PageHeader, PersonCell, SectionCard } from "@/components/shared/common";
import {
  attendanceScope,
  attendanceTabs,
  buildLeaveIndex,
  buildRecordIndex,
  describeDay,
  firstRecordedDay,
  isAttendanceManager,
  monthMatrix,
  recordMinutes,
  resolveStatus,
  statusTone,
  weekdayLabels,
  type DayStatus,
} from "@/features/attendance/lib";

const legend: { label: string; cls: string }[] = [
  { label: "Present", cls: statusTone.Present.dot },
  { label: "Late", cls: statusTone.Late.dot },
  { label: "Absent", cls: statusTone.Absent.dot },
  { label: "On leave", cls: statusTone["On Leave"].dot },
  { label: "Half day", cls: statusTone["Half Day"].dot },
  { label: "Holiday", cls: "bg-info/40" },
  { label: "Weekend", cls: "bg-muted-foreground/30" },
];

export default function AttendanceCalendarPage() {
  const { role, employee: me } = useAuth();
  const employees = useHRStore((s) => s.data.employees);
  const attendance = useHRStore((s) => s.data.attendance);
  const leaveRequests = useHRStore((s) => s.data.leaveRequests);
  const settings = useHRStore((s) => s.data.leaveSettings);
  const holidays = useHRStore((s) => s.data.holidays);
  const lookups = useLookups();

  const scope = React.useMemo(() => attendanceScope(role, me, employees).sort((a, b) => a.id.localeCompare(b.id)), [role, me, employees]);
  const [employeeId, setEmployeeId] = React.useState<string>(() => scope[0]?.id ?? me.id);
  const [month, setMonth] = React.useState(() => startOfMonth(now()));
  const selected = scope.find((e) => e.id === employeeId) ?? scope[0];

  const today = toDateKey(now());
  const dataStart = React.useMemo(() => firstRecordedDay(attendance), [attendance]);
  const weeks = React.useMemo(() => monthMatrix(month), [month]);

  const cells = React.useMemo(() => {
    if (!selected) return new Map<string, { status: DayStatus; clockIn: string | null; clockOut: string | null; minutes: number; holiday?: string }>();
    const rec = buildRecordIndex(attendance);
    const leaveOn = buildLeaveIndex(leaveRequests);
    const current = now();
    const map = new Map<string, { status: DayStatus; clockIn: string | null; clockOut: string | null; minutes: number; holiday?: string }>();
    weeks.flat().forEach((d) => {
      const key = toDateKey(d);
      const day = describeDay(key, settings, holidays);
      const r = rec(selected.id, key);
      map.set(key, {
        status: resolveStatus({ key, today, day, record: r, leave: leaveOn(selected.id, key), joinDate: selected.joinDate, dataStart }),
        clockIn: r?.clockIn ?? null,
        clockOut: r?.clockOut ?? null,
        minutes: recordMinutes(r, current),
        holiday: day.kind === "holiday" ? day.label : undefined,
      });
    });
    return map;
  }, [selected, attendance, leaveRequests, weeks, settings, holidays, today, dataStart]);

  const summary = React.useMemo(() => {
    const s: Record<string, number> = { Present: 0, Late: 0, Absent: 0, "On Leave": 0, "Half Day": 0 };
    let minutes = 0;
    weeks.flat().forEach((d) => {
      if (!isSameMonth(d, month)) return;
      const c = cells.get(toDateKey(d));
      if (!c) return;
      if (c.status in s) s[c.status]++;
      minutes += c.clockOut ? c.minutes : 0;
    });
    return { counts: s, minutes };
  }, [cells, weeks, month]);

  if (!isAttendanceManager(role)) return <AccessDenied />;

  const options = scope.map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName}`, description: `${e.id} · ${lookups.deptName(e.departmentId)}` }));
  const monthHolidays = holidays.filter((h) => h.date.startsWith(format(month, "yyyy-MM")));
  const isCurrentMonth = isSameMonth(month, now());

  return (
    <FadeIn>
      <PageHeader title="Attendance calendar" description="Month view of an employee's attendance, leave and holidays." />
      <ModuleTabs tabs={attendanceTabs(role)} />

      {!selected ? (
        <Card>
          <EmptyState title="No employees in scope" description="There's nobody whose attendance you can view yet." />
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <Card className="min-w-0">
            <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-end sm:justify-between">
              <Field label="Employee" htmlFor="calendar-employee" className="sm:w-72">
                <SearchableSelect id="calendar-employee" value={selected.id} onChange={(v) => v && setEmployeeId(v)} options={options} searchPlaceholder="Search employees…" />
              </Field>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon-sm" aria-label="Previous month" onClick={() => setMonth((m) => subMonths(m, 1))}>
                  <ChevronLeft />
                </Button>
                <p className="min-w-32 text-center text-sm font-semibold tabular" aria-live="polite" data-testid="calendar-month">
                  {format(month, "MMMM yyyy")}
                </p>
                <Button variant="outline" size="icon-sm" aria-label="Next month" onClick={() => setMonth((m) => addMonths(m, 1))}>
                  <ChevronRight />
                </Button>
                {!isCurrentMonth && (
                  <Button variant="ghost" size="sm" onClick={() => setMonth(startOfMonth(now()))}>
                    Today
                  </Button>
                )}
              </div>
            </div>

            <div className="p-2 sm:p-4" data-testid="attendance-calendar">
              <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                {weekdayLabels.map((w) => (
                  <div key={w} aria-hidden className="pb-1 text-center text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    <span className="sm:hidden">{w[0]}</span>
                    <span className="hidden sm:inline">{w}</span>
                  </div>
                ))}
                {weeks.flat().map((d) => {
                  const key = toDateKey(d);
                  const c = cells.get(key);
                  const inMonth = isSameMonth(d, month);
                  const isToday = key === today;
                  const weekend = c?.status === "Weekend";
                  const holiday = !!c?.holiday;
                  const tone = c ? statusTone[c.status] : undefined;
                  const label = `${format(d, "EEE d MMM")}: ${c?.holiday ?? c?.status ?? ""}${c?.clockIn ? `, in ${formatTime(c.clockIn)}` : ""}${c?.clockOut ? `, out ${formatTime(c.clockOut)}` : ""}`;
                  return (
                    <div
                      key={key}
                      title={label}
                      data-date={key}
                      data-status={c?.status}
                      className={cn(
                        "relative flex min-h-12 min-w-0 flex-col rounded-md border border-border p-1 text-left sm:min-h-24 sm:p-2",
                        weekend && "bg-muted/60",
                        holiday && "border-info/30 bg-info-soft/60",
                        !inMonth && "opacity-40",
                        isToday && "ring-2 ring-primary ring-offset-1 ring-offset-surface",
                      )}
                    >
                      <span className="sr-only">{label}</span>
                      <div className="flex items-center justify-between gap-1" aria-hidden>
                        <span className={cn("text-xs font-medium tabular sm:text-sm", isToday && "font-semibold text-primary")}>{format(d, "d")}</span>
                        {tone && <span className={cn("size-2 shrink-0 rounded-full", tone.dot)} aria-hidden />}
                      </div>
                      {inMonth && c && (
                        <div className="mt-auto hidden min-w-0 sm:block" aria-hidden>
                          {holiday ? (
                            <p className="line-clamp-2 text-[11px] leading-tight text-info-soft-foreground">{c.holiday}</p>
                          ) : tone ? (
                            <>
                              <span className={cn("inline-block max-w-full truncate rounded px-1.5 py-0.5 text-[11px] font-medium", tone.cell)}>{tone.label}</span>
                              {c.clockIn && (
                                <p className="mt-1 truncate text-[11px] text-muted-foreground tabular">
                                  {timeOf(c.clockIn)}–{c.clockOut ? timeOf(c.clockOut) : "now"}
                                </p>
                              )}
                            </>
                          ) : null}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 px-1 text-xs text-muted-foreground" aria-label="Legend">
                {legend.map((l) => (
                  <li key={l.label} className="flex items-center gap-1.5">
                    <span className={cn("size-2.5 rounded-full", l.cls)} />
                    {l.label}
                  </li>
                ))}
                <li className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full ring-2 ring-primary" />
                  Today
                </li>
              </ul>
            </div>
          </Card>

          <div className="space-y-6">
            <SectionCard title={format(month, "MMMM yyyy")} description="Monthly summary">
              <div className="mb-4">
                <PersonCell name={`${selected.firstName} ${selected.lastName}`} sub={`${lookups.desName(selected.designationId)} · ${lookups.deptName(selected.departmentId)}`} src={selected.avatar} seed={selected.id} href={`/employees/${selected.id}`} />
              </div>
              <dl className="space-y-2 text-sm">
                {(["Present", "Late", "Absent", "On Leave", "Half Day"] as const).map((k) => (
                  <div key={k} className="flex items-center justify-between gap-3">
                    <dt className="flex items-center gap-2 text-muted-foreground">
                      <span className={cn("size-2 rounded-full", statusTone[k].dot)} />
                      {statusTone[k].label}
                    </dt>
                    <dd className="font-medium tabular">{summary.counts[k]}</dd>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
                  <dt className="text-muted-foreground">Hours worked</dt>
                  <dd className="font-medium tabular">{minutesToHours(summary.minutes)}</dd>
                </div>
              </dl>
            </SectionCard>
            <SectionCard title="Holidays this month">
              {monthHolidays.length === 0 ? (
                <p className="text-sm text-muted-foreground">No public holidays in {format(month, "MMMM")}.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {monthHolidays.map((h) => (
                    <li key={h.date} className="flex items-start justify-between gap-3">
                      <span>{h.name}</span>
                      <span className="shrink-0 text-muted-foreground tabular">{format(new Date(`${h.date}T00:00:00`), "EEE d")}</span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>
        </div>
      )}
    </FadeIn>
  );
}
