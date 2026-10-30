// Deterministic payroll calculation engine (illustrative — not a compliance engine).
import { parseISO } from "date-fns";
import type {
  AttendanceRecord,
  Employee,
  Holiday,
  LeaveRequest,
  LeaveSettings,
  PayrollItem,
  PayrollRun,
  PayrollSettings,
  SalaryStructure,
  TaxBracket,
} from "@/types";
import { round2 } from "./utils";
import { workingDaysBetween, workingDaysInPeriod } from "./dates";

export function calculateApit(taxable: number, brackets: TaxBracket[]) {
  let remaining = taxable;
  let lower = 0;
  let tax = 0;
  for (const b of brackets) {
    const ceiling = b.upTo ?? Infinity;
    const band = Math.max(0, Math.min(remaining, ceiling - lower));
    tax += (band * b.rate) / 100;
    remaining -= band;
    lower = ceiling;
    if (remaining <= 0) break;
  }
  return round2(tax);
}

export interface PayrollContext {
  period: string;
  settings: PayrollSettings;
  leaveSettings: LeaveSettings;
  holidays: Holiday[];
  leaveRequests: LeaveRequest[];
  attendance: AttendanceRecord[];
}

export function periodBounds(period: string) {
  const start = parseISO(`${period}-01`);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    start: `${period}-01`,
    end: `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`,
  };
}

/** Employees eligible for a payroll period: joined on/before period end and not archived. */
export function eligibleEmployees(employees: Employee[], period: string) {
  const { end } = periodBounds(period);
  return employees.filter((e) => !e.archived && e.joinDate <= end);
}

export function calculatePayrollItem(
  employee: Employee,
  salary: SalaryStructure | undefined,
  ctx: PayrollContext,
): PayrollItem {
  const { start, end } = periodBounds(ctx.period);
  const periodDays = workingDaysInPeriod(ctx.period, ctx.leaveSettings, ctx.holidays);
  const workingDays = periodDays.length || 1;
  const warnings: string[] = [];

  if (!salary) {
    return {
      employeeId: employee.id,
      basic: 0, transportAllowance: 0, mealAllowance: 0, otherAllowance: 0, overtimePay: 0, bonus: 0,
      gross: 0, epfEmployee: 0, epfEmployer: 0, etfEmployer: 0, apit: 0, loanDeduction: 0, otherDeduction: 0,
      unpaidLeaveDeduction: 0, unpaidLeaveDays: 0, totalDeductions: 0, net: 0, workingDays,
      warnings: ["No salary structure assigned — net salary is zero."],
    };
  }

  // Proration for mid-period joiners
  let basic = salary.basic;
  let fixedFactor = 1;
  if (employee.joinDate > start && employee.joinDate <= end) {
    const worked = workingDaysBetween(employee.joinDate, end, ctx.leaveSettings, ctx.holidays).length;
    fixedFactor = worked / workingDays;
    basic = round2(salary.basic * fixedFactor);
    warnings.push(`Joined mid-period — pay prorated for ${worked} of ${workingDays} working days.`);
  }

  // Unpaid leave in this period (approved only)
  const unpaidLeaveDays = ctx.leaveRequests
    .filter((l) => l.employeeId === employee.id && l.typeId === "unpaid" && l.status === "Approved")
    .reduce((sum, l) => {
      if (l.halfDay) return l.startDate >= start && l.startDate <= end ? sum + 0.5 : sum;
      const s = l.startDate < start ? start : l.startDate;
      const e = l.endDate > end ? end : l.endDate;
      if (s > e) return sum;
      return sum + workingDaysBetween(s, e, ctx.leaveSettings, ctx.holidays).length;
    }, 0);

  const dailyRate = salary.basic / workingDays;
  const unpaidLeaveDeduction = round2(dailyRate * unpaidLeaveDays);
  if (unpaidLeaveDays > 0) warnings.push(`${unpaidLeaveDays} unpaid leave day(s) deducted.`);

  const transportAllowance = round2(salary.transportAllowance * fixedFactor);
  const mealAllowance = round2(salary.mealAllowance * fixedFactor);
  const otherAllowance = round2(salary.otherAllowance * fixedFactor);
  const hourly = salary.basic / ctx.settings.standardMonthlyHours;
  const overtimePay = round2(hourly * ctx.settings.overtimeMultiplier * salary.overtimeHours);
  const bonus = round2(salary.bonus);

  const gross = round2(basic + transportAllowance + mealAllowance + otherAllowance + overtimePay + bonus);
  const epfBase = Math.max(0, basic - unpaidLeaveDeduction);
  const epfEmployee = round2((epfBase * ctx.settings.epfEmployeeRate) / 100);
  const epfEmployer = round2((epfBase * ctx.settings.epfEmployerRate) / 100);
  const etfEmployer = round2((epfBase * ctx.settings.etfRate) / 100);
  const apit = ctx.settings.apitEnabled
    ? calculateApit(Math.max(0, gross - unpaidLeaveDeduction), ctx.settings.apitBrackets)
    : 0;
  const loanDeduction = round2(salary.loanDeduction);
  const otherDeduction = round2(salary.otherDeduction);
  const totalDeductions = round2(epfEmployee + apit + loanDeduction + otherDeduction + unpaidLeaveDeduction);
  const net = round2(gross - totalDeductions);

  // Unexplained absences recorded in attendance for the period
  const absences = ctx.attendance.filter(
    (a) => a.employeeId === employee.id && a.status === "Absent" && a.date >= start && a.date <= end,
  ).length;
  if (absences >= 3) warnings.push(`${absences} unexplained absences recorded — verify before processing.`);
  if (gross > 0 && totalDeductions / gross > 0.4) warnings.push("Deductions exceed 40% of gross pay.");
  if (net < ctx.settings.lowNetThreshold) warnings.push("Net pay is below the low-pay review threshold.");

  return {
    employeeId: employee.id,
    basic,
    transportAllowance,
    mealAllowance,
    otherAllowance,
    overtimePay,
    bonus,
    gross,
    epfEmployee,
    epfEmployer,
    etfEmployer,
    apit,
    loanDeduction,
    otherDeduction,
    unpaidLeaveDeduction,
    unpaidLeaveDays,
    totalDeductions,
    net,
    workingDays,
    warnings,
  };
}

