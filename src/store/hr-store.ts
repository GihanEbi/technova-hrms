"use client";

// Single persisted demo store. Every module reads from and writes to this store,
// so dashboards, reports and the AI assistant always reflect the same records.
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type {
  Activity,
  AppNotification,
  AttendanceCorrection,
  ChatMessage,
  Company,
  DemoData,
  Department,
  Designation,
  Employee,
  Evaluation,
  Goal,
  LeaveRequest,
  LeaveSettings,
  LeaveType,
  LeaveTypeId,
  NotificationPreferences,
  NotificationType,
  PayrollSettings,
  Role,
  SalaryStructure,
} from "@/types";
import { createSeedData, DEMO_SCHEMA_VERSION } from "@/data/seed-data/generate";
import { combineDateTime, now, toDateKey } from "@/lib/dates";
import { calculateLeaveDays } from "@/lib/leave";
import { generatePayrollItems } from "@/lib/payroll";
import { nextId, uid } from "@/lib/utils";
import { periodLabel } from "@/lib/dates";

export const defaultNotificationPrefs: NotificationPreferences = {
  leave: true,
  payroll: true,
  attendance: true,
  performance: true,
  employee: true,
  system: true,
  emailDigest: false,
};

interface SessionState {
  currentUserId: string | null;
  sidebarCollapsed: boolean;
  notificationPrefs: Record<string, NotificationPreferences>;
  aiChats: Record<string, ChatMessage[]>;
}

export type EmployeeInput = Omit<Employee, "archived" | "archivedAt">;
export type SalaryInput = Pick<
  SalaryStructure,
  "basic" | "transportAllowance" | "mealAllowance" | "otherAllowance" | "currency" | "frequency"
> &
  Partial<SalaryStructure>;

export interface LeaveInput {
  employeeId: string;
  typeId: LeaveTypeId;
  startDate: string;
  endDate: string;
  halfDay: boolean;
  halfDaySession: "Morning" | "Afternoon" | null;
  reason: string;
  attachmentName: string | null;
  source?: LeaveRequest["source"];
}

export interface EvaluationInput {
  id?: string;
  employeeId: string;
  type: Evaluation["type"];
  period: string;
  ratings: Evaluation["ratings"];
  strengths: string;
  improvements: string;
  comments: string;
}

interface Actions {
  login: (userId: string) => void;
  logout: () => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  resetDemo: () => void;

  updateCompany: (patch: Partial<Company>) => void;

  addEmployee: (input: EmployeeInput, salary: SalaryInput | null) => string;
  updateEmployee: (id: string, patch: Partial<Employee>, salary?: SalaryInput | null) => void;
  archiveEmployee: (id: string) => void;
  restoreEmployee: (id: string) => void;

  addDepartment: (d: Omit<Department, "id" | "createdAt" | "archived">) => string;
  updateDepartment: (id: string, patch: Partial<Department>) => void;
  setDepartmentArchived: (id: string, archived: boolean) => void;
  addDesignation: (d: Omit<Designation, "id" | "archived">) => string;
  updateDesignation: (id: string, patch: Partial<Designation>) => void;
  setDesignationArchived: (id: string, archived: boolean) => void;

  clockIn: (employeeId: string) => void;
  clockOut: (employeeId: string) => void;
  submitCorrection: (input: Pick<AttendanceCorrection, "employeeId" | "date" | "clockIn" | "clockOut" | "reason">) => string;
  reviewCorrection: (id: string, decision: "Approved" | "Rejected", comment: string) => void;

  applyLeave: (input: LeaveInput) => LeaveRequest;
  decideLeave: (id: string, decision: "Approved" | "Rejected", comment: string) => void;
  cancelLeave: (id: string) => void;
  updateLeaveType: (id: LeaveTypeId, patch: Partial<LeaveType>) => void;
  updateLeaveSettings: (patch: Partial<LeaveSettings>) => void;

