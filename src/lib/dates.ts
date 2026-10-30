import {
  addDays,
  differenceInCalendarDays,
  differenceInMinutes,
  eachDayOfInterval,
  format,
  isAfter,
  isBefore,
  parseISO,
  startOfDay,
} from "date-fns";
import type { Holiday, LeaveSettings } from "@/types";

/** Current time. Centralised so the whole app reads the clock the same way. */
export function now() {
  return new Date();
}

export function todayKey() {
  return toDateKey(now());
}

export function toDateKey(d: Date) {
  return format(d, "yyyy-MM-dd");
}

/** Parse a yyyy-MM-dd key as a local date (not UTC). */
export function fromDateKey(key: string) {
  return parseISO(key);
}

export function periodKey(d: Date) {
  return format(d, "yyyy-MM");
}

export function periodLabel(period: string) {
  return format(parseISO(`${period}-01`), "MMMM yyyy");
}

export function shortPeriodLabel(period: string) {
  return format(parseISO(`${period}-01`), "MMM yy");
}

export function formatDate(value: string | Date | null | undefined, pattern = "d MMM yyyy") {
  if (!value) return "—";
  const d = typeof value === "string" ? parseISO(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, pattern);
}

export function formatTime(value: string | null | undefined) {
  if (!value) return "—";
  return format(parseISO(value), "hh:mm a");
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return format(parseISO(value), "d MMM yyyy, hh:mm a");
}

export function relativeTime(value: string) {
  const d = parseISO(value);
  const mins = differenceInMinutes(now(), d);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = differenceInCalendarDays(now(), d);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return format(d, "d MMM");
}

export function minutesToHours(mins: number) {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export function workedMinutes(clockIn: string | null, clockOut: string | null) {
  if (!clockIn || !clockOut) return 0;
  return Math.max(0, differenceInMinutes(parseISO(clockOut), parseISO(clockIn)));
}

export function isHoliday(key: string, holidays: Holiday[]) {
  return holidays.some((h) => h.date === key);
}

export function isWorkingDay(d: Date, settings: LeaveSettings, holidays: Holiday[]) {
  return settings.workingDays.includes(d.getDay()) && !isHoliday(toDateKey(d), holidays);
}

export function workingDaysBetween(start: string, end: string, settings: LeaveSettings, holidays: Holiday[]) {
  const s = fromDateKey(start);
  const e = fromDateKey(end);
  if (isAfter(s, e)) return [] as string[];
  return eachDayOfInterval({ start: s, end: e })
    .filter((d) => isWorkingDay(d, settings, holidays))
    .map(toDateKey);
}

export function workingDaysInPeriod(period: string, settings: LeaveSettings, holidays: Holiday[]) {
  const start = parseISO(`${period}-01`);
  const end = addDays(new Date(start.getFullYear(), start.getMonth() + 1, 1), -1);
  return workingDaysBetween(toDateKey(start), toDateKey(end), settings, holidays);
}

/** Combine a yyyy-MM-dd key with HH:mm into a local ISO timestamp. */
export function combineDateTime(dateKey: string, hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = fromDateKey(dateKey);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

export function timeOf(iso: string | null) {
  if (!iso) return "";
  return format(parseISO(iso), "HH:mm");
}

export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return !(aEnd < bStart || bEnd < aStart);
}

export function isPastDay(key: string) {
  return isBefore(fromDateKey(key), startOfDay(now()));
}

export { addDays, differenceInCalendarDays, format, parseISO, startOfDay };
