import type { Role } from "@/types";

export type Permission =
  | "dashboard.org"
  | "employees.view"
  | "employees.manage"
  | "departments.manage"
  | "salary.view"
  | "attendance.viewAll"
  | "attendance.viewTeam"
  | "attendance.approve"
  | "leave.viewAll"
  | "leave.approve"
  | "leave.policies"
  | "payroll.view"
  | "payroll.process"
  | "performance.viewAll"
  | "performance.manage"
  | "reports.hr"
  | "reports.payroll"
  | "settings.organization"
  | "settings.payroll";

const matrix: Record<Role, Permission[]> = {
  admin: [
    "dashboard.org",
    "employees.view",
    "employees.manage",
    "departments.manage",
    "salary.view",
    "attendance.viewAll",
    "attendance.viewTeam",
    "attendance.approve",
    "leave.viewAll",
    "leave.approve",
    "leave.policies",
    "payroll.view",
    "payroll.process",
    "performance.viewAll",
    "performance.manage",
    "reports.hr",
    "reports.payroll",
    "settings.organization",
    "settings.payroll",
  ],
  hr_manager: [
    "dashboard.org",
    "employees.view",
    "employees.manage",
    "departments.manage",
    "salary.view",
    "attendance.viewAll",
    "attendance.viewTeam",
    "attendance.approve",
    "leave.viewAll",
    "leave.approve",
    "leave.policies",
    "performance.viewAll",
    "performance.manage",
    "reports.hr",
  ],
  payroll_manager: ["dashboard.org", "salary.view", "payroll.view", "payroll.process", "reports.payroll", "settings.payroll"],
  team_lead: ["employees.view", "attendance.viewTeam", "attendance.approve", "leave.approve", "performance.manage"],
  employee: [],
};

export function can(role: Role | undefined, permission: Permission) {
  if (!role) return false;
  return matrix[role].includes(permission);
}

export const roleLabels: Record<Role, string> = {
  admin: "Admin",
  hr_manager: "HR Manager",
  payroll_manager: "Payroll Manager",
  team_lead: "Team Lead",
  employee: "Employee",
};

/** Route prefixes each role may open. Checked by the app shell. */
const routeAccess: Record<Role, string[]> = {
  admin: ["*"],
  hr_manager: [
    "/dashboard", "/employees", "/departments", "/attendance", "/leave", "/performance", "/reports",
    "/ai-assistant", "/notifications", "/settings", "/profile", "/payroll/payslips",
  ],
  payroll_manager: [
    "/dashboard", "/payroll", "/reports", "/ai-assistant", "/notifications", "/settings", "/profile",
    "/attendance/my", "/leave/my", "/leave/apply", "/performance/my",
  ],
  team_lead: [
    "/dashboard", "/employees", "/attendance", "/leave", "/performance", "/ai-assistant", "/notifications",
    "/settings", "/profile", "/payroll/payslips",
  ],
  employee: [
    "/dashboard", "/profile", "/attendance/my", "/leave/my", "/leave/apply", "/leave/policies", "/leave/calendar",
    "/payroll/payslips", "/performance/my", "/ai-assistant", "/notifications", "/settings",
  ],
};

export function canAccessRoute(role: Role, pathname: string) {
  const allowed = routeAccess[role];
  if (allowed.includes("*")) return true;
  // Evaluation details and the self-evaluation form check ownership inside the page
  if (/^\/performance\/(EV-\d+|new)$/.test(pathname)) return true;
  if (role === "team_lead" && (pathname === "/employees/new" || pathname.endsWith("/edit"))) return false;
  if (role === "team_lead" && pathname.startsWith("/reports")) return false;
  if (role === "hr_manager" && pathname.startsWith("/reports/payroll")) return false;
  if (role === "payroll_manager" && pathname.startsWith("/reports/") && !pathname.startsWith("/reports/payroll")) return false;
  return allowed.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