export function generatePayrollItems(employees: Employee[], salaries: SalaryStructure[], ctx: PayrollContext) {
  return eligibleEmployees(employees, ctx.period)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((e) => calculatePayrollItem(e, salaries.find((s) => s.employeeId === e.id), ctx));
}

export function runTotals(items: PayrollItem[]) {
  const sum = (k: keyof PayrollItem) => round2(items.reduce((s, i) => s + (i[k] as number), 0));
  return {
    employees: items.length,
    gross: sum("gross"),
    net: sum("net"),
    deductions: sum("totalDeductions"),
    allowances: round2(sum("transportAllowance") + sum("mealAllowance") + sum("otherAllowance")),
    basic: sum("basic"),
    overtime: sum("overtimePay"),
    bonus: sum("bonus"),
    epfEmployee: sum("epfEmployee"),
    epfEmployer: sum("epfEmployer"),
    etf: sum("etfEmployer"),
    apit: sum("apit"),
    employerCost: round2(sum("gross") + sum("epfEmployer") + sum("etfEmployer")),
    warnings: items.reduce((s, i) => s + i.warnings.length, 0),
  };
}

export function payslipId(run: PayrollRun, employeeId: string) {
  return `PS-${run.period}-${employeeId}`;
}

export function parsePayslipId(id: string) {
  const m = /^PS-(\d{4}-\d{2})-(EMP-\d+)$/.exec(id);
  return m ? { period: m[1], employeeId: m[2] } : null;
}

export const defaultApitBrackets: TaxBracket[] = [
  { upTo: 150000, rate: 0 },
  { upTo: 233333, rate: 6 },
  { upTo: 275000, rate: 18 },
  { upTo: 316667, rate: 24 },
  { upTo: 358333, rate: 30 },
  { upTo: null, rate: 36 },
];
