"use client";

import * as React from "react";
import { addMonths, endOfMonth, isSameMonth, startOfMonth, subMonths } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useHRStore } from "@/store/hr-store";
import { useAuth, useLookups } from "@/hooks/use-hr";
import { format, now, toDateKey } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { LeaveRequest } from "@/types";
import { Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/overlays";
import { EmptyState, FadeIn, ModuleTabs, PageHeader, PersonCell } from "@/components/shared/common";
import { describeDay, monthMatrix, weekdayLabels } from "@/features/attendance/lib";
import { calendarScope, coversDay, formatRange, leaveColor, leaveTabs } from "@/features/leave/lib";

const MAX_CHIPS = 3;

export default function LeaveCalendarPage() {
  const { role, employee: me } = useAuth();
  const employees = useHRStore((s) => s.data.employees);
  const departments = useHRStore((s) => s.data.departments);
  const leaveRequests = useHRStore((s) => s.data.leaveRequests);
  const leaveTypes = useHRStore((s) => s.data.leaveTypes);
  const settings = useHRStore((s) => s.data.leaveSettings);
  const holidays = useHRStore((s) => s.data.holidays);
  const lookups = useLookups();
  const tabs = leaveTabs(role);
  const companyWide = can(role, "leave.viewAll");

  const [month, setMonth] = React.useState(() => startOfMonth(now()));
  const [dept, setDept] = React.useState("all");
  const today = toDateKey(now());

  const people = React.useMemo(
    () => calendarScope(role, me, employees).filter((e) => !companyWide || dept === "all" || e.departmentId === dept),
    [role, me, employees, companyWide, dept],
  );
  const ids = React.useMemo(() => new Set(people.map((p) => p.id)), [people]);
  const weeks = React.useMemo(() => monthMatrix(month), [month]);
  const gridStart = toDateKey(weeks[0][0]);
  const gridEnd = toDateKey(weeks[weeks.length - 1][6]);

  const visible = React.useMemo(
    () =>
      leaveRequests
        .filter((r) => ids.has(r.employeeId) && (r.status === "Approved" || r.status === "Pending") && r.startDate <= gridEnd && r.endDate >= gridStart)
        .sort((a, b) => (a.status === b.status ? a.startDate.localeCompare(b.startDate) : a.status === "Approved" ? -1 : 1)),
    [leaveRequests, ids, gridStart, gridEnd],
  );

  const onDay = React.useCallback(
    (key: string) => {
      const d = describeDay(key, settings, holidays);
      if (!d.working) return [] as LeaveRequest[];
      return visible.filter((r) => coversDay(r, key));
    },
    [visible, settings, holidays],
  );

  const typeOf = (id: string) => leaveTypes.find((t) => t.id === id);
  const firstName = (id: string) => {
    const e = lookups.employee(id);
    return e ? `${e.firstName} ${e.lastName[0]}.` : id;
  };
  const chipTitle = (r: LeaveRequest) => `${lookups.name(r.employeeId)} · ${typeOf(r.typeId)?.name} · ${formatRange(r.startDate, r.endDate)} (${r.status})`;

  const monthDays = weeks.flat().filter((d) => isSameMonth(d, month));
  const listDays = monthDays
    .map((d) => {
      const key = toDateKey(d);
      return { key, date: d, info: describeDay(key, settings, holidays), items: onDay(key) };
    })
    .filter((d) => d.items.length > 0 || d.info.kind === "holiday");
  const monthLeaveCount = visible.filter((r) => r.startDate <= toDateKey(endOfMonth(month)) && r.endDate >= toDateKey(month)).length;
  const isCurrentMonth = isSameMonth(month, now());

  const scopeLabel = companyWide ? (dept === "all" ? "Whole company" : lookups.deptName(dept)) : role === "team_lead" ? "You and your direct reports" : "You and your teammates";

  return (
    <FadeIn>
      <PageHeader title="Leave calendar" description={`${scopeLabel} · approved and pending leave, public holidays and weekends.`} />
      {tabs.length > 1 && <ModuleTabs tabs={tabs} />}

      <Card className="min-w-0">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon-sm" aria-label="Previous month" onClick={() => setMonth((m) => subMonths(m, 1))}>
              <ChevronLeft />
            </Button>
            <p className="min-w-32 text-center text-sm font-semibold tabular" aria-live="polite" data-testid="leave-calendar-month">
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <p className="text-[13px] text-muted-foreground">
              {monthLeaveCount} request{monthLeaveCount === 1 ? "" : "s"} · {people.length} people
            </p>
            {companyWide && (
              <Select value={dept} onValueChange={setDept}>
                <SelectTrigger className="sm:w-52" aria-label="Filter by department">
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
            )}
          </div>
        </div>

        <div data-testid="leave-calendar" className="p-2 sm:p-4">
          {/* Desktop / tablet: month grid */}
          <div className="hidden grid-cols-7 gap-1.5 md:grid">
            {weekdayLabels.map((w) => (
              <div key={w} aria-hidden className="pb-1 text-center text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                {w}
              </div>
            ))}
            {weeks.flat().map((d) => {
              const key = toDateKey(d);
              const info = describeDay(key, settings, holidays);
              const items = onDay(key);
              const inMonth = isSameMonth(d, month);
              const isToday = key === today;
              return (
                <div
                  key={key}
                  data-date={key}
                  className={cn(
                    "flex min-h-28 min-w-0 flex-col gap-1 rounded-md border border-border p-1.5",
                    info.kind === "weekend" && "bg-muted/60",
                    info.kind === "holiday" && "border-info/30 bg-info-soft/60",
                    !inMonth && "opacity-40",
                    isToday && "ring-2 ring-primary ring-offset-1 ring-offset-surface",
                  )}
                >
                  <span className={cn("px-0.5 text-xs font-medium tabular", isToday && "font-semibold text-primary")}>
                    {format(d, "d")}
                    {isToday && <span className="sr-only"> (today)</span>}
                  </span>
                  {info.kind === "holiday" && <p className="line-clamp-2 px-0.5 text-[11px] leading-tight text-info-soft-foreground">{info.label}</p>}
                  {items.slice(0, MAX_CHIPS).map((r) => (
                    <LeaveChip key={r.id} request={r} color={leaveColor(typeOf(r.typeId))} label={firstName(r.employeeId)} title={chipTitle(r)} />
                  ))}
                  {items.length > MAX_CHIPS && (
                    <p className="px-0.5 text-[11px] font-medium text-muted-foreground" title={items.slice(MAX_CHIPS).map(chipTitle).join("\n")}>
                      +{items.length - MAX_CHIPS} more
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Mobile: list of days with leave */}
          <div className="md:hidden">
            {listDays.length === 0 ? (
              <EmptyState icon={CalendarDays} title="No leave this month" description="Nobody in this view has approved or pending leave." />
            ) : (
              <ul className="divide-y divide-border">
                {listDays.map((d) => (
                  <li key={d.key} className={cn("flex gap-3 py-3", d.key === today && "rounded-md bg-primary-soft/50 px-2")}>
                    <div className="w-11 shrink-0 text-center">
                      <p className="text-[11px] font-medium text-muted-foreground uppercase">{format(d.date, "EEE")}</p>
                      <p className={cn("text-lg font-semibold tabular", d.key === today && "text-primary")}>{format(d.date, "d")}</p>
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      {d.info.kind === "holiday" && <p className="text-sm font-medium text-info-soft-foreground">{d.info.label}</p>}
                      {d.items.map((r) => (
                        <div key={r.id} className="flex items-center justify-between gap-2">
                          <PersonCell size="sm" name={lookups.name(r.employeeId)} sub={`${typeOf(r.typeId)?.name} · ${formatRange(r.startDate, r.endDate)}`} seed={r.employeeId} src={lookups.employee(r.employeeId)?.avatar} />
                          <span
                            className={cn("size-2.5 shrink-0 rounded-full", r.status === "Pending" && "border-2 bg-transparent")}
                            style={r.status === "Pending" ? { borderColor: leaveColor(typeOf(r.typeId)) } : { background: leaveColor(typeOf(r.typeId)) }}
                            aria-label={r.status}
                          />
                        </div>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 px-1 text-xs text-muted-foreground" aria-label="Legend">
            {leaveTypes
              .filter((t) => t.active)
              .map((t) => (
                <li key={t.id} className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full" style={{ background: leaveColor(t) }} />
                  {t.name}
                </li>
              ))}
            <li className="flex items-center gap-1.5">
              <span className="h-2.5 w-4 rounded-sm bg-muted-foreground/60" /> Approved
            </li>
            <li className="flex items-center gap-1.5">
              <span className="h-2.5 w-4 rounded-sm border border-dashed border-muted-foreground" /> Pending
            </li>
            <li className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-info/40" /> Holiday
            </li>
            <li className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-muted-foreground/30" /> Weekend
            </li>
          </ul>
        </div>
      </Card>
    </FadeIn>
  );
}

function LeaveChip({ request, color, label, title }: { request: LeaveRequest; color: string; label: string; title: string }) {
  const pending = request.status === "Pending";
  return (
    <span
      title={title}
      data-status={request.status}
      className={cn("block truncate rounded px-1.5 py-0.5 text-[11px] font-medium leading-4", pending ? "border border-dashed text-foreground" : "text-foreground")}
      style={
        pending
          ? { borderColor: color, background: `repeating-linear-gradient(135deg, transparent 0 4px, color-mix(in oklab, ${color} 14%, transparent) 4px 8px)` }
          : { background: `color-mix(in oklab, ${color} 22%, transparent)`, boxShadow: `inset 3px 0 0 ${color}` }
      }
    >
      <span className="sr-only">{title}</span>
      <span aria-hidden>{label}</span>
    </span>
  );
}
