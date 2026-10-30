import {
  BarChart3,
  Bell,
  Bot,
  Building2,
  CalendarDays,
  Clock,
  FileText,
  LayoutDashboard,
  Calculator,
  Receipt,
  Settings,
  Star,
  User,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/types";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  match?: string[]; // extra prefixes that should mark the item active
  exclude?: string[]; // prefixes that should not mark it active
}
export interface NavSection {
  label: string;
  items: NavItem[];
}

const dashboard: NavItem = { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard };
const employees: NavItem = { href: "/employees", label: "Employees", icon: Users };
const team: NavItem = { href: "/employees", label: "My Team", icon: Users };
const departments: NavItem = { href: "/departments", label: "Departments", icon: Building2 };
const attendance: NavItem = { href: "/attendance", label: "Attendance", icon: Clock, exclude: ["/attendance/my"] };
const leave: NavItem = { href: "/leave", label: "Leave Management", icon: CalendarDays, exclude: ["/leave/my"] };
const payrollOverview: NavItem = { href: "/payroll", label: "Payroll Overview", icon: Wallet, exclude: ["/payroll/process", "/payroll/salary-structures", "/payroll/payslips"] };
const processPayroll: NavItem = { href: "/payroll/process", label: "Process Payroll", icon: Calculator };
const salaryStructures: NavItem = { href: "/payroll/salary-structures", label: "Salary Structures", icon: FileText };
const payslips: NavItem = { href: "/payroll/payslips", label: "Payslips", icon: Receipt };
const evaluations: NavItem = { href: "/performance", label: "Evaluations", icon: Star, exclude: ["/performance/my"] };
const reports: NavItem = { href: "/reports", label: "Reports", icon: BarChart3 };
const ai: NavItem = { href: "/ai-assistant", label: "AI HR Assistant", icon: Bot };
const notifications: NavItem = { href: "/notifications", label: "Notifications", icon: Bell };
const settings: NavItem = { href: "/settings", label: "Settings", icon: Settings };

const myProfile: NavItem = { href: "/profile", label: "My Profile", icon: User };
const myAttendance: NavItem = { href: "/attendance/my", label: "My Attendance", icon: Clock };
const myLeave: NavItem = { href: "/leave/my", label: "My Leave", icon: CalendarDays, match: ["/leave/apply", "/leave/policies", "/leave/calendar"] };
const myPayslips: NavItem = { href: "/payroll/payslips", label: "My Payslips", icon: Receipt };
const myPerformance: NavItem = { href: "/performance/my", label: "My Performance", icon: Star };

export function navFor(role: Role): NavSection[] {
  switch (role) {
    case "admin":
      return [
        { label: "Main", items: [dashboard] },
        { label: "People", items: [employees, departments] },
        { label: "Time & Leave", items: [attendance, leave] },
        { label: "Payroll", items: [payrollOverview, processPayroll, salaryStructures, payslips] },
        { label: "Performance", items: [evaluations] },
        { label: "Insights", items: [reports] },
        { label: "Assistant", items: [ai] },
        { label: "System", items: [notifications, settings] },
      ];
    case "hr_manager":
      return [
        { label: "Main", items: [dashboard] },
        { label: "People", items: [employees, departments] },
        { label: "Time & Leave", items: [attendance, leave] },
        { label: "Performance", items: [evaluations] },
        { label: "Insights", items: [reports] },
        { label: "Assistant", items: [ai] },
        { label: "System", items: [notifications, settings] },
      ];
    case "payroll_manager":
      return [
        { label: "Main", items: [dashboard] },
        { label: "Payroll", items: [payrollOverview, processPayroll, salaryStructures, payslips] },
        { label: "Insights", items: [reports] },
        { label: "Assistant", items: [ai] },
        { label: "System", items: [notifications, settings] },
      ];
    case "team_lead":
      return [
        { label: "Main", items: [dashboard] },
        { label: "Team", items: [team] },
        { label: "Time & Leave", items: [attendance, leave] },
        { label: "Performance", items: [evaluations] },
        { label: "Me", items: [myProfile, { ...myPayslips }] },
        { label: "Assistant", items: [ai] },
        { label: "System", items: [notifications, settings] },
      ];
    case "employee":
      return [
        { label: "My Space", items: [{ ...dashboard, label: "My Dashboard" }, myProfile, myAttendance, myLeave, myPayslips, myPerformance] },
        { label: "Assistant", items: [{ ...ai, label: "AI Assistant" }] },
        { label: "System", items: [notifications, settings] },
      ];
  }
}

export function isNavActive(item: NavItem, pathname: string) {
  if (item.exclude?.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return false;
  if (item.match?.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export const segmentLabels: Record<string, string> = {
  dashboard: "Dashboard",
  employees: "Employees",
  new: "New",
  edit: "Edit",
  departments: "Departments",
  attendance: "Attendance",
  my: "My",
  calendar: "Calendar",
  corrections: "Corrections",
  daily: "Daily",
  leave: "Leave",
  apply: "Apply Leave",
  requests: "Requests",
  policies: "Policies",
  payroll: "Payroll",
  process: "Process Payroll",
  "salary-structures": "Salary Structures",
  history: "History",
  payslips: "Payslips",
  settings: "Settings",
  performance: "Performance",
  reports: "Reports",
  "ai-assistant": "AI Assistant",
  notifications: "Notifications",
  profile: "My Profile",
};
