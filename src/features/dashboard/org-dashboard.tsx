"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarCheck, CalendarDays, CalendarPlus, Calculator, ClipboardCheck, Star, UserCheck, UserPlus, Users, Wallet, AlertTriangle, Receipt, FileText } from "lucide-react";
import { useHRStore } from "@/store/hr-store";
import { useAuth } from "@/hooks/use-hr";
import { can } from "@/lib/permissions";
import { addDays, formatDate, fromDateKey, periodKey, periodLabel, todayKey, now, toDateKey } from "@/lib/dates";
import { runTotals, eligibleEmployees } from "@/lib/payroll";
import { formatCompactMoney, formatMoney } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/overlays";
import { DatePicker } from "@/components/forms/fields";
import { FadeIn, KpiCard } from "@/components/shared/common";
import { ActivitiesCard, AiShortcutCard, AttendanceChart, CelebrationsCard, DemoDateNotice, DepartmentChart, Greeting, LeaveSummaryChart, PayrollTrendChart, PendingApprovalsCard, QuickActionsCard, type ApprovalItem } from "./widgets";
import { lastWorkingDays, makeAttendanceCounter } from "./stats";

export function OrgDashboard() {
  const { role, employee: me } = useAuth();
  const data = useHRStore((s) => s.data);
  const today = todayKey();
  const [date, setDate] = React.useState(today);
  const [range, setRange] = React.useState("7");

  const active = React.useMemo(() => data.employees.filter((e) => !e.archived), [data.employees]);
  const counter = React.useMemo(() => makeAttendanceCounter(data, today), [data, today]);
  const dayCounts = counter(active, date);
  const trendDays = React.useMemo(() => lastWorkingDays(data, date, Number(range)).map((k) => counter(active, k)), [data, date, range, counter, active]);

  const showHR = can(role, "employees.view");
  const showPay = can(role, "payroll.view");
  const pendingLeave = data.leaveRequests.filter((l) => l.status === "Pending");
  const pendingCorrections = data.corrections.filter((c) => c.status === "Pending");
  const newHires = active.filter((e) => e.joinDate <= date && e.joinDate >= toDateKey(addDays(fromDateKey(date), -30)));

  const processed = data.payrollRuns.filter((r) => r.status === "Processed").sort((a, b) => b.period.localeCompare(a.period));
  const latest = processed[0];
  const prev = processed[1];
  const latestTotals = latest ? runTotals(latest.items) : null;
  const prevTotals = prev ? runTotals(prev.items) : null;
  const payTrend = latestTotals && prevTotals ? ((latestTotals.net - prevTotals.net) / prevTotals.net) * 100 : null;
  const currentPeriod = periodKey(now());
  const currentRun = data.payrollRuns.find((r) => r.period === currentPeriod);

  const lookup = (id: string) => data.employees.find((e) => e.id === id);
  const approvals: ApprovalItem[] = [];
  if (showPay && currentRun?.status === "Pending Approval")
    approvals.push({ id: currentRun.id, kind: "Payroll", title: `${periodLabel(currentRun.period)} payroll`, meta: `${currentRun.items.length} employees · submitted for approval`, href: "/payroll/process" });
  if (showHR) {
    pendingLeave.forEach((l) => {
      const e = lookup(l.employeeId);
      approvals.push({ id: l.id, kind: "Leave", employee: e, title: `${e?.firstName} ${e?.lastName}`, meta: `${data.leaveTypes.find((t) => t.id === l.typeId)?.name} · ${l.days} day(s) from ${formatDate(l.startDate, "d MMM")}`, href: "/leave/requests" });
    });
    pendingCorrections.forEach((c) => {
      const e = lookup(c.employeeId);
      approvals.push({ id: c.id, kind: "Correction", employee: e, title: `${e?.firstName} ${e?.lastName}`, meta: `Attendance correction for ${formatDate(c.date, "d MMM")}`, href: "/attendance/corrections" });
    });
  }

  const isToday = date === today;
  const quickActions = [
    ...(can(role, "employees.manage") ? [{ label: "Add employee", description: "Create a new employee record", href: "/employees/new", icon: UserPlus }] : []),
    ...(showHR ? [{ label: "Review leave", description: `${pendingLeave.length} pending requests`, href: "/leave/requests", icon: ClipboardCheck }] : []),
    ...(showPay ? [{ label: "Process payroll", description: `${periodLabel(currentPeriod)} payroll`, href: "/payroll/process", icon: Calculator }] : []),
    ...(showPay ? [{ label: "Salary structures", description: "Review pay components", href: "/payroll/salary-structures", icon: FileText }] : []),
    ...(can(role, "performance.manage") ? [{ label: "New evaluation", description: "Start a performance review", href: "/performance/new", icon: Star }] : []),
    { label: "Apply for leave", description: "Request time off for yourself", href: "/leave/apply", icon: CalendarPlus },
  ].slice(0, 6);

  const prompts =
    role === "payroll_manager"
      ? ["What is this month's total payroll?", "Are there any payroll calculation warnings?", "Summarize salary expenses."]
      : ["How many employees are absent today?", "Show pending leave requests.", "Which employees joined this month?"];

  return (
    <FadeIn>
      <DemoDateNotice />
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              <Greeting firstName={me.firstName} />
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Here&apos;s what&apos;s happening at {data.company.name} {isToday ? "today" : `on ${formatDate(date, "EEEE, d MMM")}`}.
            </p>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-2 sm:flex">
            <div className="sm:w-56">
              <DatePicker value={date} onChange={setDate} ariaLabel="Dashboard date" disabledDays={{ after: fromDateKey(today) }} />
            </div>
            <Select value={range} onValueChange={setRange}>
              <SelectTrigger className="w-[140px]" aria-label="Chart range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="14">Last 14 days</SelectItem>
                <SelectItem value="22">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
      </div>

      <section aria-label="Key metrics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {showHR && <KpiCard testId="kpi-total-employees" label="Total employees" value={active.length} icon={Users} href="/employees" hint={`${data.departments.filter((d) => !d.archived).length} departments`} />}
        {showHR && (
          <KpiCard
            testId="kpi-present"
            label={isToday ? "Present today" : "Present"}
            value={dayCounts.working ? dayCounts.present + dayCounts.late : "—"}
            icon={UserCheck}
            tone="success"
            href="/attendance"
            hint={dayCounts.working ? `${dayCounts.late} late · ${dayCounts.absent} absent${isToday ? ` · ${dayCounts.notIn} not in yet` : ""}` : dayCounts.label}
          />
        )}
        {showHR && <KpiCard testId="kpi-on-leave" label={isToday ? "On leave today" : "On leave"} value={dayCounts.working ? dayCounts.onLeave : "—"} icon={CalendarDays} tone="info" href="/leave" hint={dayCounts.working ? "Approved leave" : dayCounts.label} />}
        {showHR && <KpiCard testId="kpi-pending-leave" label="Pending leave requests" value={pendingLeave.length} icon={CalendarCheck} tone="warning" href="/leave/requests" hint={`${pendingCorrections.length} attendance corrections`} />}
        {showPay && latestTotals && (
          <KpiCard
            testId="kpi-monthly-payroll"
            label="Monthly payroll"
            value={formatCompactMoney(latestTotals.net)}
            icon={Wallet}
            href="/payroll"
            trend={payTrend !== null ? { value: `${Math.abs(payTrend).toFixed(1)}%`, positive: payTrend >= 0 } : null}
            hint={`Net · ${periodLabel(latest!.period)}`}
          />
        )}
        {showPay && !showHR && (
          <>
            <KpiCard testId="kpi-employees-paid" label="Employees paid" value={latestTotals?.employees ?? 0} icon={Users} tone="success" href="/payroll/payslips" hint={latest ? periodLabel(latest.period) : "—"} />
            <KpiCard testId="kpi-current-payroll" label={`${periodLabel(currentPeriod)} payroll`} value={currentRun?.status ?? "Not started"} icon={Calculator} tone="warning" href="/payroll/process" hint={`${eligibleEmployees(data.employees, currentPeriod).length} eligible employees`} />
            <KpiCard testId="kpi-warnings" label="Calculation warnings" value={currentRun ? runTotals(currentRun.items).warnings : "—"} icon={AlertTriangle} tone="danger" href="/payroll/process" hint={currentRun ? "In the current draft" : "Generate payroll to check"} />
            <KpiCard testId="kpi-employer-cost" label="Employer cost" value={latestTotals ? formatCompactMoney(latestTotals.employerCost) : "—"} icon={Receipt} tone="info" href="/payroll/history" hint="Gross + EPF 12% + ETF 3%" />
          </>
        )}
        {showHR && <KpiCard testId="kpi-new-hires" label="Recent new hires" value={newHires.length} icon={UserPlus} tone="primary" href="/employees" hint="Joined in the last 30 days" />}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {showHR && (
          <div className="lg:col-span-2">
            <AttendanceChart days={trendDays} description={`Working days ending ${formatDate(date, "d MMM yyyy")}`} />
          </div>
        )}
        {showHR && <DepartmentChart employees={active} />}
        {showPay && (
          <div className={showHR ? "lg:col-span-2" : "lg:col-span-2"}>
            <PayrollTrendChart />
          </div>
        )}
        {showHR ? (
          <LeaveSummaryChart employeeIds={new Set(active.map((e) => e.id))} />
        ) : (
          showPay && latestTotals && (
            <PayrollBreakdown totals={latestTotals} period={latest!.period} />
          )
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {showHR ? <PendingApprovalsCard items={approvals} /> : <ActivitiesCard activities={data.activities.filter((a) => a.type === "payroll")} />}
        {showHR && <ActivitiesCard activities={data.activities} />}
        <AiShortcutCard prompts={prompts} />
        <QuickActionsCard actions={quickActions} />
        {showHR && <CelebrationsCard employees={active} kind="birthdays" />}
        {showHR && <CelebrationsCard employees={active} kind="anniversaries" />}
        {!showHR && (
          <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border p-5">
            <p className="text-sm font-medium">Next pay day</p>
            <p className="text-2xl font-semibold tabular">{formatDate(`${currentPeriod}-${String(data.payrollSettings.payDay).padStart(2, "0")}`, "EEE, d MMM yyyy")}</p>
            <p className="text-sm text-muted-foreground">Generate, review and approve {periodLabel(currentPeriod)} payroll before this date.</p>
            <Button asChild className="mt-auto self-start">
              <Link href="/payroll/process">Go to payroll</Link>
            </Button>
          </div>
        )}
      </div>
    </FadeIn>
  );
}

function PayrollBreakdown({ totals, period }: { totals: ReturnType<typeof runTotals>; period: string }) {
  const rows = [
    { label: "Basic salaries", value: totals.basic },
    { label: "Allowances", value: totals.allowances },
    { label: "Overtime & bonus", value: totals.overtime + totals.bonus },
    { label: "EPF (employee 8%)", value: totals.epfEmployee },
    { label: "APIT (illustrative)", value: totals.apit },
    { label: "EPF 12% + ETF 3% (employer)", value: totals.epfEmployer + totals.etf },
  ];
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-[15px] font-semibold">Cost breakdown</h2>
      <p className="mt-1 text-[13px] text-muted-foreground">{periodLabel(period)}</p>
      <dl className="mt-4 space-y-3 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd className="font-medium tabular">{formatMoney(r.value)}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-3 border-t border-border pt-3">
          <dt className="font-medium">Net paid</dt>
          <dd className="font-semibold tabular">{formatMoney(totals.net)}</dd>
        </div>
      </dl>
    </div>
  );
}
