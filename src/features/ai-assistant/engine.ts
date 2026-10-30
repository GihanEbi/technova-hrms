// Deterministic "AI" engine for the demo assistant. It matches intents with simple
// rules and answers from the live demo store, respecting the signed-in role's permissions.
// No external AI service is called and no salary value is ever produced by text generation —
// figures come from the same payroll engine the Payroll module uses.
import { addDays, format, nextDay, parseISO, startOfMonth, type Day } from "date-fns";
import type { ChatCard, DemoData, DemoUser, Employee, LeaveTypeId, Role } from "@/types";
import { can, roleLabels } from "@/lib/permissions";
import { formatDate, formatTime, minutesToHours, periodKey, periodLabel, toDateKey, workedMinutes } from "@/lib/dates";
import { leaveBalances, validateLeave } from "@/lib/leave";
import { generatePayrollItems, runTotals } from "@/lib/payroll";
import { formatMoney } from "@/lib/utils";
import { buildLeaveIndex, buildRecordIndex, describeDay, firstRecordedDay, resolveStatus } from "@/features/attendance/lib";

export interface AssistantContext {
  data: DemoData;
  user: DemoUser;
  me: Employee;
  role: Role;
  now: Date;
}

export interface AssistantReply {
  text: string;
  card?: ChatCard;
}

const name = (e?: Employee) => (e ? `${e.firstName} ${e.lastName}` : "—");
const deny = (role: Role, what: string): AssistantReply => ({
  text: `I can't share ${what} — your current role (${roleLabels[role]}) doesn't have access to it. I only answer with data you're allowed to see. Try asking about your own leave, attendance or payslips instead.`,
});

// ---------------------------------------------------------------- date parsing
const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function findDates(text: string, today: Date): Date[] {
  const t = text.toLowerCase();
  const found: { idx: number; date: Date }[] = [];
  const push = (idx: number, date: Date) => found.push({ idx, date });
  let m: RegExpExecArray | null;
  const iso = /(\d{4})-(\d{2})-(\d{2})/g;
  while ((m = iso.exec(t))) push(m.index, parseISO(m[0]));
  const dm = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/g;
  while ((m = dm.exec(t))) push(m.index, resolveMonthDay(Number(m[1]), months.indexOf(m[2]), today));
  const md = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?\b/g;
  while ((m = md.exec(t))) push(m.index, resolveMonthDay(Number(m[2]), months.indexOf(m[1]), today));
  const rel: [RegExp, (d: Date) => Date][] = [
    [/\bday after tomorrow\b/g, (d) => addDays(d, 2)],
    [/(?<!after )\btomorrow\b/g, (d) => addDays(d, 1)],
    [/\btoday\b/g, (d) => d],
  ];
  for (const [re, fn] of rel) while ((m = re.exec(t))) push(m.index, fn(today));
  const wd = /\b(?:next|on|this|coming)?\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/g;
  while ((m = wd.exec(t))) push(m.index, nextDay(today, weekdays.indexOf(m[1]) as Day));
  if (/\bnext week\b/.test(t) && found.length === 0) {
    const mon = nextDay(today, 1);
    push(t.indexOf("next week"), mon);
    push(t.indexOf("next week") + 1, addDays(mon, 4));
  }
  return found.sort((a, b) => a.idx - b.idx).map((f) => f.date);
}

function resolveMonthDay(day: number, month: number, today: Date) {
  let d = new Date(today.getFullYear(), month, day);
  if (toDateKey(d) < toDateKey(today) && today.getMonth() - month > 2) d = new Date(today.getFullYear() + 1, month, day);
  return d;
}

function addWorkingDays(start: Date, n: number, data: DemoData) {
  let d = start;
  let count = describeDay(toDateKey(d), data.leaveSettings, data.holidays).working ? 1 : 0;
  while (count < n) {
    d = addDays(d, 1);
    if (describeDay(toDateKey(d), data.leaveSettings, data.holidays).working) count++;
  }
  return d;
}

function detectLeaveType(t: string): LeaveTypeId {
  if (/\b(sick|medical|doctor|unwell|ill)\b/.test(t)) return "medical";
  if (/\bcasual\b/.test(t)) return "casual";
  if (/\bunpaid|no pay\b/.test(t)) return "unpaid";
  return "annual";
}