  updateSalary: (employeeId: string, patch: Partial<SalaryStructure>) => void;
  generatePayroll: (period: string) => string;
  submitPayroll: (runId: string) => void;
  approvePayroll: (runId: string) => void;
  processPayroll: (runId: string) => void;
  discardPayroll: (runId: string) => void;
  updatePayrollSettings: (patch: Partial<PayrollSettings>) => void;

  saveEvaluation: (input: EvaluationInput, submit: boolean) => string;
  deleteEvaluation: (id: string) => void;
  addGoal: (goal: Omit<Goal, "id">) => void;
  updateGoal: (id: string, patch: Partial<Goal>) => void;

  markNotificationRead: (id: string, read?: boolean) => void;
  markAllNotificationsRead: () => void;
  setNotificationPrefs: (prefs: NotificationPreferences) => void;

  appendChat: (msg: ChatMessage) => void;
  updateChatMessage: (id: string, patch: Partial<ChatMessage>) => void;
  clearChat: () => void;
}

export type HRState = { data: DemoData } & SessionState & Actions;

function freshData(): DemoData {
  return createSeedData(now());
}

const initialSession: SessionState = {
  currentUserId: null,
  sidebarCollapsed: false,
  notificationPrefs: {},
  aiChats: {},
};

export const useHRStore = create<HRState>()(
  persist(
    immer((set, get) => {
      // --------------- helpers (operate on the draft) ---------------
      const actor = (s: HRState) => s.data.demoUsers.find((u) => u.id === s.currentUserId);
      const actorEmployeeId = (s: HRState) => actor(s)?.employeeId ?? "EMP-0001";
      const fullName = (s: HRState, id: string) => {
        const e = s.data.employees.find((x) => x.id === id);
        return e ? `${e.firstName} ${e.lastName}` : id;
      };
      const notify = (
        s: HRState,
        to: { employee?: string | null; role?: Role | null },
        type: NotificationType,
        title: string,
        message: string,
        link: string,
      ) => {
        const n: AppNotification = {
          id: nextId("NTF", s.data.notifications.map((x) => x.id)),
          recipientEmployeeId: to.employee ?? null,
          recipientRole: to.role ?? null,
          type,
          title,
          message,
          link,
          read: false,
          createdAt: now().toISOString(),
        };
        s.data.notifications.unshift(n);
      };
      const log = (s: HRState, type: NotificationType, text: string, link: string) => {
        const a: Activity = {
          id: nextId("ACT", s.data.activities.map((x) => x.id)),
          actorId: actorEmployeeId(s),
          type,
          text,
          link,
          createdAt: now().toISOString(),
        };
        s.data.activities.unshift(a);
      };
      const writeSalary = (s: HRState, employeeId: string, salary: SalaryInput) => {
        const existing = s.data.salaries.find((x) => x.employeeId === employeeId);
        const base: SalaryStructure = existing ?? {
          employeeId,
          currency: "LKR",
          frequency: "Monthly",
          basic: 0,
          transportAllowance: 0,
          mealAllowance: 0,
          otherAllowance: 0,
          overtimeHours: 0,
          bonus: 0,
          loanDeduction: 0,
          otherDeduction: 0,
          effectiveFrom: toDateKey(now()),
          updatedAt: toDateKey(now()),
        };
        const merged = { ...base, ...salary, employeeId, updatedAt: toDateKey(now()) };
        if (existing) Object.assign(existing, merged);
        else s.data.salaries.push(merged);
      };

      return {
        data: freshData(),
        ...initialSession,

        // --------------- session ---------------
        login: (userId) => set((s) => void (s.currentUserId = userId)),
        logout: () => set((s) => void (s.currentUserId = null)),
        toggleSidebar: () => set((s) => void (s.sidebarCollapsed = !s.sidebarCollapsed)),
        setSidebarCollapsed: (v) => set((s) => void (s.sidebarCollapsed = v)),
        resetDemo: () =>
          set((s) => {
            s.data = freshData();
            s.aiChats = {};
            s.notificationPrefs = {};
          }),

        updateCompany: (patch) =>
          set((s) => {
            Object.assign(s.data.company, patch);
            log(s, "system", "updated organization settings", "/settings");
          }),

        // --------------- employees ---------------
        addEmployee: (input, salary) => {
          const id = input.id?.trim() || nextId("EMP", get().data.employees.map((e) => e.id));
          set((s) => {
            s.data.employees.push({ ...input, id, archived: false, archivedAt: null });
            if (salary) writeSalary(s, id, salary);
            const name = `${input.firstName} ${input.lastName}`;
            const dept = s.data.departments.find((d) => d.id === input.departmentId)?.name ?? "";
            log(s, "employee", `added ${name} to ${dept}`, `/employees/${id}`);
            notify(s, { role: "admin" }, "employee", "New employee added", `${name} joined ${dept}.`, `/employees/${id}`);
            notify(s, { role: "payroll_manager" }, "employee", "New joiner added", `${name} was added. Review their salary structure before the next payroll run.`, "/payroll/salary-structures");
            if (input.managerId) notify(s, { employee: input.managerId }, "employee", "New team member", `${name} will report to you.`, `/employees/${id}`);
          });
          return id;
        },
        updateEmployee: (id, patch, salary) =>
          set((s) => {
            const e = s.data.employees.find((x) => x.id === id);
            if (!e) return;
            Object.assign(e, patch);
            if (salary) writeSalary(s, id, salary);
            log(s, "employee", `updated ${fullName(s, id)}'s profile`, `/employees/${id}`);
          }),
        archiveEmployee: (id) =>
          set((s) => {
            const e = s.data.employees.find((x) => x.id === id);
            if (!e) return;
            e.archived = true;
            e.archivedAt = now().toISOString();
            log(s, "employee", `archived ${fullName(s, id)}`, `/employees/${id}`);
            notify(s, { role: "admin" }, "employee", "Employee archived", `${fullName(s, id)} was archived and excluded from future payroll runs.`, `/employees/${id}`);
          }),
        restoreEmployee: (id) =>
          set((s) => {
            const e = s.data.employees.find((x) => x.id === id);
            if (!e) return;
            e.archived = false;
            e.archivedAt = null;
            log(s, "employee", `restored ${fullName(s, id)}`, `/employees/${id}`);
          }),

        // --------------- organisation ---------------
        addDepartment: (d) => {
          const id = `dep-${d.code.toLowerCase()}-${uid("d").slice(-4)}`;
          set((s) => {
            s.data.departments.push({ ...d, id, archived: false, createdAt: toDateKey(now()) });
            log(s, "system", `created the ${d.name} department`, "/departments");
          });
          return id;
        },
        updateDepartment: (id, patch) =>
          set((s) => {
            const d = s.data.departments.find((x) => x.id === id);
            if (d) Object.assign(d, patch);
          }),
        setDepartmentArchived: (id, archived) =>
          set((s) => {
            const d = s.data.departments.find((x) => x.id === id);
            if (!d) return;
            d.archived = archived;
            log(s, "system", `${archived ? "archived" : "restored"} the ${d.name} department`, "/departments");
          }),
        addDesignation: (d) => {
          const id = `des-${uid("x").slice(-8)}`;
          set((s) => {
            s.data.designations.push({ ...d, id, archived: false });
            log(s, "system", `created the ${d.title} designation`, "/departments?tab=designations");
          });
          return id;
        },
        updateDesignation: (id, patch) =>
          set((s) => {
            const d = s.data.designations.find((x) => x.id === id);
            if (d) Object.assign(d, patch);
          }),
        setDesignationArchived: (id, archived) =>
          set((s) => {
            const d = s.data.designations.find((x) => x.id === id);
            if (d) d.archived = archived;
          }),

        // --------------- attendance ---------------
        clockIn: (employeeId) =>
          set((s) => {
            const t = now();
            const key = toDateKey(t);
            const [h, m] = s.data.leaveSettings.workdayStart.split(":").map(Number);
            const lateAfter = h * 60 + m + s.data.leaveSettings.graceMinutes;
            const late = t.getHours() * 60 + t.getMinutes() > lateAfter;
            const existing = s.data.attendance.find((a) => a.employeeId === employeeId && a.date === key);
            if (existing) {
              if (existing.clockIn) return;
              existing.clockIn = t.toISOString();
              existing.status = late ? "Late" : "Present";
            } else {
              s.data.attendance.push({
                id: `att-${employeeId}-${key}`,
                employeeId,
                date: key,
                clockIn: t.toISOString(),
                clockOut: null,
                status: late ? "Late" : "Present",
                source: "System",
              });
            }
          }),
        clockOut: (employeeId) =>
          set((s) => {
            const key = toDateKey(now());
            const rec = s.data.attendance.find((a) => a.employeeId === employeeId && a.date === key);
            if (rec && rec.clockIn && !rec.clockOut) rec.clockOut = now().toISOString();
          }),
        submitCorrection: (input) => {
          const id = nextId("COR", get().data.corrections.map((c) => c.id));
          set((s) => {
            s.data.corrections.unshift({
              ...input,
              id,
              status: "Pending",
              createdAt: now().toISOString(),
              reviewerId: null,
              reviewerComment: "",
              reviewedAt: null,
            });
            const emp = s.data.employees.find((e) => e.id === input.employeeId);
            const msg = `${fullName(s, input.employeeId)} requested an attendance correction for ${input.date}.`;
            if (emp?.managerId) notify(s, { employee: emp.managerId }, "attendance", "Attendance correction submitted", msg, "/attendance/corrections");
            notify(s, { role: "hr_manager" }, "attendance", "Attendance correction submitted", msg, "/attendance/corrections");
            log(s, "attendance", `requested an attendance correction for ${input.date}`, "/attendance/corrections");
          });
          return id;
        },
        reviewCorrection: (id, decision, comment) =>
          set((s) => {
            const c = s.data.corrections.find((x) => x.id === id);
            if (!c || c.status !== "Pending") return;
            c.status = decision;
            c.reviewerComment = comment;
            c.reviewerId = actorEmployeeId(s);
            c.reviewedAt = now().toISOString();
            if (decision === "Approved") {
              const clockIn = combineDateTime(c.date, c.clockIn);
              const clockOut = combineDateTime(c.date, c.clockOut);
              const [h, m] = s.data.leaveSettings.workdayStart.split(":").map(Number);
              const [ih, im] = c.clockIn.split(":").map(Number);
              const late = ih * 60 + im > h * 60 + m + s.data.leaveSettings.graceMinutes;
              const rec = s.data.attendance.find((a) => a.employeeId === c.employeeId && a.date === c.date);
              if (rec) {
                rec.clockIn = clockIn;
                rec.clockOut = clockOut;
                rec.status = late ? "Late" : "Present";
                rec.source = "Correction";
              } else {
                s.data.attendance.push({ id: `att-${c.employeeId}-${c.date}`, employeeId: c.employeeId, date: c.date, clockIn, clockOut, status: late ? "Late" : "Present", source: "Correction" });
              }
            }
            notify(
              s,
              { employee: c.employeeId },
              "attendance",
              `Attendance correction ${decision.toLowerCase()}`,
              `Your correction for ${c.date} was ${decision.toLowerCase()} by ${fullName(s, actorEmployeeId(s))}.${comment ? ` "${comment}"` : ""}`,
              "/attendance/my",
            );
            log(s, "attendance", `${decision.toLowerCase()} an attendance correction for ${fullName(s, c.employeeId)}`, "/attendance/corrections");
          }),

        // --------------- leave ---------------
        applyLeave: (input) => {
          const st = get().data;
          const req: LeaveRequest = {
            ...input,
            id: nextId("LV", st.leaveRequests.map((l) => l.id)),
            days: calculateLeaveDays(input.startDate, input.endDate, input.halfDay, st.leaveSettings, st.holidays),
            status: "Pending",
            createdAt: now().toISOString(),
            approverId: null,
            decidedAt: null,
            decisionComment: "",
            source: input.source ?? "Portal",
          };
          set((s) => {
            s.data.leaveRequests.push(req);
            const emp = s.data.employees.find((e) => e.id === input.employeeId);
            const type = s.data.leaveTypes.find((t) => t.id === input.typeId)?.name ?? "leave";
            const msg = `${fullName(s, input.employeeId)} requested ${req.days} day(s) of ${type.toLowerCase()} (${req.startDate} → ${req.endDate}).`;
            if (emp?.managerId) notify(s, { employee: emp.managerId }, "leave", "Leave request awaiting your approval", msg, "/leave/requests");
            notify(s, { role: "hr_manager" }, "leave", "New leave request", msg, "/leave/requests");
            notify(s, { employee: input.employeeId }, "leave", "Leave request submitted", `Your ${type.toLowerCase()} request ${req.id} is pending approval.`, "/leave/my");
            log(s, "leave", `requested ${req.days} day(s) of ${type.toLowerCase()}`, "/leave/requests");
          });
          return req;
        },
        decideLeave: (id, decision, comment) =>
          set((s) => {
            const r = s.data.leaveRequests.find((x) => x.id === id);
            if (!r || r.status !== "Pending") return;
            r.status = decision;
            r.approverId = actorEmployeeId(s);
            r.decidedAt = now().toISOString();
            r.decisionComment = comment;
            const type = s.data.leaveTypes.find((t) => t.id === r.typeId)?.name ?? "leave";
            notify(
              s,
              { employee: r.employeeId },
              "leave",
              `Leave request ${decision.toLowerCase()}`,
              `Your ${type.toLowerCase()} request ${r.id} was ${decision.toLowerCase()} by ${fullName(s, actorEmployeeId(s))}.`,
              "/leave/my",
            );
            log(s, "leave", `${decision.toLowerCase()} ${fullName(s, r.employeeId)}'s ${type.toLowerCase()}`, "/leave/requests");
          }),
        cancelLeave: (id) =>
          set((s) => {
            const r = s.data.leaveRequests.find((x) => x.id === id);
            if (!r || (r.status !== "Pending" && r.status !== "Approved")) return;
            r.status = "Cancelled";
            r.decidedAt = now().toISOString();
            const emp = s.data.employees.find((e) => e.id === r.employeeId);
            if (emp?.managerId) notify(s, { employee: emp.managerId }, "leave", "Leave request cancelled", `${fullName(s, r.employeeId)} cancelled leave request ${r.id}.`, "/leave/requests");
            log(s, "leave", `cancelled leave request ${r.id}`, "/leave/my");
          }),
        updateLeaveType: (id, patch) =>
          set((s) => {
            const t = s.data.leaveTypes.find((x) => x.id === id);
            if (t) Object.assign(t, patch);
          }),
        updateLeaveSettings: (patch) =>
          set((s) => {
            Object.assign(s.data.leaveSettings, patch);
            log(s, "system", "updated leave and working-day rules", "/settings?tab=leave");
          }),

        // --------------- payroll ---------------
        updateSalary: (employeeId, patch) =>
          set((s) => {
            writeSalary(s, employeeId, { ...(s.data.salaries.find((x) => x.employeeId === employeeId) as SalaryStructure), ...patch });
            log(s, "payroll", `updated ${fullName(s, employeeId)}'s salary structure`, "/payroll/salary-structures");
          }),
        generatePayroll: (period) => {
          const id = `PR-${period}`;
          set((s) => {
            const existing = s.data.payrollRuns.find((r) => r.period === period);
            if (existing && existing.status !== "Draft") return;
            const items = generatePayrollItems(s.data.employees, s.data.salaries, {
              period,
              settings: s.data.payrollSettings,
              leaveSettings: s.data.leaveSettings,
              holidays: s.data.holidays,
              leaveRequests: s.data.leaveRequests,
              attendance: s.data.attendance,
            });
            const payDate = `${period}-${String(s.data.payrollSettings.payDay).padStart(2, "0")}`;
            if (existing) {
              existing.items = items;
              existing.createdAt = now().toISOString();
            } else {
              s.data.payrollRuns.push({
                id,
                period,
                status: "Draft",
                items,
                createdAt: now().toISOString(),
                createdBy: actorEmployeeId(s),
                submittedAt: null,
                approvedAt: null,
                approvedBy: null,
                processedAt: null,
                processedBy: null,
                payDate,
              });
              log(s, "payroll", `generated a draft payroll for ${periodLabel(period)}`, "/payroll/process");
            }
          });
          return id;
        },
        submitPayroll: (runId) =>
          set((s) => {
            const r = s.data.payrollRuns.find((x) => x.id === runId);
            if (!r || r.status !== "Draft") return;
            r.status = "Pending Approval";
            r.submittedAt = now().toISOString();
            notify(s, { role: "admin" }, "payroll", "Payroll awaiting approval", `${periodLabel(r.period)} payroll for ${r.items.length} employees was submitted for approval.`, "/payroll/process");
            log(s, "payroll", `submitted ${periodLabel(r.period)} payroll for approval`, "/payroll/process");
          }),
        approvePayroll: (runId) =>
          set((s) => {
            const r = s.data.payrollRuns.find((x) => x.id === runId);
            if (!r || r.status !== "Pending Approval") return;
            r.status = "Approved";
            r.approvedAt = now().toISOString();
            r.approvedBy = actorEmployeeId(s);
            notify(s, { role: "payroll_manager" }, "payroll", "Payroll approved", `${periodLabel(r.period)} payroll was approved and is ready to process.`, "/payroll/process");
            log(s, "payroll", `approved ${periodLabel(r.period)} payroll`, "/payroll/process");
          }),
        processPayroll: (runId) =>
          set((s) => {
            const r = s.data.payrollRuns.find((x) => x.id === runId);
            if (!r || r.status !== "Approved") return; // guards against double processing
            r.status = "Processed";
            r.processedAt = now().toISOString();
            r.processedBy = actorEmployeeId(s);
            const label = periodLabel(r.period);
            notify(s, { role: "payroll_manager" }, "payroll", `${label} payroll processed`, `Payroll for ${r.items.length} employees was processed and payslips were generated.`, "/payroll/history");
            notify(s, { role: "admin" }, "payroll", `${label} payroll processed`, `Payslips were generated for ${r.items.length} employees.`, "/payroll/history");
            r.items.forEach((it) =>
              notify(s, { employee: it.employeeId }, "payroll", "Payslip available", `Your payslip for ${label} is ready to view and download.`, `/payroll/payslips/PS-${r.period}-${it.employeeId}`),
            );
            log(s, "payroll", `processed ${label} payroll`, "/payroll/history");
          }),
        discardPayroll: (runId) =>
          set((s) => {
            const r = s.data.payrollRuns.find((x) => x.id === runId);
            if (!r || r.status === "Processed") return;
            s.data.payrollRuns = s.data.payrollRuns.filter((x) => x.id !== runId);
            log(s, "payroll", `discarded the ${periodLabel(r.period)} payroll draft`, "/payroll/process");
          }),
        updatePayrollSettings: (patch) =>
          set((s) => {
            Object.assign(s.data.payrollSettings, patch);
            log(s, "payroll", "updated payroll settings", "/payroll/settings");
          }),

        // --------------- performance ---------------
        saveEvaluation: (input, submit) => {
          const id = input.id ?? nextId("EV", get().data.evaluations.map((e) => e.id));
          set((s) => {
            const values = Object.values(input.ratings);
            const overall = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
            const existing = s.data.evaluations.find((e) => e.id === id);
            const base = {
              ...input,
              id,
              overall,
              status: submit ? ("Submitted" as const) : ("Draft" as const),
              submittedAt: submit ? now().toISOString() : null,
            };
            if (existing) Object.assign(existing, base);
            else s.data.evaluations.push({ ...base, reviewerId: actorEmployeeId(s), createdAt: now().toISOString() });
            if (submit) {
              const isSelf = input.type === "Self Evaluation";
              if (!isSelf)
                notify(s, { employee: input.employeeId }, "performance", "Performance review submitted", `${fullName(s, actorEmployeeId(s))} submitted your ${input.period} performance review.`, "/performance/my");
              notify(s, { role: "hr_manager" }, "performance", isSelf ? "Self evaluation submitted" : "Performance review submitted", `${isSelf ? fullName(s, input.employeeId) + " submitted a self evaluation" : fullName(s, actorEmployeeId(s)) + " reviewed " + fullName(s, input.employeeId)} for ${input.period}.`, `/performance/${id}`);
              log(s, "performance", isSelf ? `submitted a ${input.period} self evaluation` : `submitted a ${input.period} review for ${fullName(s, input.employeeId)}`, `/performance/${id}`);
            }
          });
          return id;
        },
        deleteEvaluation: (id) =>
          set((s) => {
            s.data.evaluations = s.data.evaluations.filter((e) => !(e.id === id && e.status === "Draft"));
          }),
        addGoal: (goal) =>
          set((s) => {
            s.data.goals.push({ ...goal, id: nextId("GOAL", s.data.goals.map((g) => g.id)) });
          }),
        updateGoal: (id, patch) =>
          set((s) => {
            const g = s.data.goals.find((x) => x.id === id);
            if (!g) return;
            Object.assign(g, patch);
            g.status = g.progress >= 100 ? "Completed" : g.progress > 0 ? "In Progress" : "Not Started";
          }),

        // --------------- notifications ---------------
        markNotificationRead: (id, read = true) =>
          set((s) => {
            const n = s.data.notifications.find((x) => x.id === id);
            if (n) n.read = read;
          }),
        markAllNotificationsRead: () =>
          set((s) => {
            const u = actor(s);
            if (!u) return;
            s.data.notifications.forEach((n) => {
              if (n.recipientEmployeeId === u.employeeId || n.recipientRole === u.role) n.read = true;
            });
          }),
        setNotificationPrefs: (prefs) =>
          set((s) => {
            if (s.currentUserId) s.notificationPrefs[s.currentUserId] = prefs;
          }),

        // --------------- AI assistant ---------------
        appendChat: (msg) =>
          set((s) => {
            if (!s.currentUserId) return;
            (s.aiChats[s.currentUserId] ??= []).push(msg);
          }),
        updateChatMessage: (id, patch) =>
          set((s) => {
            if (!s.currentUserId) return;
            const m = s.aiChats[s.currentUserId]?.find((x) => x.id === id);
            if (m) Object.assign(m, patch);
          }),
        clearChat: () =>
          set((s) => {
            if (s.currentUserId) s.aiChats[s.currentUserId] = [];
          }),
      };
    }),
    {
      name: "technova-hrms",
      version: DEMO_SCHEMA_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        data: s.data,
        currentUserId: s.currentUserId,
        sidebarCollapsed: s.sidebarCollapsed,
        notificationPrefs: s.notificationPrefs,
        aiChats: s.aiChats,
      }),
      // Any schema change discards stored demo data and reseeds — avoids runtime errors after model changes.
      migrate: () => ({ data: freshData(), ...initialSession }) as unknown as HRState,
    },
  ),
);
