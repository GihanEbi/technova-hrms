// Static reference data for the TechNova Solutions demo company.
import type { Company, Department, Designation, Holiday, LeaveSettings, LeaveType, PayrollSettings } from "@/types";
import { defaultApitBrackets } from "@/lib/payroll";

export const company: Company = {
  name: "TechNova Solutions",
  legalName: "TechNova Solutions (Pvt) Ltd.",
  logo: null,
  address: "No. 128, Galle Road, Colombo 03, Sri Lanka",
  country: "Sri Lanka",
  currency: "LKR",
  timezone: "Asia/Colombo",
  email: "people@technova-demo.lk",
  phone: "+94 11 245 7800",
  registrationNo: "PV 00123456",
  website: "www.technova-demo.lk",
};

export const departments: Omit<Department, "createdAt">[] = [
  { id: "dep-eng", name: "Software Engineering", code: "ENG", description: "Product development, quality assurance and platform engineering.", headId: "EMP-0004", color: "chart-1", archived: false },
  { id: "dep-hr", name: "Human Resources", code: "HR", description: "People operations, talent and employee relations.", headId: "EMP-0002", color: "chart-2", archived: false },
  { id: "dep-fin", name: "Finance", code: "FIN", description: "Accounting, payroll and financial planning.", headId: "EMP-0003", color: "chart-3", archived: false },
  { id: "dep-mkt", name: "Marketing", code: "MKT", description: "Brand, digital campaigns and content.", headId: "EMP-0032", color: "chart-4", archived: false },
  { id: "dep-ops", name: "Operations", code: "OPS", description: "Business operations, facilities and IT support.", headId: "EMP-0001", color: "chart-5", archived: false },
];

export const designations: Designation[] = [
  { id: "des-coo", title: "Chief Operating Officer", departmentId: "dep-ops", level: "Executive", archived: false },
  { id: "des-ops-exec", title: "Operations Executive", departmentId: "dep-ops", level: "Mid", archived: false },
  { id: "des-it-support", title: "IT Support Engineer", departmentId: "dep-ops", level: "Mid", archived: false },
  { id: "des-hr-mgr", title: "HR Manager", departmentId: "dep-hr", level: "Manager", archived: false },
  { id: "des-hr-exec", title: "HR Executive", departmentId: "dep-hr", level: "Mid", archived: false },
  { id: "des-payroll-mgr", title: "Payroll Manager", departmentId: "dep-fin", level: "Manager", archived: false },
  { id: "des-accountant", title: "Accountant", departmentId: "dep-fin", level: "Senior", archived: false },
  { id: "des-fin-exec", title: "Finance Executive", departmentId: "dep-fin", level: "Mid", archived: false },
  { id: "des-eng-lead", title: "Engineering Team Lead", departmentId: "dep-eng", level: "Lead", archived: false },
  { id: "des-sse", title: "Senior Software Engineer", departmentId: "dep-eng", level: "Senior", archived: false },
  { id: "des-se", title: "Software Engineer", departmentId: "dep-eng", level: "Mid", archived: false },
  { id: "des-ase", title: "Associate Software Engineer", departmentId: "dep-eng", level: "Junior", archived: false },
  { id: "des-qa", title: "QA Engineer", departmentId: "dep-eng", level: "Mid", archived: false },
  { id: "des-devops", title: "DevOps Engineer", departmentId: "dep-eng", level: "Senior", archived: false },
  { id: "des-mkt-mgr", title: "Marketing Manager", departmentId: "dep-mkt", level: "Manager", archived: false },
  { id: "des-digital", title: "Digital Marketing Executive", departmentId: "dep-mkt", level: "Mid", archived: false },
  { id: "des-content", title: "Content Specialist", departmentId: "dep-mkt", level: "Mid", archived: false },
];

