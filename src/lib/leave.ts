import type { Holiday, LeaveRequest, LeaveSettings, LeaveType, LeaveTypeId } from "@/types";
import { rangesOverlap, workingDaysBetween } from "./dates";

export function calculateLeaveDays(
  startDate: string,
  endDate: string,
  halfDay: boolean,
  settings: LeaveSettings,
  holidays: Holiday[],
) {
  if (!startDate || !endDate || endDate < startDate) return 0;
  const days = workingDaysBetween(startDate, endDate, settings, holidays).length;
  if (halfDay) return days > 0 ? 0.5 : 0;
  return days;
}

export interface LeaveBalance {
  type: LeaveType;
  allocation: number;
  used: number;
  pending: number;
  available: number; // Infinity for unlimited
}

export function leaveBalances(
  employeeId: string,
  types: LeaveType[],
  requests: LeaveRequest[],
  year: number,
): LeaveBalance[] {
  return types
    .filter((t) => t.active)
    .map((type) => {
      const mine = requests.filter(
        (r) => r.employeeId === employeeId && r.typeId === type.id && r.startDate.startsWith(String(year)),
      );
      const used = mine.filter((r) => r.status === "Approved").reduce((s, r) => s + r.days, 0);
      const pending = mine.filter((r) => r.status === "Pending").reduce((s, r) => s + r.days, 0);
      const available = type.allocation === 0 ? Infinity : Math.max(0, type.allocation - used - pending);
      return { type, allocation: type.allocation, used, pending, available };
    });
}

export function balanceFor(balances: LeaveBalance[], typeId: LeaveTypeId) {
  return balances.find((b) => b.type.id === typeId);
}

export function findOverlap(employeeId: string, start: string, end: string, requests: LeaveRequest[], ignoreId?: string) {
  return requests.find(
    (r) =>
      r.employeeId === employeeId &&
      r.id !== ignoreId &&
      (r.status === "Pending" || r.status === "Approved") &&
      rangesOverlap(start, end, r.startDate, r.endDate),
  );
}

export interface LeaveValidation {
  ok: boolean;
  days: number;
  error?: string;
  warning?: string;
}

export function validateLeave(args: {
  employeeId: string;
  typeId: LeaveTypeId;
  startDate: string;
  endDate: string;
  halfDay: boolean;
  types: LeaveType[];
  requests: LeaveRequest[];
  settings: LeaveSettings;
  holidays: Holiday[];
}): LeaveValidation {
  const { employeeId, typeId, startDate, endDate, halfDay, types, requests, settings, holidays } = args;
  const type = types.find((t) => t.id === typeId);
  if (!type) return { ok: false, days: 0, error: "Select a leave type." };
  if (!startDate || !endDate) return { ok: false, days: 0, error: "Select the start and end dates." };
  if (endDate < startDate) return { ok: false, days: 0, error: "End date cannot be before the start date." };
  if (halfDay && startDate !== endDate) return { ok: false, days: 0, error: "Half-day leave must start and end on the same day." };
  const days = calculateLeaveDays(startDate, endDate, halfDay, settings, holidays);
  if (days === 0) return { ok: false, days, error: "The selected dates contain no working days." };
  if (type.maxConsecutive > 0 && days > type.maxConsecutive)
    return { ok: false, days, error: `${type.name} allows at most ${type.maxConsecutive} consecutive days.` };
  const overlap = findOverlap(employeeId, startDate, endDate, requests);
  if (overlap) return { ok: false, days, error: `These dates overlap with request ${overlap.id} (${overlap.status}).` };
  const balance = balanceFor(leaveBalances(employeeId, types, requests, Number(startDate.slice(0, 4))), typeId);
  if (balance && balance.available !== Infinity && days > balance.available)
    return { ok: false, days, error: `Insufficient balance — ${balance.available} day(s) available.` };
  let warning: string | undefined;
  if (type.requiresAttachmentAfter > 0 && days > type.requiresAttachmentAfter)
    warning = `A supporting document is recommended for ${type.name.toLowerCase()} longer than ${type.requiresAttachmentAfter} day(s).`;
  return { ok: true, days, warning };
}
