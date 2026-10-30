// Deterministic demo-data generator. Dates are anchored to the reference date
// passed in, and every random choice comes from a fixed-seed PRNG, so the same
// reference date always produces exactly the same dataset.
import { addDays, addMonths, format, parseISO, subMonths } from "date-fns";
import type {
  Activity,
  AppNotification,
  AttendanceCorrection,
  AttendanceRecord,
  CriterionId,
  DemoData,
  DemoUser,
  Employee,
  EmploymentType,
  Evaluation,
  Goal,
  LeaveRequest,
  LeaveTypeId,
  PayrollRun,
  SalaryStructure,
} from "@/types";
import { createRng, round2 } from "@/lib/utils";
import { isWorkingDay, periodKey, toDateKey, workingDaysBetween } from "@/lib/dates";
import { calculateLeaveDays } from "@/lib/leave";
import { generatePayrollItems } from "@/lib/payroll";
import {
  company,
  departments,
  designations,
  evaluationCriteria,
  holidays,
  leaveSettings,
  leaveTypes,
  payrollSettings,
} from "./catalog";

export const DEMO_SCHEMA_VERSION = 3;

type Seed = [first: string, last: string, gender: "Female" | "Male", designationId: string, managerIdx: number | null, joined: string, type?: EmploymentType];

// Index in this array + 1 = employee number (EMP-0001 …)
const people: Seed[] = [
  ["Ruwan", "Wickramasinghe", "Male", "des-coo", null, "2018-02-12"],
  ["Nadeesha", "Fernando", "Female", "des-hr-mgr", 1, "2019-04-01"],
  ["Chamara", "Silva", "Male", "des-payroll-mgr", 1, "2019-08-19"],
  ["Kasun", "Bandara", "Male", "des-eng-lead", 1, "2018-11-05"],
  ["Tharushi", "Perera", "Female", "des-se", 4, "2022-03-14"],
  ["Dinesh", "Kumar", "Male", "des-sse", 4, "2019-06-10"],
  ["Ayesha", "Rizvi", "Female", "des-qa", 4, "2021-01-18"],
  ["Sanjeewa", "Herath", "Male", "des-devops", 19, "2020-09-07"],
  ["Hiruni", "Jayasinghe", "Female", "des-ase", 4, "2024-07-01"],
  ["Malith", "Gunawardena", "Male", "des-se", 4, "2022-10-24"],
  ["Priyanka", "Rajendran", "Female", "des-sse", 19, "2020-02-03"],
  ["Nuwan", "Dissanayake", "Male", "des-se", 4, "2023-01-09"],
  ["Shehan", "Abeysekara", "Male", "des-ase", 19, "2025-02-17"],
  ["Ishara", "Weerasinghe", "Female", "des-qa", 4, "2021-08-23"],
  ["Lahiru", "Samarakoon", "Male", "des-se", 19, "2022-05-30"],
  ["Fathima", "Nazeer", "Female", "des-se", 4, "2023-06-12"],
  ["Ravindu", "Karunaratne", "Male", "des-sse", 19, "2019-12-02"],
  ["Sachini", "Wijesinghe", "Female", "des-ase", 4, "2025-09-15"],
  ["Thilina", "Ekanayake", "Male", "des-eng-lead", 1, "2019-03-18"],
  ["Kavindi", "Liyanage", "Female", "des-se", 4, "2023-11-06"],
  ["Arjun", "Sivakumar", "Male", "des-devops", 19, "2021-04-26"],
  ["Madhavi", "Ranasinghe", "Female", "des-qa", 19, "2024-01-22"],
  ["Yasiru", "Pathirana", "Male", "des-ase", 4, "RECENT_1", "Intern"],
  ["Dulani", "Amarasinghe", "Female", "des-hr-exec", 2, "2021-05-17"],
  ["Roshan", "Jayawardena", "Male", "des-hr-exec", 2, "2023-03-27"],
  ["Sharmila", "Thevarajah", "Female", "des-hr-exec", 2, "RECENT_2", "Contract"],
  ["Gayani", "Rathnayake", "Female", "des-accountant", 3, "2020-07-13"],
  ["Mohamed", "Rifkhan", "Male", "des-fin-exec", 3, "2022-01-10"],
  ["Nirosha", "Mendis", "Female", "des-accountant", 3, "2019-10-21"],
  ["Pradeep", "Wijeratne", "Male", "des-fin-exec", 3, "2024-04-08"],
  ["Anusha", "Balasubramaniam", "Female", "des-fin-exec", 3, "2023-08-14"],
  ["Shanika", "De Silva", "Female", "des-mkt-mgr", 1, "2020-01-06"],
  ["Chathura", "Alwis", "Male", "des-digital", 32, "2022-08-01"],
  ["Imesha", "Kodikara", "Female", "des-content", 32, "2023-02-13"],
  ["Vishwa", "Jayalath", "Male", "des-digital", 32, "2024-10-07"],
  ["Tharindu", "Rodrigo", "Male", "des-content", 32, "2021-11-15"],
  ["Michelle", "Ludowyke", "Female", "des-digital", 32, "2025-05-19"],
  ["Asanka", "Gamage", "Male", "des-ops-exec", 1, "2020-11-30"],
  ["Hasini", "Munasinghe", "Female", "des-ops-exec", 1, "2022-12-05"],
  ["Suresh", "Nadarajah", "Male", "des-it-support", 1, "2021-03-08"],
];