export const leaveTypes: LeaveType[] = [
  { id: "annual", name: "Annual Leave", allocation: 14, paid: true, color: "chart-1", description: "Planned time off for rest and personal matters. Apply at least 3 days in advance.", maxConsecutive: 10, noticeDays: 3, requiresAttachmentAfter: 0, active: true },
  { id: "casual", name: "Casual Leave", allocation: 7, paid: true, color: "chart-2", description: "Short notice leave for urgent personal matters.", maxConsecutive: 2, noticeDays: 0, requiresAttachmentAfter: 0, active: true },
  { id: "medical", name: "Medical Leave", allocation: 7, paid: true, color: "chart-4", description: "Sick leave. A medical certificate is recommended for absences longer than 2 days.", maxConsecutive: 14, noticeDays: 0, requiresAttachmentAfter: 2, active: true },
  { id: "unpaid", name: "Unpaid Leave", allocation: 0, paid: false, color: "chart-3", description: "Leave without pay. Deducted from basic salary pro rata in payroll.", maxConsecutive: 30, noticeDays: 7, requiresAttachmentAfter: 0, active: true },
];

export const leaveSettings: LeaveSettings = {
  workingDays: [1, 2, 3, 4, 5],
  workdayStart: "09:00",
  workdayEnd: "17:30",
  graceMinutes: 15,
  halfDayHours: 4,
};

export const payrollSettings: PayrollSettings = {
  cycle: "Monthly",
  payDay: 25,
  epfEmployeeRate: 8,
  epfEmployerRate: 12,
  etfRate: 3,
  apitEnabled: true,
  apitBrackets: defaultApitBrackets,
  overtimeMultiplier: 1.5,
  standardMonthlyHours: 240,
  lowNetThreshold: 50000,
};

// Illustrative public & mercantile holiday calendar used for working-day calculations.
export const holidays: Holiday[] = [
  { date: "2026-01-03", name: "Duruthu Full Moon Poya Day" },
  { date: "2026-01-15", name: "Tamil Thai Pongal Day" },
  { date: "2026-02-04", name: "Independence Day" },
  { date: "2026-03-03", name: "Medin Full Moon Poya Day" },
  { date: "2026-04-02", name: "Bak Full Moon Poya Day" },
  { date: "2026-04-03", name: "Good Friday" },
  { date: "2026-04-13", name: "Day prior to Sinhala & Tamil New Year" },
  { date: "2026-04-14", name: "Sinhala & Tamil New Year Day" },
  { date: "2026-05-01", name: "May Day / Vesak Full Moon Poya Day" },
  { date: "2026-05-29", name: "Day following Vesak Poya" },
  { date: "2026-06-29", name: "Poson Full Moon Poya Day" },
  { date: "2026-07-29", name: "Esala Full Moon Poya Day" },
  { date: "2026-08-27", name: "Nikini Full Moon Poya Day" },
  { date: "2026-09-25", name: "Binara Full Moon Poya Day" },
  { date: "2026-10-26", name: "Vap Full Moon Poya Day" },
  { date: "2026-11-09", name: "Deepavali Festival Day" },
  { date: "2026-11-24", name: "Il Full Moon Poya Day" },
  { date: "2026-12-23", name: "Unduvap Full Moon Poya Day" },
  { date: "2026-12-25", name: "Christmas Day" },
  { date: "2027-01-15", name: "Tamil Thai Pongal Day" },
  { date: "2027-01-22", name: "Duruthu Full Moon Poya Day" },
  { date: "2027-02-04", name: "Independence Day" },
  { date: "2027-02-20", name: "Navam Full Moon Poya Day" },
  { date: "2027-03-22", name: "Medin Full Moon Poya Day" },
];

export const evaluationCriteria = [
  { id: "attendance", label: "Attendance & punctuality" },
  { id: "communication", label: "Communication" },
  { id: "teamwork", label: "Teamwork" },
  { id: "quality", label: "Quality of work" },
  { id: "technical", label: "Technical knowledge" },
  { id: "problemSolving", label: "Problem solving" },
  { id: "productivity", label: "Productivity" },
] as const;

export const ratingLabels: Record<number, string> = {
  1: "Needs improvement",
  2: "Below expectations",
  3: "Meets expectations",
  4: "Exceeds expectations",
  5: "Outstanding",
};
