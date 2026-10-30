// Attendance helpers shared by the attendance pages, the clock widget and the calendars.
import { addDays, endOfMonth, format, startOfMonth, startOfWeek } from "date-fns";
import type { AttendanceRecord, AttendanceStatus, Employee, Holiday, LeaveRequest, LeaveSettings, Role } from "@/types";
import { fromDateKey, toDateKey, workedMinutes } from "@/lib/dates";
import { canAccessRoute } from "@/lib/permissions";

export interface DayInfo {
  key: string;
  working: boolean;
  kind: "working" | "weekend" | "holiday";
  /** Weekday name for weekends, holiday name for holidays. */
  label: string;
}

export function describeDay(key: string, settings: LeaveSettings, holidays: Holiday[]): DayInfo {
  const d = fromDateKey(key);
  const holiday = holidays.find((h) => h.date === key);
  if (holiday) return { key, working: false, kind: "holiday", label: holiday.name };
  if (!settings.workingDays.includes(d.getDay())) return { key, working: false, kind: "weekend", label: format(d, "EEEE") };
  return { key, working: true, kind: "working", label: "Working day" };
}

export type DayStatus = AttendanceStatus | "Not clocked in" | "Weekend" | "Holiday" | "Upcoming" | "No record" | "Not employed";

/** Index of approved leave per employee, for quick "on leave that day" lookups. */
export function buildLeaveIndex(requests: LeaveRequest[]) {
  const map = new Map<string, LeaveRequest[]>();
  for (const r of requests) {
    if (r.status !== "Approved") continue;
    const list = map.get(r.employeeId) ?? [];
    list.push(r);
    map.set(r.employeeId, list);
  }
  return (employeeId: string, key: string) => map.get(employeeId)?.find((r) => r.startDate <= key && r.endDate >= key);
}

/** Index of attendance records by employee + date. */
export function buildRecordIndex(records: AttendanceRecord[]) {
  const map = new Map<string, AttendanceRecord>();
  for (const r of records) map.set(`${r.employeeId}|${r.date}`, r);
  return (employeeId: string, key: string) => map.get(`${employeeId}|${key}`);
}

/** Earliest date with any attendance data — days before it have no history to show. */
export function firstRecordedDay(records: AttendanceRecord[]) {
  return records.reduce<string | null>((min, r) => (min === null || r.date < min ? r.date : min), null);
}

/**
 * Effective attendance status for one employee on one day.
 * Past working days with no record count as absent (inside the recorded range),
 * today without a record is "Not clocked in".
 */
export function resolveStatus(args: {
  key: string;
  today: string;
  day: DayInfo;
  record: AttendanceRecord | undefined;
  leave: LeaveRequest | undefined;
  joinDate: string;
  dataStart: string | null;
}): DayStatus {
  const { key, today, day, record, leave, joinDate, dataStart } = args;
  if (key < joinDate) return "Not employed";
  if (!day.working) {
    if (record?.clockIn) return record.status;
    return day.kind === "holiday" ? "Holiday" : "Weekend";
  }
  if (record) return record.status;
  if (leave) return leave.halfDay ? "Half Day" : "On Leave";
  if (key > today) return "Upcoming";
  if (key === today) return "Not clocked in";
  if (dataStart && key < dataStart) return "No record";
  return "Absent";
}

export function recordMinutes(record: AttendanceRecord | undefined, current: Date) {
  if (!record?.clockIn) return 0;
  if (record.clockOut) return workedMinutes(record.clockIn, record.clockOut);
  // Still working today — count up to now
  if (record.date === toDateKey(current)) return workedMinutes(record.clockIn, current.toISOString());
  return 0;
}

/** Visual tone for each status, used by calendar cells, dots and legends. */
export const statusTone: Record<string, { dot: string; cell: string; label: string }> = {
  Present: { dot: "bg-success", cell: "bg-success-soft text-success-soft-foreground", label: "Present" },
  Late: { dot: "bg-warning", cell: "bg-warning-soft text-warning-soft-foreground", label: "Late" },
  Absent: { dot: "bg-destructive", cell: "bg-destructive-soft text-destructive-soft-foreground", label: "Absent" },
  "On Leave": { dot: "bg-info", cell: "bg-info-soft text-info-soft-foreground", label: "On leave" },
  "Half Day": { dot: "bg-primary", cell: "bg-primary-soft text-primary-soft-foreground", label: "Half day" },
  "Not clocked in": { dot: "bg-muted-foreground/50", cell: "bg-muted text-muted-foreground", label: "Not clocked in" },
};

/** Weeks (Monday first) covering the month that contains `month`. */
export function monthMatrix(month: Date) {
  const first = startOfMonth(month);
  const last = endOfMonth(month);
  let cursor = startOfWeek(first, { weekStartsOn: 1 });
  const weeks: Date[][] = [];
  while (cursor <= last) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) week.push(addDays(cursor, i));
    weeks.push(week);
    cursor = addDays(cursor, 7);
  }
  return weeks;
}

export const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Attendance module tabs, filtered to the routes the role can open. */
export function attendanceTabs(role: Role) {
  return [
    { href: "/attendance", label: "Overview", exact: true },
    { href: "/attendance/calendar", label: "Calendar" },
    { href: "/attendance/corrections", label: "Corrections" },
    { href: "/attendance/my", label: "My Attendance" },
  ].filter((t) => canAccessRoute(role, t.href));
}

export function isAttendanceManager(role: Role) {
  return role === "admin" || role === "hr_manager" || role === "team_lead";
}

/** Employees a manager may see in attendance views: Admin/HR everyone active, Team Lead direct reports. */
export function attendanceScope(role: Role, me: Employee, employees: Employee[]) {
  const active = employees.filter((e) => !e.archived);
  if (role === "team_lead") return active.filter((e) => e.managerId === me.id);
  if (role === "admin" || role === "hr_manager") return active;
  return active.filter((e) => e.id === me.id);
}