const streets = ["Temple Road", "Station Road", "Lake Drive", "Flower Road", "Hospital Road", "Park Avenue", "Church Street", "Galle Road", "Kandy Road", "High Level Road"];
const towns = ["Nugegoda", "Maharagama", "Dehiwala", "Kotte", "Battaramulla", "Rajagiriya", "Wattala", "Kelaniya", "Moratuwa", "Negombo", "Kadawatha", "Piliyandala"];
const relationships = ["Spouse", "Parent", "Sibling"];
const skillPool: Record<string, string[]> = {
  "dep-eng": ["TypeScript", "React", "Next.js", "Node.js", "PostgreSQL", "AWS", "Docker", "Kubernetes", "Playwright", "Java", "Python", "CI/CD", "System design"],
  "dep-hr": ["Recruitment", "Employee relations", "Labour law", "Onboarding", "HRIS", "Training"],
  "dep-fin": ["Payroll", "IFRS", "Taxation", "Excel", "Budgeting", "Reconciliation"],
  "dep-mkt": ["SEO", "Content strategy", "Google Ads", "Copywriting", "Social media", "Analytics", "Figma"],
  "dep-ops": ["Vendor management", "ITIL", "Networking", "Procurement", "Facilities", "Process improvement"],
};

const salaryByLevel: Record<string, [number, number]> = {
  Executive: [850000, 850000],
  Manager: [430000, 520000],
  Lead: [400000, 450000],
  Senior: [300000, 360000],
  Mid: [180000, 260000],
  Junior: [120000, 150000],
};

function shiftToWorkingDay(d: Date, direction: 1 | -1) {
  let cur = d;
  for (let i = 0; i < 10 && !isWorkingDay(cur, leaveSettings, holidays); i++) cur = addDays(cur, direction);
  return cur;
}

function workingSpan(start: Date, workDays: number) {
  let end = start;
  let count = 1;
  while (count < workDays) {
    end = addDays(end, 1);
    if (isWorkingDay(end, leaveSettings, holidays)) count++;
  }
  return end;
}

function at(d: Date, h: number, m: number) {
  const x = new Date(d);
  x.setHours(h, m, 0, 0);
  return x.toISOString();
}

export function empId(n: number) {
  return `EMP-${String(n).padStart(4, "0")}`;
}