// ---------------------------------------------------------------- intents
export function respond(input: string, ctx: AssistantContext): AssistantReply {
  const t = input.toLowerCase().trim();
  const { data, me, role, now } = ctx;
  const today = toDateKey(now);

  if (!t) return { text: "Ask me anything about leave, attendance, payslips or HR policies." };

  if (/^(hi|hello|hey|good (morning|afternoon|evening))\b|what can you do|^help\b/.test(t)) return help(ctx);

  // ---- leave application (must run before the balance intent) ----
  if (/(apply|request|book|take|submit|file|need|want).{0,40}(leave|day off|time off|vacation|holiday)|can i (apply|take).{0,30}leave|leave (tomorrow|today|on|from|next)/.test(t) && !/policy/.test(t)) {
    return proposeLeave(t, ctx);
  }

  if (/(leave (balance|days|left|remaining)|how many (leave|days)|days (of leave )?(left|remaining)|remaining leave|my balance)/.test(t)) {
    const balances = leaveBalances(me.id, data.leaveTypes, data.leaveRequests, now.getFullYear());
    const annual = balances.find((b) => b.type.id === "annual");
    return {
      text: `Here's your ${now.getFullYear()} leave balance, ${me.firstName}. You have ${annual?.available ?? 0} annual leave day(s) available${annual?.pending ? ` (${annual.pending} day(s) are pending approval)` : ""}.`,
      card: {
        kind: "stats",
        title: "Leave balance",
        items: balances.map((b) => ({
          label: b.type.name,
          value: b.available === Infinity ? "No limit" : `${b.available} of ${b.allocation} days`,
          tone: b.available === Infinity ? "default" : b.available <= 2 ? "warning" : "success",
        })),
      },
    };
  }

  if (/polic|rule|entitle|allowance/.test(t) && /leave|annual|casual|medical|sick|unpaid/.test(t)) {
    const typeId = /casual/.test(t) ? "casual" : /medical|sick/.test(t) ? "medical" : /unpaid/.test(t) ? "unpaid" : /annual/.test(t) ? "annual" : null;
    const types = typeId ? data.leaveTypes.filter((x) => x.id === typeId) : data.leaveTypes.filter((x) => x.active);
    return {
      text: typeId
        ? `${types[0].name}: ${types[0].description} ${types[0].allocation ? `You get ${types[0].allocation} days per year` : "There is no annual limit"}, up to ${types[0].maxConsecutive} consecutive days${types[0].noticeDays ? `, with at least ${types[0].noticeDays} days' notice` : ""}. (Illustrative company policy.)`
        : "Here's a summary of TechNova's leave policy (illustrative values):",
      card: {
        kind: "table",
        title: "Leave policy",
        columns: ["Leave type", "Days / year", "Notice", "Max in a row"],
        rows: types.map((x) => [x.name, x.allocation ? String(x.allocation) : "Unlimited", x.noticeDays ? `${x.noticeDays} days` : "None", `${x.maxConsecutive} days`]),
        link: { href: "/leave/policies", label: "Open leave policies" },
      },
    };
  }

  if (/holiday/.test(t)) {
    const upcoming = data.holidays.filter((h) => h.date >= today).slice(0, 6);
    return {
      text: upcoming.length ? `The next public holiday is ${upcoming[0].name} on ${formatDate(upcoming[0].date, "EEEE, d MMMM")}.` : "There are no more holidays in the calendar.",
      card: upcoming.length ? { kind: "table", title: "Upcoming holidays", columns: ["Date", "Holiday"], rows: upcoming.map((h) => [formatDate(h.date, "EEE, d MMM yyyy"), h.name]), link: { href: "/leave/calendar", label: "Open leave calendar" } } : undefined,
    };
  }

  // ---- organisation-wide questions ----
  if (/(absent|present|who.{0,10}(out|off|in)|attendance).{0,20}today|today.{0,20}(absent|attendance)/.test(t)) return todayAttendance(ctx);

  if (/pending.{0,20}(leave|request|approval)|leave requests?.{0,10}pending|(show|list).{0,10}leave requests/.test(t)) {
    if (!can(role, "leave.approve")) return deny(role, "other people's leave requests");
    const scope = role === "team_lead" ? data.employees.filter((e) => e.managerId === me.id).map((e) => e.id) : null;
    const pending = data.leaveRequests.filter((l) => l.status === "Pending" && (!scope || scope.includes(l.employeeId)));
    return {
      text: pending.length ? `There ${pending.length === 1 ? "is 1 pending leave request" : `are ${pending.length} pending leave requests`}${scope ? " in your team" : ""}.` : "There are no pending leave requests. 🎉",
      card: pending.length
        ? {
            kind: "table",
            title: "Pending leave requests",
            columns: ["Request", "Employee", "Type", "Dates", "Days"],
            rows: pending.map((l) => [l.id, name(data.employees.find((e) => e.id === l.employeeId)), data.leaveTypes.find((x) => x.id === l.typeId)?.name ?? l.typeId, `${formatDate(l.startDate, "d MMM")}${l.endDate !== l.startDate ? ` – ${formatDate(l.endDate, "d MMM")}` : ""}`, String(l.days)]),
            link: { href: "/leave/requests", label: "Review requests" },
          }
        : undefined,
    };
  }

  if (/(joined|new (hire|joiner|employee)s?|onboard)/.test(t)) {
    if (!can(role, "employees.view") || role === "team_lead") return deny(role, "company-wide hiring data");
    const monthStart = toDateKey(startOfMonth(now));
    const joined = data.employees.filter((e) => !e.archived && e.joinDate >= monthStart && e.joinDate <= today);
    return {
      text: joined.length ? `${joined.length} employee${joined.length === 1 ? "" : "s"} joined in ${format(now, "MMMM yyyy")}.` : `Nobody has joined in ${format(now, "MMMM yyyy")} yet.`,
      card: joined.length
        ? { kind: "table", title: `Joined in ${format(now, "MMMM")}`, columns: ["Employee", "Designation", "Department", "Joined"], rows: joined.map((e) => [name(e), data.designations.find((d) => d.id === e.designationId)?.title ?? "", data.departments.find((d) => d.id === e.departmentId)?.name ?? "", formatDate(e.joinDate)]), link: { href: "/employees", label: "Open employee directory" } }
        : undefined,
    };
  }

  if (/how many.{0,30}(employee|people|staff|work)|headcount/.test(t) && !/leave/.test(t)) return headcount(t, ctx);

  if (/(summar|overview|report|rate).{0,20}attendance|attendance.{0,20}(summar|overview|report|rate|this month|last month)/.test(t) && !/\bmy\b/.test(t)) {
    if (/\bmy\b|\bme\b/.test(t) || !(can(role, "attendance.viewAll") || can(role, "attendance.viewTeam"))) return myAttendance(ctx);
    return attendanceSummary(ctx);
  }

  if (/(my )?attendance|clock(ed)? in|late (days|this month)|hours (worked|this month)/.test(t)) return myAttendance(ctx);

  // ---- payroll ----
  if (/warning|issue|problem|error/.test(t) && /payroll|salar|calculation/.test(t)) return payrollWarnings(ctx);
  if (/pending payroll|payroll (status|records)|unprocessed/.test(t)) return pendingPayroll(ctx);
  if (/(total|this month|monthly|month's).{0,20}payroll|payroll.{0,20}(total|this month|cost)/.test(t)) return payrollTotal(ctx);
  if (/salary expense|summar.{0,12}(salar|payroll)|payroll summary|cost by department|salary cost/.test(t)) return salaryExpenses(ctx);
  if (/(my )?(latest |last )?(salary|payslip|pay slip|net pay|pay)\b/.test(t)) {
    const reply = myPayslip(ctx);
    const link = payslipLinkCard(ctx);
    if (/show|open|view|download|see/.test(t) && link) return { text: reply.text, card: link };
    return reply;
  }

  return {
    text: "I'm a demo assistant, so I only understand a set of HR questions. Here are some things you can ask me:",
    card: { kind: "table", title: "Try asking", columns: ["Question"], rows: suggestionsFor(role).map((s) => [s]) },
  };
}

function help(ctx: AssistantContext): AssistantReply {
  return {
    text: `Hi ${ctx.me.firstName}! I'm the TechNova HR assistant (a demo simulation). I answer from live HR records and only show what your role (${roleLabels[ctx.role]}) can access. I can check leave balances, apply for leave on your behalf, summarise attendance, find payslips and explain policies.`,
    card: { kind: "table", title: "Try asking", columns: ["Question"], rows: suggestionsFor(ctx.role).map((s) => [s]) },
  };
}

export function suggestionsFor(role: Role) {
  const base = ["How many leave days do I have?", "Show my attendance this month.", "What is my latest salary?", "Apply for annual leave next Monday", "What is the annual leave policy?"];
  if (role === "hr_manager" || role === "admin") return ["How many employees are absent today?", "Show pending leave requests.", "Which employees joined this month?", "Summarize employee attendance.", "How many employees work in IT?", ...(role === "admin" ? ["What is this month's total payroll?"] : [])];
  if (role === "payroll_manager") return ["What is this month's total payroll?", "Are there any payroll calculation warnings?", "Show pending payroll records.", "Summarize salary expenses.", "How many leave days do I have?"];
  if (role === "team_lead") return ["Show pending leave requests.", "How many employees are absent today?", "Summarize employee attendance.", ...base.slice(0, 3)];
  return [...base, "Can I apply for leave tomorrow?", "Show my payslip."];
}

function proposeLeave(t: string, ctx: AssistantContext): AssistantReply {
  const { data, me, now } = ctx;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const typeId = detectLeaveType(t);
  const type = data.leaveTypes.find((x) => x.id === typeId)!;
  const dates = findDates(t, today);
  if (dates.length === 0)
    return { text: `Sure — which dates would you like ${type.name.toLowerCase()} for? For example: "Apply for ${type.name.toLowerCase()} next Monday for 2 days" or "Apply for casual leave on 6 Nov".` };
  let start = dates[0];
  let end = dates[1] ?? dates[0];
  const forDays = /for (\d{1,2}) (working )?days?/.exec(t);
  if (forDays && !dates[1]) end = addWorkingDays(start, Number(forDays[1]), data);
  if (end < start) [start, end] = [end, start];
  const startDate = toDateKey(start);
  const endDate = toDateKey(end);
  const halfDay = /half[ -]?day/.test(t) && startDate === endDate;
  if (startDate < toDateKey(today)) return { text: `${formatDate(startDate, "EEEE, d MMM")} is in the past. Leave can only be requested for today or a future date.` };
  const startInfo = describeDay(startDate, data.leaveSettings, data.holidays);
  const check = validateLeave({ employeeId: me.id, typeId, startDate, endDate, halfDay, types: data.leaveTypes, requests: data.leaveRequests, settings: data.leaveSettings, holidays: data.holidays });
  if (!check.ok) {
    const extra = !startInfo.working && startDate === endDate ? ` ${formatDate(startDate, "EEEE, d MMM")} is ${startInfo.kind === "holiday" ? `a public holiday (${startInfo.label})` : "a weekend"}, so you don't need leave that day.` : "";
    return { text: `I can't submit that request: ${check.error}${extra}` };
  }
  const balance = leaveBalances(me.id, data.leaveTypes, data.leaveRequests, start.getFullYear()).find((b) => b.type.id === typeId);
  const balanceAfter = balance && balance.available !== Infinity ? balance.available - check.days : null;
  const reasonMatch = /(?:because|for|reason:?)\s+(?!\d)(?!annual|casual|medical|unpaid|leave)([a-z][^.!?]{3,60})/.exec(t);
  const reason = reasonMatch && !/days?$/.test(reasonMatch[1].trim()) ? reasonMatch[1].trim().replace(/^./, (c) => c.toUpperCase()) : "Requested via the AI assistant";
  const asking = /^can i|^am i able/.test(t);
  return {
    text: `${asking ? "Yes, you can. " : ""}I've checked your balance and the team calendar. Here's the request I'll submit — please review and confirm.${check.warning ? ` Note: ${check.warning}` : ""}`,
    card: { kind: "leave-proposal", status: "proposed", employeeId: me.id, typeId, startDate, endDate, days: check.days, reason, balanceAfter },
  };
}

function todayAttendance(ctx: AssistantContext): AssistantReply {
  const { data, me, role, now } = ctx;
  if (!(can(role, "attendance.viewAll") || can(role, "attendance.viewTeam"))) return deny(role, "organisation-wide attendance");
  const today = toDateKey(now);
  const scope = data.employees.filter((e) => !e.archived && (role !== "team_lead" || e.managerId === me.id));
  const day = describeDay(today, data.leaveSettings, data.holidays);
  if (!day.working) return { text: `Today is ${day.kind === "holiday" ? `a public holiday (${day.label})` : day.label}, so attendance isn't tracked.` };
  const leaveOf = buildLeaveIndex(data.leaveRequests);
  const recordOf = buildRecordIndex(data.attendance);
  const dataStart = firstRecordedDay(data.attendance);
  const rows = scope.map((e) => ({ e, s: resolveStatus({ key: today, today, day, record: recordOf(e.id, today), leave: leaveOf(e.id, today), joinDate: e.joinDate, dataStart }) }));
  const count = (s: string) => rows.filter((r) => r.s === s).length;
  const absent = rows.filter((r) => r.s === "Absent" || r.s === "Not clocked in" || r.s === "On Leave");
  return {
    text: `As of ${format(now, "hh:mm a")}, ${count("Present") + count("Late")} of ${scope.length} ${role === "team_lead" ? "team members" : "employees"} have clocked in. ${count("On Leave")} ${count("On Leave") === 1 ? "is" : "are"} on approved leave and ${count("Not clocked in") + count("Absent")} ${count("Not clocked in") + count("Absent") === 1 ? "hasn't" : "haven't"} clocked in yet.`,
    card: {
      kind: "table",
      title: "Not in the office right now",
      columns: ["Employee", "Department", "Status"],
      rows: absent.map(({ e, s }) => [name(e), data.departments.find((d) => d.id === e.departmentId)?.name ?? "", s]),
      link: { href: "/attendance", label: "Open daily attendance" },
    },
  };
}

function myAttendance(ctx: AssistantContext): AssistantReply {
  const { data, me, now } = ctx;
  const monthStart = toDateKey(startOfMonth(now));
  const today = toDateKey(now);
  const recs = data.attendance.filter((a) => a.employeeId === me.id && a.date >= monthStart && a.date <= today).sort((a, b) => b.date.localeCompare(a.date));
  const n = (s: string) => recs.filter((r) => r.status === s).length;
  const mins = recs.map((r) => workedMinutes(r.clockIn, r.clockOut)).filter(Boolean);
  const total = mins.reduce((a, b) => a + b, 0);
  return {
    text: `Here's your attendance for ${format(now, "MMMM yyyy")}: ${n("Present")} on time, ${n("Late")} late, ${n("Absent")} absent and ${n("On Leave") + n("Half Day")} on leave, with ${minutesToHours(total)} logged.`,
    card: {
      kind: "table",
      title: `My attendance · ${format(now, "MMMM")}`,
      columns: ["Date", "Clock in", "Clock out", "Status"],
      rows: recs.slice(0, 8).map((r) => [formatDate(r.date, "EEE, d MMM"), formatTime(r.clockIn), formatTime(r.clockOut), r.status]),
      link: { href: "/attendance/my", label: "View full history" },
    },
  };
}

function attendanceSummary(ctx: AssistantContext): AssistantReply {
  const { data, me, role, now } = ctx;
  const from = toDateKey(addDays(now, -30));
  const today = toDateKey(now);
  const scope = new Set(data.employees.filter((e) => !e.archived && (role !== "team_lead" || e.managerId === me.id)).map((e) => e.id));
  const recs = data.attendance.filter((a) => scope.has(a.employeeId) && a.date >= from && a.date < today);
  const worked = recs.filter((r) => r.status === "Present" || r.status === "Late" || r.status === "Half Day");
  const late = recs.filter((r) => r.status === "Late").length;
  const absent = recs.filter((r) => r.status === "Absent").length;
  const avg = worked.length ? worked.reduce((s, r) => s + workedMinutes(r.clockIn, r.clockOut), 0) / worked.length : 0;
  const byDept = data.departments
    .filter((d) => !d.archived)
    .map((d) => {
      const ids = new Set(data.employees.filter((e) => e.departmentId === d.id && scope.has(e.id)).map((e) => e.id));
      const r = recs.filter((x) => ids.has(x.employeeId));
      const att = r.filter((x) => x.status !== "Absent" && x.status !== "On Leave").length;
      return { d, total: r.length, rate: r.length ? (att / r.length) * 100 : 0, late: r.filter((x) => x.status === "Late").length };
    })
    .filter((x) => x.total > 0);
  return {
    text: `Over the last 30 days ${role === "team_lead" ? "your team" : "the company"} recorded ${worked.length} attended days, ${late} late arrivals (${recs.length ? ((late / recs.length) * 100).toFixed(1) : 0}%) and ${absent} unexplained absences. Average time worked was ${minutesToHours(avg)} per day.`,
    card: {
      kind: "table",
      title: "Attendance by department · last 30 days",
      columns: ["Department", "Attendance rate", "Late arrivals"],
      rows: byDept.map((x) => [x.d.name, `${x.rate.toFixed(1)}%`, String(x.late)]),
      link: { href: role === "team_lead" ? "/attendance" : "/reports/attendance", label: role === "team_lead" ? "Open attendance" : "Open attendance report" },
    },
  };
}

function headcount(t: string, ctx: AssistantContext): AssistantReply {
  const { data, role, me } = ctx;
  if (!can(role, "employees.view")) return deny(role, "headcount figures");
  const active = data.employees.filter((e) => !e.archived && (role !== "team_lead" || e.managerId === me.id));
  const aliases: Record<string, string> = { it: "dep-eng", engineering: "dep-eng", software: "dep-eng", tech: "dep-eng", hr: "dep-hr", "human resources": "dep-hr", finance: "dep-fin", accounts: "dep-fin", marketing: "dep-mkt", operations: "dep-ops", ops: "dep-ops" };
  const key = Object.keys(aliases).find((k) => new RegExp(`\\b${k}\\b`).test(t));
  if (key) {
    const dep = data.departments.find((d) => d.id === aliases[key])!;
    const people = active.filter((e) => e.departmentId === dep.id);
    return {
      text: `${people.length} ${role === "team_lead" ? "of your team members work" : "employees work"} in ${dep.name}${key === "it" ? " (our IT / software engineering team)" : ""}.`,
      card: { kind: "table", title: dep.name, columns: ["Designation", "Employees"], rows: Object.entries(people.reduce<Record<string, number>>((m, e) => { const d = data.designations.find((x) => x.id === e.designationId)?.title ?? ""; m[d] = (m[d] ?? 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]).map(([d, n]) => [d, String(n)]), link: { href: "/employees", label: "Open employee directory" } },
    };
  }
  return {
    text: `${data.company.name} has ${active.length} active ${role === "team_lead" ? "team members" : "employees"}.`,
    card: { kind: "stats", title: "Headcount by department", items: data.departments.filter((d) => !d.archived).map((d) => ({ label: d.name, value: String(active.filter((e) => e.departmentId === d.id).length) })) },
  };
}

function currentDraftItems(ctx: AssistantContext) {
  const { data, now } = ctx;
  const period = periodKey(now);
  const run = data.payrollRuns.find((r) => r.period === period);
  const items = run?.items ?? generatePayrollItems(data.employees, data.salaries, { period, settings: data.payrollSettings, leaveSettings: data.leaveSettings, holidays: data.holidays, leaveRequests: data.leaveRequests, attendance: data.attendance });
  return { period, run, items };
}

function payrollTotal(ctx: AssistantContext): AssistantReply {
  if (!can(ctx.role, "payroll.view")) return deny(ctx.role, "company payroll totals");
  const { period, run, items } = currentDraftItems(ctx);
  const t = runTotals(items);
  return {
    text: run
      ? `${periodLabel(period)} payroll is ${run.status === "Processed" ? "processed" : `in ${run.status} status`}: net pay of ${formatMoney(t.net)} for ${t.employees} employees.`
      : `${periodLabel(period)} payroll hasn't been generated yet. Based on current salary structures, the projected net payroll is ${formatMoney(t.net)} for ${t.employees} employees.`,
    card: {
      kind: "stats",
      title: `${periodLabel(period)} payroll${run ? ` · ${run.status}` : " · projection"}`,
      items: [
        { label: "Gross pay", value: formatMoney(t.gross) },
        { label: "Deductions", value: formatMoney(t.deductions) },
        { label: "Net pay", value: formatMoney(t.net), tone: "success" },
        { label: "Employer cost", value: formatMoney(t.employerCost) },
      ],
    },
  };
}

function payrollWarnings(ctx: AssistantContext): AssistantReply {
  if (!can(ctx.role, "payroll.view")) return deny(ctx.role, "payroll calculation details");
  const { period, run, items } = currentDraftItems(ctx);
  const flagged = items.filter((i) => i.warnings.length);
  return {
    text: flagged.length
      ? `I found ${flagged.reduce((s, i) => s + i.warnings.length, 0)} warning(s) across ${flagged.length} employee(s) in the ${periodLabel(period)} payroll${run ? "" : " projection"}. Review them before processing.`
      : `No calculation warnings for ${periodLabel(period)}. Everything looks consistent.`,
    card: flagged.length
      ? { kind: "table", title: "Payroll warnings", columns: ["Employee", "Warning"], rows: flagged.flatMap((i) => i.warnings.map((w) => [name(ctx.data.employees.find((e) => e.id === i.employeeId)), w])), link: { href: "/payroll/process", label: "Open payroll processing" } }
      : undefined,
  };
}

function pendingPayroll(ctx: AssistantContext): AssistantReply {
  if (!can(ctx.role, "payroll.view")) return deny(ctx.role, "payroll records");
  const open = ctx.data.payrollRuns.filter((r) => r.status !== "Processed");
  const period = periodKey(ctx.now);
  const hasCurrent = ctx.data.payrollRuns.some((r) => r.period === period);
  return {
    text: open.length ? `There ${open.length === 1 ? "is 1 payroll run" : `are ${open.length} payroll runs`} not yet processed.` : `All generated payroll runs are processed.${hasCurrent ? "" : ` ${periodLabel(period)} payroll hasn't been started yet.`}`,
    card: {
      kind: "table",
      title: "Payroll runs",
      columns: ["Period", "Status", "Employees", "Net pay"],
      rows: [...(hasCurrent ? [] : [[periodLabel(period), "Not started", "—", "—"]]), ...[...ctx.data.payrollRuns].sort((a, b) => b.period.localeCompare(a.period)).slice(0, 4).map((r) => [periodLabel(r.period), r.status, String(r.items.length), formatMoney(runTotals(r.items).net)])],
      link: { href: "/payroll/process", label: "Go to payroll" },
    },
  };
}

function salaryExpenses(ctx: AssistantContext): AssistantReply {
  if (!can(ctx.role, "payroll.view")) return deny(ctx.role, "salary expenses");
  const latest = ctx.data.payrollRuns.filter((r) => r.status === "Processed").sort((a, b) => b.period.localeCompare(a.period))[0];
  if (!latest) return { text: "There is no processed payroll yet." };
  const t = runTotals(latest.items);
  const byDept = ctx.data.departments.map((d) => {
    const ids = new Set(ctx.data.employees.filter((e) => e.departmentId === d.id).map((e) => e.id));
    const items = latest.items.filter((i) => ids.has(i.employeeId));
    return [d.name, String(items.length), formatMoney(items.reduce((s, i) => s + i.gross, 0))];
  });
  return {
    text: `In ${periodLabel(latest.period)} TechNova spent ${formatMoney(t.employerCost)} on salaries including employer EPF and ETF: ${formatMoney(t.gross)} gross pay (${formatMoney(t.allowances)} in allowances) and ${formatMoney(t.epfEmployer + t.etf)} in employer contributions.`,
    card: { kind: "table", title: `Gross pay by department · ${periodLabel(latest.period)}`, columns: ["Department", "Employees", "Gross pay"], rows: byDept, link: { href: "/reports/payroll", label: "Open payroll report" } },
  };
}

function myPayslip(ctx: AssistantContext): AssistantReply {
  const { data, me } = ctx;
  const run = data.payrollRuns.filter((r) => r.status === "Processed" && r.items.some((i) => i.employeeId === me.id)).sort((a, b) => b.period.localeCompare(a.period))[0];
  const item = run?.items.find((i) => i.employeeId === me.id);
  if (!run || !item) return { text: "You don't have any payslips yet. They appear once a payroll run that includes you is processed." };
  return {
    text: `Your latest payslip is for ${periodLabel(run.period)}. Your net pay was ${formatMoney(item.net)}, paid on ${formatDate(run.payDate)}.`,
    card: {
      kind: "stats",
      title: `Payslip · ${periodLabel(run.period)}`,
      items: [
        { label: "Gross pay", value: formatMoney(item.gross) },
        { label: "Deductions", value: formatMoney(item.totalDeductions), tone: "warning" },
        { label: "Net pay", value: formatMoney(item.net), tone: "success" },
        { label: "Pay date", value: formatDate(run.payDate) },
      ],
    },
  };
}

export function payslipLinkCard(ctx: AssistantContext): ChatCard | undefined {
  const run = ctx.data.payrollRuns.filter((r) => r.status === "Processed" && r.items.some((i) => i.employeeId === ctx.me.id)).sort((a, b) => b.period.localeCompare(a.period))[0];
  if (!run) return undefined;
  return { kind: "link", title: `Payslip for ${periodLabel(run.period)}`, description: "View, print or download the PDF.", href: `/payroll/payslips/PS-${run.period}-${ctx.me.id}`, label: "Open payslip" };
}
