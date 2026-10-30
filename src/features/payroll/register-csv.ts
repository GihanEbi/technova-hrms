import type { Employee, PayrollRun } from "@/types";
import { downloadBlob, toCsv } from "@/lib/utils";
import { payslipId } from "@/lib/payroll";

/** Downloads the full per-employee register for one payroll run. */
export function downloadRunRegister(run: PayrollRun, employees: Employee[], deptName: (id: string) => string) {
  const emp = new Map(employees.map((e) => [e.id, e]));
  const headers = [
    "Payslip ID", "Employee ID", "Name", "Department", "Working days", "Basic", "Transport", "Meal", "Other allowances", "Overtime", "Bonus",
    "Gross", "EPF employee", "APIT", "Loan", "Other deductions", "Unpaid leave days", "Unpaid leave deduction", "Total deductions", "Net",
    "EPF employer", "ETF", "Status", "Warnings",
  ];
  const rows = run.items.map((i) => {
    const e = emp.get(i.employeeId);
    return [
      payslipId(run, i.employeeId), i.employeeId, e ? `${e.firstName} ${e.lastName}` : i.employeeId, e ? deptName(e.departmentId) : "", i.workingDays,
      i.basic, i.transportAllowance, i.mealAllowance, i.otherAllowance, i.overtimePay, i.bonus, i.gross, i.epfEmployee, i.apit, i.loanDeduction,
      i.otherDeduction, i.unpaidLeaveDays, i.unpaidLeaveDeduction, i.totalDeductions, i.net, i.epfEmployer, i.etfEmployer, run.status, i.warnings.join(" | "),
    ];
  });
  downloadBlob(toCsv(headers, rows), `payroll-register-${run.period}.csv`, "text/csv");
  return rows.length;
}