export function createSeedData(reference: Date): DemoData {
  const rng = createRng(20261030);
  const today = new Date(reference);
  today.setHours(0, 0, 0, 0);
  const todayKey = toDateKey(today);
  const year = today.getFullYear();

  // ---------------- Employees ----------------
  const recent1 = toDateKey(shiftToWorkingDay(addDays(today, -Math.min(today.getDate() - 1, 9)), 1));
  const recent2 = toDateKey(shiftToWorkingDay(addDays(today, -Math.min(today.getDate() - 1, 3)), 1));
  const birthdayOffsets = new Map<number, number>([[5, 6], [21, 2], [34, 11], [27, 19], [9, 24]]);
  const anniversaryOffsets = new Map<number, number>([[6, 4], [38, 9], [17, 15]]);

  const employees: Employee[] = people.map((p, i) => {
    const n = i + 1;
    const [first, last, gender, designationId, managerIdx, joinedRaw, type] = p;
    const designation = designations.find((d) => d.id === designationId)!;
    let joinDate = joinedRaw === "RECENT_1" ? recent1 : joinedRaw === "RECENT_2" ? recent2 : joinedRaw;
    if (joinDate > todayKey) joinDate = todayKey;
    const annivOffset = anniversaryOffsets.get(n);
    if (annivOffset !== undefined) {
      const a = addDays(today, annivOffset);
      joinDate = `${joinDate.slice(0, 4)}-${format(a, "MM-dd")}`;
    }
    const birthYear = rng.int(1978, 2001);
    let dob = `${birthYear}-${String(rng.int(1, 12)).padStart(2, "0")}-${String(rng.int(1, 28)).padStart(2, "0")}`;
    const bOffset = birthdayOffsets.get(n);
    if (bOffset !== undefined) dob = `${birthYear}-${format(addDays(today, bOffset), "MM-dd")}`;
    const pool = skillPool[designation.departmentId];
    const skills = Array.from(new Set([rng.pick(pool), rng.pick(pool), rng.pick(pool)]));
    const phone = () => `+94 7${rng.pick(["0", "1", "2", "5", "6", "7", "8"])} ${rng.int(100, 999)} ${rng.int(1000, 9999)}`;
    const probation = joinDate >= toDateKey(addMonths(today, -6));
    return {
      id: empId(n),
      firstName: first,
      lastName: last,
      email: `${first}.${last.replace(/\s/g, "")}@technova-demo.lk`.toLowerCase(),
      phone: phone(),
      dateOfBirth: dob,
      gender,
      address: `No. ${rng.int(3, 220)}, ${rng.pick(streets)}, ${rng.pick(towns)}`,
      emergencyContact: {
        name: `${rng.pick(["Sunil", "Kumari", "Nimal", "Chandrika", "Lalith", "Shirani", "Ravi", "Anoma"])} ${last}`,
        relationship: rng.pick(relationships),
        phone: phone(),
      },
      departmentId: designation.departmentId,
      designationId,
      managerId: managerIdx ? empId(managerIdx) : null,
      joinDate,
      employmentType: type ?? "Full-time",
      status: probation ? "Probation" : n === 31 ? "Notice Period" : "Active",
      archived: false,
      archivedAt: null,
      skills,
      notes: "",
      avatar: null,
    };
  });

  // ---------------- Salaries ----------------
  const salaries: SalaryStructure[] = employees.map((e, i) => {
    const level = designations.find((d) => d.id === e.designationId)!.level;
    const [lo, hi] = salaryByLevel[level];
    let basic = Math.round((lo + rng.next() * (hi - lo)) / 1000) * 1000;
    if (e.employmentType === "Intern") basic = 65000;
    const isEng = e.departmentId === "dep-eng";
    return {
      employeeId: e.id,
      currency: "LKR",
      frequency: "Monthly",
      basic,
      transportAllowance: e.employmentType === "Intern" ? 7500 : level === "Executive" ? 40000 : rng.pick([15000, 18000, 20000, 25000]),
      mealAllowance: e.employmentType === "Intern" ? 5000 : 10000,
      otherAllowance: level === "Manager" || level === "Lead" || level === "Executive" ? 25000 : rng.pick([0, 0, 5000, 10000]),
      overtimeHours: isEng && rng.chance(0.3) ? rng.pick([6, 8, 10, 12]) : 0,
      bonus: 0,
      loanDeduction: rng.chance(0.15) ? rng.pick([10000, 15000, 20000]) : 0,
      otherDeduction: rng.chance(0.1) ? 2500 : 0,
      effectiveFrom: `${year}-01-01`,
      updatedAt: toDateKey(addDays(today, -rng.int(30, 200))),
    };
  });

  // ---------------- Leave requests ----------------
  type L = [emp: number, type: LeaveTypeId, offset: number, len: number, status: LeaveRequest["status"], half?: boolean, reason?: string];
  const leavePlan: L[] = [
    [4, "annual", -110, 5, "Approved", false, "Family vacation to Ella"],
    [18, "annual", -100, 3, "Approved", false, "Wedding in Kandy"],
    [11, "annual", -90, 4, "Approved", false, "Visiting relatives in Jaffna"],
    [38, "annual", -80, 2, "Approved", false, "Personal errands"],
    [6, "annual", -70, 5, "Approved", false, "Annual vacation"],
    [32, "annual", -64, 4, "Approved", false, "Overseas trip"],
    [5, "casual", -60, 1, "Approved", true, "Bank appointment"],
    [14, "annual", -55, 2, "Approved", false, "Family function"],
    [27, "annual", -50, 3, "Approved", false, "Vacation"],
    [5, "annual", -45, 3, "Approved", false, "Trip to Trincomalee"],
    [37, "annual", -40, 2, "Rejected", false, "Short break"],
    [31, "medical", -38, 2, "Approved", false, "Fever"],
    [35, "unpaid", -34, 2, "Approved", false, "Extended personal leave"],
    [8, "casual", -33, 1, "Approved", false, "House moving"],
    [24, "annual", -28, 2, "Approved", false, "Vacation"],
    [40, "casual", -27, 1, "Approved", false, "Vehicle service"],
    [7, "medical", -25, 2, "Approved", false, "Dental surgery"],
    [20, "casual", -20, 1, "Rejected", false, "Personal work"],
    [22, "casual", -18, 1, "Approved", false, "Child's school event"],
    [10, "annual", -15, 2, "Cancelled", false, "Plans changed"],
    [5, "medical", -12, 1, "Approved", false, "Flu"],
    [34, "casual", -9, 1, "Approved", false, "Family emergency"],
    [13, "unpaid", -8, 1, "Approved", false, "Personal matter"],
    [17, "medical", -6, 1, "Approved", false, "Migraine"],
    [39, "medical", -3, 1, "Approved", false, "Doctor's appointment"],
    [12, "annual", -1, 3, "Approved", false, "Family trip to Galle"],
    [29, "medical", 0, 1, "Approved", false, "Unwell"],
    [25, "casual", 2, 1, "Pending", false, "Attending a family ceremony"],
    [16, "casual", 3, 1, "Pending", false, "Personal appointment"],
    [9, "annual", 5, 2, "Pending", false, "Graduation ceremony"],
    [33, "annual", 10, 3, "Pending", false, "Holiday in Nuwara Eliya"],
    [21, "annual", 14, 5, "Pending", false, "Overseas conference and vacation"],
  ];

  const leaveRequests: LeaveRequest[] = leavePlan.map(([n, typeId, offset, len, status, half, reason], i) => {
    const direction = offset < 0 ? -1 : 1;
    const start = shiftToWorkingDay(addDays(today, offset), direction as 1 | -1);
    const end = half ? start : workingSpan(start, len);
    const startDate = toDateKey(start);
    const endDate = toDateKey(end);
    const emp = employees[n - 1];
    const created = addDays(start, -rng.int(3, 9));
    const createdAt = created > today ? today : created;
    const approverId = emp.managerId ?? "EMP-0002";
    const decided = status === "Approved" || status === "Rejected";
    return {
      id: `LV-${String(i + 1).padStart(4, "0")}`,
      employeeId: emp.id,
      typeId,
      startDate,
      endDate,
      halfDay: !!half,
      halfDaySession: half ? "Morning" : null,
      days: calculateLeaveDays(startDate, endDate, !!half, leaveSettings, holidays),
      reason: reason ?? "",
      attachmentName: typeId === "medical" && len > 1 ? "medical-certificate.pdf" : null,
      status,
      createdAt: at(createdAt, 9, rng.int(5, 55)),
      approverId: decided ? approverId : null,
      decidedAt: decided ? at(addDays(createdAt, 1), 11, rng.int(0, 59)) : null,
      decisionComment: status === "Rejected" ? "Team is at minimum capacity during this period." : status === "Approved" ? "Approved. Enjoy your time off." : "",
      source: "Portal",
    };
  });

  // ---------------- Attendance ----------------
  const demoEmployeeIds = new Set(["EMP-0001", "EMP-0002", "EMP-0003", "EMP-0004", "EMP-0005"]);
  const attendance: AttendanceRecord[] = [];
  const forcedAbsences = new Set<string>();
  // Tharindu (EMP-0036) has three unexplained absences this month → payroll warning
  {
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const days = workingDaysBetween(toDateKey(monthStart), todayKey, leaveSettings, holidays).filter((d) => d < todayKey);
    days.slice(0, 3).forEach((d) => forcedAbsences.add(`EMP-0036|${d}`));
  }
  const referenceMinutes = reference.getHours() * 60 + reference.getMinutes();
  for (let offset = -30; offset <= 0; offset++) {
    const day = addDays(today, offset);
    if (!isWorkingDay(day, leaveSettings, holidays)) continue;
    const key = toDateKey(day);
    for (const e of employees) {
      if (e.joinDate > key) continue;
      const leave = leaveRequests.find(
        (l) => l.employeeId === e.id && l.status === "Approved" && l.startDate <= key && l.endDate >= key,
      );
      const id = `att-${e.id}-${key}`;
      if (offset === 0) {
        if (demoEmployeeIds.has(e.id)) continue;
        if (leave) {
          attendance.push({ id, employeeId: e.id, date: key, clockIn: null, clockOut: null, status: "On Leave", source: "System" });
          continue;
        }
        if (rng.chance(0.06)) continue; // not yet in
        const late = rng.chance(0.12);
        const mins = late ? rng.int(9 * 60 + 16, 9 * 60 + 50) : rng.int(8 * 60 + 25, 9 * 60 + 12);
        if (mins > referenceMinutes) continue;
        attendance.push({ id, employeeId: e.id, date: key, clockIn: at(day, Math.floor(mins / 60), mins % 60), clockOut: null, status: late ? "Late" : "Present", source: "System" });
        continue;
      }
      if (leave) {
        if (leave.halfDay) {
          attendance.push({ id, employeeId: e.id, date: key, clockIn: at(day, 13, rng.int(0, 15)), clockOut: at(day, 17, rng.int(30, 59)), status: "Half Day", source: "System" });
        } else {
          attendance.push({ id, employeeId: e.id, date: key, clockIn: null, clockOut: null, status: "On Leave", source: "System" });
        }
        continue;
      }
      if (forcedAbsences.has(`${e.id}|${key}`) || (!demoEmployeeIds.has(e.id) && rng.chance(0.025))) {
        attendance.push({ id, employeeId: e.id, date: key, clockIn: null, clockOut: null, status: "Absent", source: "System" });
        continue;
      }
      const late = rng.chance(0.1);
      const inMins = late ? rng.int(9 * 60 + 16, 9 * 60 + 48) : rng.int(8 * 60 + 20, 9 * 60 + 12);
      const outMins = rng.int(17 * 60 + 25, 18 * 60 + 50);
      attendance.push({
        id,
        employeeId: e.id,
        date: key,
        clockIn: at(day, Math.floor(inMins / 60), inMins % 60),
        clockOut: at(day, Math.floor(outMins / 60), outMins % 60),
        status: late ? "Late" : "Present",
        source: "System",
      });
    }
  }

  // ---------------- Attendance corrections ----------------
  const pastWorkingDay = (back: number) => toDateKey(shiftToWorkingDay(addDays(today, -back), -1));
  const corrections: AttendanceCorrection[] = [
    { id: "COR-0001", employeeId: "EMP-0010", date: pastWorkingDay(3), clockIn: "08:50", clockOut: "17:45", reason: "Forgot to clock out after the release meeting.", status: "Pending", createdAt: at(addDays(today, -2), 10, 12), reviewerId: null, reviewerComment: "", reviewedAt: null },
    { id: "COR-0002", employeeId: "EMP-0024", date: pastWorkingDay(5), clockIn: "08:45", clockOut: "17:30", reason: "Biometric scanner did not register my entry.", status: "Pending", createdAt: at(addDays(today, -4), 9, 40), reviewerId: null, reviewerComment: "", reviewedAt: null },
    { id: "COR-0003", employeeId: "EMP-0014", date: pastWorkingDay(8), clockIn: "09:00", clockOut: "18:10", reason: "Worked from client site in the morning.", status: "Approved", createdAt: at(addDays(today, -7), 11, 5), reviewerId: "EMP-0004", reviewerComment: "Confirmed with the client visit log.", reviewedAt: at(addDays(today, -6), 14, 20) },
    { id: "COR-0004", employeeId: "EMP-0030", date: pastWorkingDay(10), clockIn: "08:30", clockOut: "17:30", reason: "Clock-in time recorded incorrectly.", status: "Rejected", createdAt: at(addDays(today, -9), 15, 2), reviewerId: "EMP-0003", reviewerComment: "Access logs show arrival at 09:42.", reviewedAt: at(addDays(today, -8), 10, 0) },
  ];

  // ---------------- Payroll history (6 processed months) ----------------
  const payrollRuns: PayrollRun[] = [];
  for (let back = 6; back >= 1; back--) {
    const monthDate = subMonths(new Date(today.getFullYear(), today.getMonth(), 1), back);
    const period = periodKey(monthDate);
    const factor = 0.965 + (6 - back) * 0.007;
    const periodSalaries = salaries.map((s) => ({
      ...s,
      basic: Math.round((s.basic * factor) / 100) * 100,
      bonus: period.endsWith("-04") ? 25000 : period.endsWith("-12") ? 30000 : 0,
      overtimeHours: s.overtimeHours ? rng.pick([4, 6, 8, 10, 12]) : 0,
    }));
    const items = generatePayrollItems(employees, periodSalaries, {
      period,
      settings: payrollSettings,
      leaveSettings,
      holidays,
      leaveRequests,
      attendance: [],
    });
    const payDate = `${period}-${String(payrollSettings.payDay).padStart(2, "0")}`;
    const processed = at(parseISO(payDate), 15, 30);
    payrollRuns.push({
      id: `PR-${period}`,
      period,
      status: "Processed",
      items,
      createdAt: at(addDays(parseISO(payDate), -5), 10, 0),
      createdBy: "EMP-0003",
      submittedAt: at(addDays(parseISO(payDate), -4), 11, 0),
      approvedAt: at(addDays(parseISO(payDate), -3), 16, 0),
      approvedBy: "EMP-0001",
      processedAt: processed,
      processedBy: "EMP-0003",
      payDate,
    });
  }

  // ---------------- Performance ----------------
  const criteria = evaluationCriteria.map((c) => c.id) as CriterionId[];
  const halfLabel = today.getMonth() >= 6 ? `H1 ${year}` : `H2 ${year - 1}`;
  const currentLabel = `Q${Math.floor(today.getMonth() / 3) + 1} ${year}`;
  const evaluations: Evaluation[] = [];
  const makeRatings = (base: number) => {
    const r = {} as Record<CriterionId, number>;
    criteria.forEach((c) => (r[c] = Math.max(1, Math.min(5, base + rng.pick([-1, 0, 0, 0, 1])))));
    return r;
  };
  const avg = (r: Record<CriterionId, number>) => round2(Object.values(r).reduce((a, b) => a + b, 0) / criteria.length);
  const strengths = ["Consistently delivers high quality work on time.", "Strong collaborator who supports teammates.", "Excellent problem solver under pressure.", "Clear communicator with stakeholders.", "Takes ownership of complex tasks."];
  const improvements = ["Could delegate more to grow junior team members.", "Improve estimation accuracy on larger tasks.", "Share knowledge more often through documentation.", "Speak up earlier when blocked.", "Focus on test coverage for new features."];
  const reviewed = [5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 20, 21, 22, 24, 25, 27, 28, 29, 30, 33, 34, 36, 38, 39, 40];
  reviewed.forEach((n) => {
    const e = employees[n - 1];
    const ratings = makeRatings(rng.pick([3, 4, 4, 4, 5]));
    const created = addDays(today, -rng.int(70, 110));
    evaluations.push({
      id: "",
      employeeId: e.id,
      reviewerId: e.managerId ?? "EMP-0002",
      type: "Manager Review",
      period: halfLabel,
      ratings,
      overall: avg(ratings),
      strengths: rng.pick(strengths),
      improvements: rng.pick(improvements),
      comments: "Discussed goals for the next review cycle and agreed on development areas.",
      status: "Submitted",
      createdAt: at(created, 10, 0),
      submittedAt: at(addDays(created, 2), 16, 0),
    });
  });
  [5, 12, 21].forEach((n) => {
    const e = employees[n - 1];
    const ratings = makeRatings(4);
    const created = addDays(today, -rng.int(100, 120));
    evaluations.push({
      id: "", employeeId: e.id, reviewerId: e.id, type: "Self Evaluation", period: halfLabel, ratings, overall: avg(ratings),
      strengths: "Delivered all sprint commitments and mentored a new joiner.",
      improvements: "Want to deepen my knowledge of cloud infrastructure.",
      comments: "", status: "Submitted", createdAt: at(created, 9, 0), submittedAt: at(created, 17, 0),
    });
  });
  [10, 14].forEach((n) => {
    const e = employees[n - 1];
    const ratings = makeRatings(4);
    evaluations.push({
      id: "", employeeId: e.id, reviewerId: "EMP-0004", type: "Manager Review", period: currentLabel, ratings, overall: avg(ratings),
      strengths: "Good progress on the payments module.", improvements: "", comments: "", status: "Draft",
      createdAt: at(addDays(today, -3), 14, 0), submittedAt: null,
    });
  });
  evaluations
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .forEach((ev, i) => (ev.id = `EV-${String(i + 1).padStart(4, "0")}`));

  const goalTitles = ["Complete AWS Solutions Architect certification", "Reduce bug backlog by 30%", "Mentor one associate engineer", "Ship the mobile payroll view", "Improve test coverage to 80%", "Automate monthly reporting", "Lead a knowledge sharing session"];
  const goals: Goal[] = [];
  [5, 6, 7, 9, 10, 11, 12, 14, 16, 20, 24, 27, 33].forEach((n) => {
    for (let g = 0; g < 2; g++) {
      const progress = rng.pick([0, 20, 45, 60, 80, 100]);
      goals.push({
        id: `GOAL-${String(goals.length + 1).padStart(4, "0")}`,
        employeeId: empId(n),
        title: rng.pick(goalTitles),
        dueDate: toDateKey(addDays(today, rng.int(20, 120))),
        progress,
        status: progress === 0 ? "Not Started" : progress === 100 ? "Completed" : "In Progress",
      });
    }
  });

  // ---------------- Notifications & activity ----------------
  const lastPeriod = payrollRuns[payrollRuns.length - 1].period;
  const lastPeriodLabel = format(parseISO(`${lastPeriod}-01`), "MMMM yyyy");
  const n = (
    id: number,
    recipient: { employee?: string; role?: AppNotification["recipientRole"] },
    type: AppNotification["type"],
    title: string,
    message: string,
    link: string,
    hoursAgo: number,
    read = false,
  ): AppNotification => ({
    id: `NTF-${String(id).padStart(4, "0")}`,
    recipientEmployeeId: recipient.employee ?? null,
    recipientRole: recipient.role ?? null,
    type,
    title,
    message,
    link,
    read,
    createdAt: new Date(reference.getTime() - hoursAgo * 3600_000).toISOString(),
  });
  const pending = leaveRequests.filter((l) => l.status === "Pending");
  const nameOf = (id: string) => {
    const e = employees.find((x) => x.id === id)!;
    return `${e.firstName} ${e.lastName}`;
  };
  let nid = 1;
  const notifications: AppNotification[] = [];
  pending.forEach((l, i) => {
    notifications.push(n(nid++, { role: "hr_manager" }, "leave", "New leave request", `${nameOf(l.employeeId)} requested ${l.days} day(s) of ${leaveTypes.find((t) => t.id === l.typeId)!.name.toLowerCase()}.`, "/leave/requests", 3 + i * 7, i > 2));
    const mgr = employees.find((e) => e.id === l.employeeId)!.managerId;
    if (mgr === "EMP-0004") notifications.push(n(nid++, { employee: "EMP-0004" }, "leave", "Leave request awaiting your approval", `${nameOf(l.employeeId)} requested leave from ${l.startDate} to ${l.endDate}.`, "/leave/requests", 3 + i * 7));
  });
  notifications.push(
    n(nid++, { employee: "EMP-0004" }, "attendance", "Attendance correction submitted", `${nameOf("EMP-0010")} requested a correction for ${corrections[0].date}.`, "/attendance/corrections", 46),
    n(nid++, { role: "hr_manager" }, "attendance", "Attendance correction submitted", `${nameOf("EMP-0024")} requested a correction for ${corrections[1].date}.`, "/attendance/corrections", 94, true),
    n(nid++, { employee: "EMP-0005" }, "leave", "Leave request approved", "Your medical leave request was approved by Kasun Bandara.", "/leave/my", 260, true),
    n(nid++, { employee: "EMP-0005" }, "payroll", "Payslip available", `Your payslip for ${lastPeriodLabel} is ready to view and download.`, `/payroll/payslips/PS-${lastPeriod}-EMP-0005`, 30 * 24 - 150),
    n(nid++, { employee: "EMP-0005" }, "performance", "Performance review submitted", `Kasun Bandara submitted your ${halfLabel} performance review.`, "/performance/my", 80 * 24, true),
    n(nid++, { employee: "EMP-0005" }, "system", "Upcoming public holiday", "The office will be closed on the next public holiday. Check the leave calendar for details.", "/leave/calendar", 20),
    n(nid++, { role: "payroll_manager" }, "payroll", `${lastPeriodLabel} payroll processed`, `Payroll for ${payrollRuns[payrollRuns.length - 1].items.length} employees was processed and payslips were generated.`, "/payroll/history", 30 * 24 - 150, true),
    n(nid++, { role: "payroll_manager" }, "payroll", "Payroll run due", `Payroll for ${format(today, "MMMM yyyy")} has not been generated yet. Pay day is the ${payrollSettings.payDay}th.`, "/payroll/process", 5),
    n(nid++, { role: "payroll_manager" }, "employee", "New joiner added", `${nameOf("EMP-0023")} joined on ${employees[22].joinDate}. Salary structure is ready for review.`, "/payroll/salary-structures", 50),
    n(nid++, { role: "admin" }, "employee", "New employee onboarded", `${nameOf("EMP-0023")} joined Software Engineering as an intern.`, "/employees/EMP-0023", 52),
    n(nid++, { role: "admin" }, "payroll", `${lastPeriodLabel} payroll approved`, "You approved the payroll run. Payslips were generated for all employees.", "/payroll/history", 30 * 24 - 120, true),
    n(nid++, { role: "admin" }, "system", "Welcome to TechNova HRMS", "This is a demo workspace with sample data. Use Settings → Demo to reset at any time.", "/settings?tab=demo", 2),
    n(nid++, { role: "hr_manager" }, "performance", "Performance review submitted", `Kasun Bandara submitted ${halfLabel} reviews for the Product team.`, "/performance", 75 * 24, true),
    n(nid++, { role: "hr_manager" }, "employee", "New employee onboarded", `${nameOf("EMP-0026")} joined Human Resources on a contract.`, "/employees/EMP-0026", 70),
    n(nid++, { employee: "EMP-0004" }, "performance", "Draft reviews pending", "You have 2 draft performance reviews to complete.", "/performance", 60),
  );

  const activities: Activity[] = [
    { id: "ACT-0001", actorId: "EMP-0002", type: "employee", text: `added ${nameOf("EMP-0026")} to Human Resources`, link: "/employees/EMP-0026", createdAt: new Date(reference.getTime() - 70 * 3600_000).toISOString() },
    { id: "ACT-0002", actorId: "EMP-0002", type: "employee", text: `added ${nameOf("EMP-0023")} to Software Engineering`, link: "/employees/EMP-0023", createdAt: new Date(reference.getTime() - 52 * 3600_000).toISOString() },
    { id: "ACT-0003", actorId: "EMP-0004", type: "attendance", text: `approved an attendance correction for ${nameOf("EMP-0014")}`, link: "/attendance/corrections", createdAt: new Date(reference.getTime() - 6 * 24 * 3600_000).toISOString() },
    { id: "ACT-0004", actorId: "EMP-0004", type: "leave", text: `approved ${nameOf("EMP-0012")}'s annual leave`, link: "/leave/requests", createdAt: new Date(reference.getTime() - 4 * 24 * 3600_000).toISOString() },
    { id: "ACT-0005", actorId: "EMP-0003", type: "payroll", text: `processed ${lastPeriodLabel} payroll`, link: "/payroll/history", createdAt: payrollRuns[payrollRuns.length - 1].processedAt! },
    { id: "ACT-0006", actorId: "EMP-0001", type: "payroll", text: `approved ${lastPeriodLabel} payroll`, link: "/payroll/history", createdAt: payrollRuns[payrollRuns.length - 1].approvedAt! },
    { id: "ACT-0007", actorId: "EMP-0004", type: "performance", text: `started a ${currentLabel} review for ${nameOf("EMP-0010")}`, link: "/performance", createdAt: at(addDays(today, -3), 14, 0) },
    ...pending.slice(0, 4).map((l, i) => ({
      id: `ACT-${String(8 + i).padStart(4, "0")}`,
      actorId: l.employeeId,
      type: "leave" as const,
      text: `requested ${l.days} day(s) of ${leaveTypes.find((t) => t.id === l.typeId)!.name.toLowerCase()}`,
      link: "/leave/requests",
      createdAt: new Date(reference.getTime() - (3 + i * 7) * 3600_000).toISOString(),
    })),
  ];

  const demoUsers: DemoUser[] = [
    { id: "u-admin", role: "admin", employeeId: "EMP-0001", email: employees[0].email, roleLabel: "Admin", description: "Full access to every module and organization settings." },
    { id: "u-hr", role: "hr_manager", employeeId: "EMP-0002", email: employees[1].email, roleLabel: "HR Manager", description: "Employees, attendance, leave approvals, performance and HR reports." },
    { id: "u-payroll", role: "payroll_manager", employeeId: "EMP-0003", email: employees[2].email, roleLabel: "Payroll Manager", description: "Payroll processing, salary structures, payslips and payroll reports." },
    { id: "u-lead", role: "team_lead", employeeId: "EMP-0004", email: employees[3].email, roleLabel: "Team Lead", description: "Team attendance, leave approvals and performance reviews." },
    { id: "u-employee", role: "employee", employeeId: "EMP-0005", email: employees[4].email, roleLabel: "Employee", description: "Self-service: attendance, leave, payslips, profile and AI assistant." },
  ];

  return {
    company: { ...company },
    departments: departments.map((d) => ({ ...d, createdAt: "2018-01-01" })),
    designations: designations.map((d) => ({ ...d })),
    employees,
    salaries,
    attendance,
    corrections,
    leaveTypes: leaveTypes.map((t) => ({ ...t })),
    leaveRequests,
    leaveSettings: { ...leaveSettings, workingDays: [...leaveSettings.workingDays] },
    holidays: [...holidays],
    payrollRuns,
    payrollSettings: { ...payrollSettings, apitBrackets: payrollSettings.apitBrackets.map((b) => ({ ...b })) },
    evaluations,
    goals,
    notifications,
    activities,
    demoUsers,
    seededAt: reference.toISOString(),
  };
}
