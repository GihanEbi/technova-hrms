// Shared data models for the TechNova HRMS prototype.
// All modules read and write these shapes through the single demo store.

export type Role = "admin" | "hr_manager" | "payroll_manager" | "team_lead" | "employee";

export interface DemoUser {
  id: string;
  role: Role;
  employeeId: string;
  email: string;
  roleLabel: string;
  description: string;
}

export interface Company {
  name: string;
  legalName: string;
  logo: string | null; // data URL
  address: string;
  country: string;
  currency: string;
  timezone: string;
  email: string;
  phone: string;
  registrationNo: string;
  website: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description: string;
  headId: string | null;
  color: string; // chart token key, e.g. "chart-1"
  archived: boolean;
  createdAt: string;
}

export interface Designation {
  id: string;
  title: string;
  departmentId: string;
  level: "Junior" | "Mid" | "Senior" | "Lead" | "Manager" | "Executive";
  archived: boolean;
}

export type EmploymentType = "Full-time" | "Part-time" | "Contract" | "Intern";
export type EmploymentStatus = "Active" | "Probation" | "Notice Period";

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

export interface Employee {
  id: string; // EMP-0001
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string; // yyyy-MM-dd
  gender: "Female" | "Male";
  address: string;
  emergencyContact: EmergencyContact;
  departmentId: string;
  designationId: string;
  managerId: string | null;
  joinDate: string; // yyyy-MM-dd
  employmentType: EmploymentType;
  status: EmploymentStatus;
  archived: boolean;
  archivedAt: string | null;
  skills: string[];
  notes: string;
  avatar: string | null; // data URL
}

export interface SalaryStructure {
  employeeId: string;
  currency: string;
  frequency: "Monthly";
  basic: number;
  transportAllowance: number;
  mealAllowance: number;
  otherAllowance: number;
  overtimeHours: number; // expected monthly overtime hours for the current period
  bonus: number;
  loanDeduction: number;
  otherDeduction: number;
  effectiveFrom: string;
  updatedAt: string;
}

export type AttendanceStatus = "Present" | "Late" | "Absent" | "On Leave" | "Half Day";

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string; // yyyy-MM-dd
  clockIn: string | null; // ISO timestamp
  clockOut: string | null; // ISO timestamp
  status: AttendanceStatus;
  source: "System" | "Correction";
}

export type RequestStatus = "Pending" | "Approved" | "Rejected";

export interface AttendanceCorrection {
  id: string;
  employeeId: string;
  date: string;
  clockIn: string; // HH:mm
  clockOut: string; // HH:mm
  reason: string;
  status: RequestStatus;
  createdAt: string;
  reviewerId: string | null;
  reviewerComment: string;
  reviewedAt: string | null;
}

export type LeaveTypeId = "annual" | "casual" | "medical" | "unpaid";

export interface LeaveType {
  id: LeaveTypeId;
  name: string;
  allocation: number; // days per year, 0 = unlimited (unpaid)
  paid: boolean;
  color: string;
  description: string;
  maxConsecutive: number;
  noticeDays: number;
  requiresAttachmentAfter: number; // days; 0 = never
  active: boolean;
}

export type LeaveStatus = "Pending" | "Approved" | "Rejected" | "Cancelled";

export interface LeaveRequest {
  id: string;
  employeeId: string;
  typeId: LeaveTypeId;
  startDate: string;
  endDate: string;
  halfDay: boolean;
  halfDaySession: "Morning" | "Afternoon" | null;
  days: number;
  reason: string;
  attachmentName: string | null;
  status: LeaveStatus;
  createdAt: string;
  approverId: string | null;
  decidedAt: string | null;
  decisionComment: string;
  source: "Portal" | "AI Assistant";
}

export interface Holiday {
  date: string;
  name: string;
}

export interface LeaveSettings {
  workingDays: number[]; // 0 = Sunday … 6 = Saturday
  workdayStart: string; // HH:mm
  workdayEnd: string;
  graceMinutes: number;
  halfDayHours: number;
}

export type PayrollStatus = "Draft" | "Pending Approval" | "Approved" | "Processed";

