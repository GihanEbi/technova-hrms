// Leave helpers shared by the leave pages.
import type { Employee, Holiday, LeaveRequest, LeaveSettings, LeaveType, Role } from "@/types";
import { canAccessRoute } from "@/lib/permissions";
import { formatDate, workingDaysBetween } from "@/lib/dates";

export function leaveColor(type: Pick<LeaveType, "color"> | undefined) {
  return type ? `var(--${type.color})` : "var(--muted-foreground)";
}

/** Leave module tabs, filtered to the routes the role can open. */
export function leaveTabs(role: Role) {
  const manager = role === "admin" || role === "hr_manager" || role === "team_lead";
  return [
    { href: "/leave", label: "Overview", exact: true, hidden: !manager },
    { href: "/leave/requests", label: "Requests", hidden: !manager },
    { href: "/leave/calendar", label: "Calendar" },
    { href: "/leave/my", label: "My Leave" },
    { href: "/leave/policies", label: "Policies" },
  ].filter((t) => !t.hidden && canAccessRoute(role, t.href));
}

export function isLeaveManager(role: Role) {
  return role === "admin" || role === "hr_manager" || role === "team_lead";
}

/** Employees whose requests a manager can see: Admin/HR everyone, Team Lead direct reports. */
export function leaveApprovalScope(role: Role, me: Employee, employees: Employee[]) {
  const active = employees.filter((e) => !e.archived);
  if (role === "admin" || role === "hr_manager") return active;
  if (role === "team_lead") return active.filter((e) => e.managerId === me.id);
  return [];
}

/** People shown on the team leave calendar. */
export function calendarScope(role: Role, me: Employee, employees: Employee[]) {
  const active = employees.filter((e) => !e.archived);
  if (role === "admin" || role === "hr_manager") return active;
  if (role === "team_lead") return active.filter((e) => e.managerId === me.id || e.id === me.id);
  // Employees: teammates with the same manager, plus themselves
  return active.filter((e) => e.id === me.id || (me.managerId !== null && e.managerId === me.managerId));
}

export function coversDay(r: LeaveRequest, key: string) {
  return r.startDate <= key && r.endDate >= key;
}

/** Working leave days of a request that fall inside [from, to]. */
export function daysWithin(r: LeaveRequest, from: string, to: string, settings: LeaveSettings, holidays: Holiday[]) {
  const s = r.startDate > from ? r.startDate : from;
  const e = r.endDate < to ? r.endDate : to;
  if (e < s) return 0;
  if (r.halfDay) return 0.5;
  return workingDaysBetween(s, e, settings, holidays).length;
}

export function formatDays(n: number) {
  return `${Number.isInteger(n) ? n : n.toFixed(1)} day${n === 1 ? "" : "s"}`;
}


export function formatRange(start: string, end: string) {
  if (start === end) return formatDate(start, "d MMM yyyy");
  if (start.slice(0, 4) === end.slice(0, 4)) {
    if (start.slice(0, 7) === end.slice(0, 7)) return `${formatDate(start, "d")} – ${formatDate(end, "d MMM yyyy")}`;
    return `${formatDate(start, "d MMM")} – ${formatDate(end, "d MMM yyyy")}`;
  }
  return `${formatDate(start, "d MMM yyyy")} – ${formatDate(end, "d MMM yyyy")}`;
}
