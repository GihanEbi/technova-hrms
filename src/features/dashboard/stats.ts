// Dashboard figures, all derived from the live demo store.
import { addDays } from "date-fns";
import type { DemoData, Employee } from "@/types";
import { fromDateKey, toDateKey } from "@/lib/dates";
import { buildLeaveIndex, buildRecordIndex, describeDay, firstRecordedDay, resolveStatus } from "@/features/attendance/lib";

export interface DayCounts {
  key: string;
  working: boolean;
  label: string;
  present: number;
  late: number;
  absent: number;
  onLeave: number;
  notIn: number;
  total: number;
}

export function makeAttendanceCounter(data: DemoData, today: string) {
  const leaveOf = buildLeaveIndex(data.leaveRequests);
  const recordOf = buildRecordIndex(data.attendance);
  const dataStart = firstRecordedDay(data.attendance);
  return (employees: Employee[], key: string): DayCounts => {
    const day = describeDay(key, data.leaveSettings, data.holidays);
    const c: DayCounts = { key, working: day.working, label: day.label, present: 0, late: 0, absent: 0, onLeave: 0, notIn: 0, total: 0 };
    for (const e of employees) {
      if (e.joinDate > key) continue;
      c.total++;
      const s = resolveStatus({ key, today, day, record: recordOf(e.id, key), leave: leaveOf(e.id, key), joinDate: e.joinDate, dataStart });
      if (s === "Present" || s === "Half Day") c.present++;
      else if (s === "Late") c.late++;
      else if (s === "Absent") c.absent++;
      else if (s === "On Leave") c.onLeave++;
      else if (s === "Not clocked in") c.notIn++;
    }
    return c;
  };
}

/** The last `count` working days ending at (and including) `end`. */
export function lastWorkingDays(data: DemoData, end: string, count: number) {
  const out: string[] = [];
  let d = fromDateKey(end);
  for (let guard = 0; out.length < count && guard < count * 3; guard++) {
    const key = toDateKey(d);
    if (describeDay(key, data.leaveSettings, data.holidays).working) out.unshift(key);
    d = addDays(d, -1);
  }
  return out;
}

/** Days until the next occurrence of a yyyy-MM-dd anniversary (birthday / join date). */
export function daysUntilAnniversary(dateKey: string, today: Date) {
  const base = fromDateKey(dateKey);
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let next = new Date(t.getFullYear(), base.getMonth(), base.getDate());
  if (next < t) next = new Date(t.getFullYear() + 1, base.getMonth(), base.getDate());
  return { days: Math.round((next.getTime() - t.getTime()) / 86_400_000), date: next };
}