export interface PayrollItem {
  employeeId: string;
  basic: number;
  transportAllowance: number;
  mealAllowance: number;
  otherAllowance: number;
  overtimePay: number;
  bonus: number;
  gross: number;
  epfEmployee: number;
  epfEmployer: number;
  etfEmployer: number;
  apit: number;
  loanDeduction: number;
  otherDeduction: number;
  unpaidLeaveDeduction: number;
  unpaidLeaveDays: number;
  totalDeductions: number;
  net: number;
  workingDays: number;
  warnings: string[];
}

export interface PayrollRun {
  id: string; // PR-2026-10
  period: string; // yyyy-MM
  status: PayrollStatus;
  items: PayrollItem[];
  createdAt: string;
  createdBy: string;
  submittedAt: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  processedAt: string | null;
  processedBy: string | null;
  payDate: string;
}

export interface TaxBracket {
  upTo: number | null; // monthly taxable income ceiling; null = no ceiling
  rate: number; // percent
}

export interface PayrollSettings {
  cycle: "Monthly";
  payDay: number;
  epfEmployeeRate: number;
  epfEmployerRate: number;
  etfRate: number;
  apitEnabled: boolean;
  apitBrackets: TaxBracket[];
  overtimeMultiplier: number;
  standardMonthlyHours: number;
  lowNetThreshold: number;
}

export type CriterionId =
  | "attendance"
  | "communication"
  | "teamwork"
  | "quality"
  | "technical"
  | "problemSolving"
  | "productivity";

export interface Evaluation {
  id: string;
  employeeId: string;
  reviewerId: string;
  type: "Manager Review" | "Self Evaluation";
  period: string; // e.g. "H1 2026"
  ratings: Record<CriterionId, number>;
  overall: number;
  strengths: string;
  improvements: string;
  comments: string;
  status: "Draft" | "Submitted";
  createdAt: string;
  submittedAt: string | null;
}

export interface Goal {
  id: string;
  employeeId: string;
  title: string;
  dueDate: string;
  progress: number;
  status: "Not Started" | "In Progress" | "Completed";
}

export type NotificationType = "leave" | "payroll" | "attendance" | "performance" | "employee" | "system";

export interface AppNotification {
  id: string;
  recipientEmployeeId: string | null; // personal notification
  recipientRole: Role | null; // role-wide notification
  type: NotificationType;
  title: string;
  message: string;
  link: string;
  read: boolean;
  createdAt: string;
}

export interface Activity {
  id: string;
  actorId: string; // employee id
  type: NotificationType;
  text: string;
  link: string;
  createdAt: string;
}

export interface NotificationPreferences {
  leave: boolean;
  payroll: boolean;
  attendance: boolean;
  performance: boolean;
  employee: boolean;
  system: boolean;
  emailDigest: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
  card?: ChatCard;
}

export type ChatCard =
  | { kind: "stats"; title: string; items: { label: string; value: string; tone?: "default" | "success" | "warning" | "danger" }[] }
  | { kind: "table"; title: string; columns: string[]; rows: string[][]; link?: { href: string; label: string } }
  | {
      kind: "leave-proposal";
      status: "proposed" | "confirmed" | "cancelled";
      employeeId: string;
      typeId: LeaveTypeId;
      startDate: string;
      endDate: string;
      days: number;
      reason: string;
      balanceAfter: number | null;
      requestId?: string;
    }
  | { kind: "link"; title: string; description: string; href: string; label: string };

export interface DemoData {
  company: Company;
  departments: Department[];
  designations: Designation[];
  employees: Employee[];
  salaries: SalaryStructure[];
  attendance: AttendanceRecord[];
  corrections: AttendanceCorrection[];
  leaveTypes: LeaveType[];
  leaveRequests: LeaveRequest[];
  leaveSettings: LeaveSettings;
  holidays: Holiday[];
  payrollRuns: PayrollRun[];
  payrollSettings: PayrollSettings;
  evaluations: Evaluation[];
  goals: Goal[];
  notifications: AppNotification[];
  activities: Activity[];
  demoUsers: DemoUser[];
  seededAt: string;
}
