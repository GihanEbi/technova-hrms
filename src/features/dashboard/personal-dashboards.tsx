"use client";

import * as React from "react";
import Link from "next/link";
import { Bot, CalendarCheck, CalendarDays, CalendarPlus, ChevronRight, ClipboardCheck, PartyPopper, Receipt, Star, Target, UserCheck, Users } from "lucide-react";
import { useHRStore } from "@/store/hr-store";
import { useAuth } from "@/hooks/use-hr";
import { formatDate, formatTime, minutesToHours, now, periodLabel, todayKey, workedMinutes } from "@/lib/dates";
import { leaveBalances } from "@/lib/leave";
import { formatMoney } from "@/lib/utils";
import { Card, Progress } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { EmptyState, FadeIn, KpiCard, SectionCard, StatusBadge } from "@/components/shared/common";
import { ClockCard } from "@/features/attendance/clock-card";
import { RatingStars } from "@/features/employees/rating-stars";
import { ActivitiesCard, AiShortcutCard, AttendanceChart, CelebrationsCard, DemoDateNotice, Greeting, LeaveSummaryChart, PendingApprovalsCard, QuickActionsCard, type ApprovalItem } from "./widgets";
import { lastWorkingDays, makeAttendanceCounter } from "./stats";

function Header({ firstName, subtitle }: { firstName: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
        <Greeting firstName={firstName} />
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

// ---------------- Team lead ----------------
export function TeamDashboard() {
  const { employee: me } = useAuth();
  const data = useHRStore((s) => s.data);
  const today = todayKey();
  const team = React.useMemo(() => data.employees.filter((e) => e.managerId === me.id && !e.archived), [data.employees, me.id]);
  const teamIds = React.useMemo(() => new Set(team.map((e) => e.id)), [team]);
  const counter = React.useMemo(() => makeAttendanceCounter(data, today), [data, today]);
  const todayCounts = counter(team, today);
  const week = lastWorkingDays(data, today, 7).map((k) => counter(team, k));
  const pendingLeave = data.leaveRequests.filter((l) => l.status === "Pending" && teamIds.has(l.employeeId));
  const pendingCorr = data.corrections.filter((c) => c.status === "Pending" && teamIds.has(c.employeeId));
  const reviews = data.evaluations.filter((e) => teamIds.has(e.employeeId) && e.type === "Manager Review" && e.status === "Submitted");
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.overall, 0) / reviews.length : 0;
  const lookup = (id: string) => data.employees.find((e) => e.id === id);
  const approvals: ApprovalItem[] = [
    ...pendingLeave.map((l) => {
      const e = lookup(l.employeeId);
      return { id: l.id, kind: "Leave" as const, employee: e, title: `${e?.firstName} ${e?.lastName}`, meta: `${data.leaveTypes.find((t) => t.id === l.typeId)?.name} · ${l.days} day(s) from ${formatDate(l.startDate, "d MMM")}`, href: "/leave/requests" };
    }),
    ...pendingCorr.map((c) => {
      const e = lookup(c.employeeId);
      return { id: c.id, kind: "Correction" as const, employee: e, title: `${e?.firstName} ${e?.lastName}`, meta: `Attendance correction for ${formatDate(c.date, "d MMM")}`, href: "/attendance/corrections" };
    }),
  ];
  const outToday = data.leaveRequests.filter((l) => l.status === "Approved" && teamIds.has(l.employeeId) && l.startDate <= today && l.endDate >= today);

  return (
    <FadeIn>
      <DemoDateNotice />
      <Header firstName={me.firstName} subtitle={`You lead a team of ${team.length}. Here's how they're doing today.`} />
      <section aria-label="Team metrics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard testId="kpi-team-size" label="Team members" value={team.length} icon={Users} href="/employees" hint="Direct reports" />
        <KpiCard testId="kpi-present" label="Present today" value={todayCounts.working ? todayCounts.present + todayCounts.late : "—"} icon={UserCheck} tone="success" href="/attendance" hint={todayCounts.working ? `${todayCounts.late} late · ${todayCounts.notIn} not in yet` : todayCounts.label} />
        <KpiCard testId="kpi-on-leave" label="On leave today" value={outToday.length} icon={CalendarDays} tone="info" href="/leave/calendar" hint={outToday.map((l) => lookup(l.employeeId)?.firstName).join(", ") || "Everyone's in"} />
        <KpiCard testId="kpi-pending-approvals" label="Pending approvals" value={approvals.length} icon={ClipboardCheck} tone="warning" href="/leave/requests" hint={`${pendingLeave.length} leave · ${pendingCorr.length} corrections`} />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AttendanceChart days={week} title="Team attendance" description="Last 7 working days" />
        </div>
        <PendingApprovalsCard items={approvals} />
        <ClockCard employeeId={me.id} />
        <SectionCard title="Team performance" description={`Average of ${reviews.length} submitted reviews`} action={<Button asChild variant="ghost" size="sm"><Link href="/performance">Reviews <ChevronRight /></Link></Button>}>
          <div className="flex items-end gap-3">
            <p className="text-3xl font-semibold tabular">{avg ? avg.toFixed(2) : "—"}</p>
            {avg > 0 && <RatingStars value={avg} showValue={false} className="mb-1.5" />}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{data.evaluations.filter((e) => e.reviewerId === me.id && e.status === "Draft").length} draft review(s) waiting to be completed.</p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/performance/new">
              <Star /> New evaluation
            </Link>
          </Button>
        </SectionCard>
        <LeaveSummaryChart employeeIds={teamIds} />
        <ActivitiesCard activities={data.activities.filter((a) => teamIds.has(a.actorId) || a.actorId === me.id)} limit={5} />
        <CelebrationsCard employees={team} kind="birthdays" />
        <AiShortcutCard prompts={["Show pending leave requests.", "Summarize employee attendance.", "How many leave days do I have?"]} />
      </div>
    </FadeIn>
  );
}

// ---------------- Employee self-service ----------------
export function EmployeeDashboard() {
  const { employee: me } = useAuth();
  const data = useHRStore((s) => s.data);
  const today = todayKey();
  const year = now().getFullYear();
  const balances = leaveBalances(me.id, data.leaveTypes, data.leaveRequests, year).filter((b) => b.type.id !== "unpaid");
  const latestRun = data.payrollRuns.filter((r) => r.status === "Processed" && r.items.some((i) => i.employeeId === me.id)).sort((a, b) => b.period.localeCompare(a.period))[0];
  const latestItem = latestRun?.items.find((i) => i.employeeId === me.id);
  const recent = data.attendance.filter((a) => a.employeeId === me.id && a.date < today).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const holidays = data.holidays.filter((h) => h.date >= today).slice(0, 4);
  const myPendingLeave = data.leaveRequests.filter((l) => l.employeeId === me.id && l.status === "Pending");
  const myPendingCorr = data.corrections.filter((c) => c.employeeId === me.id && c.status === "Pending");
  const goals = data.goals.filter((g) => g.employeeId === me.id);

  return (
    <FadeIn>
      <DemoDateNotice />
      <Header firstName={me.firstName} subtitle={`${formatDate(today, "EEEE, d MMMM yyyy")} · Everything you need for your day at ${data.company.name}.`} />
      <div className="grid gap-6 lg:grid-cols-3">
        <ClockCard employeeId={me.id} className="lg:col-span-1" />

        <SectionCard title="Leave balance" description={`${year} entitlement`} className="lg:col-span-2" action={<Button asChild size="sm"><Link href="/leave/apply"><CalendarPlus /> Apply leave</Link></Button>}>
          <div className="grid gap-4 sm:grid-cols-3" data-testid="leave-balance">
            {balances.map((b) => (
              <div key={b.type.id} className="rounded-lg border border-border p-4">
                <p className="text-xs text-muted-foreground">{b.type.name}</p>
                <p className="mt-1 text-2xl font-semibold tabular">
                  {b.available}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">/ {b.allocation} days</span>
                </p>
                <Progress value={((b.used + b.pending) / Math.max(1, b.allocation)) * 100} className="mt-3" />
                <p className="mt-2 text-xs text-muted-foreground tabular">
                  {b.used} used · {b.pending} pending
                </p>
              </div>
            ))}
          </div>
        </SectionCard>

        <Card className="flex flex-col p-5" data-testid="latest-payslip-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[15px] font-semibold">Latest payslip</p>
              <p className="mt-1 text-[13px] text-muted-foreground">{latestRun ? periodLabel(latestRun.period) : "No payslips yet"}</p>
            </div>
            <span className="flex size-8 items-center justify-center rounded-lg bg-success-soft text-success-soft-foreground">
              <Receipt className="size-4" />
            </span>
          </div>
          {latestItem && latestRun ? (
            <>
              <p className="mt-4 text-xs text-muted-foreground">Net pay</p>
              <p className="text-2xl font-semibold tabular">{formatMoney(latestItem.net)}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md bg-subtle px-2.5 py-2">
                  <p className="text-muted-foreground">Gross</p>
                  <p className="font-medium tabular">{formatMoney(latestItem.gross)}</p>
                </div>
                <div className="rounded-md bg-subtle px-2.5 py-2">
                  <p className="text-muted-foreground">Deductions</p>
                  <p className="font-medium tabular">{formatMoney(latestItem.totalDeductions)}</p>
                </div>
              </div>
              <Button asChild variant="outline" className="mt-auto w-full pt-0">
                <Link href={`/payroll/payslips/PS-${latestRun.period}-${me.id}`} className="mt-4">
                  View payslip
                </Link>
              </Button>
            </>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">Your first payslip will appear after payroll is processed.</p>
          )}
        </Card>

        <SectionCard title="Recent attendance" action={<Button asChild variant="ghost" size="sm"><Link href="/attendance/my">History <ChevronRight /></Link></Button>} bodyClassName="px-0 pb-2">
          {recent.length ? (
            <ul data-testid="recent-attendance">
              {recent.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-5 py-2.5">
                  <span className="w-20 shrink-0 text-sm tabular">{formatDate(r.date, "EEE d MMM")}</span>
                  <span className="flex-1 truncate text-xs text-muted-foreground tabular">
                    {r.clockIn ? `${formatTime(r.clockIn)} – ${formatTime(r.clockOut)} · ${minutesToHours(workedMinutes(r.clockIn, r.clockOut))}` : "—"}
                  </span>
                  <StatusBadge status={r.status} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No attendance yet" className="py-8" />
          )}
        </SectionCard>

        <SectionCard title="Pending requests" description="Waiting for approval" bodyClassName="px-0 pb-2">
          {myPendingLeave.length + myPendingCorr.length === 0 ? (
            <EmptyState icon={CalendarCheck} title="No pending requests" description="Leave and correction requests you submit appear here." className="py-8" />
          ) : (
            <ul data-testid="my-pending-requests">
              {myPendingLeave.map((l) => (
                <li key={l.id}>
                  <Link href="/leave/my" className="flex items-center gap-3 px-5 py-2.5 hover:bg-subtle">
                    <CalendarDays className="size-4 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{data.leaveTypes.find((t) => t.id === l.typeId)?.name}</span>
                      <span className="block text-xs text-muted-foreground tabular">
                        {l.id} · {formatDate(l.startDate, "d MMM")}{l.endDate !== l.startDate ? ` – ${formatDate(l.endDate, "d MMM")}` : ""} · {l.days} day(s)
                      </span>
                    </span>
                    <StatusBadge status={l.status} />
                  </Link>
                </li>
              ))}
              {myPendingCorr.map((c) => (
                <li key={c.id}>
                  <Link href="/attendance/my" className="flex items-center gap-3 px-5 py-2.5 hover:bg-subtle">
                    <ClipboardCheck className="size-4 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">Attendance correction</span>
                      <span className="block text-xs text-muted-foreground tabular">{c.id} · {formatDate(c.date, "d MMM")}</span>
                    </span>
                    <StatusBadge status={c.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Upcoming holidays" description="Illustrative public holiday calendar" action={<PartyPopper className="size-4 text-muted-foreground" />}>
          <ul className="space-y-3" data-testid="upcoming-holidays">
            {holidays.map((h) => (
              <li key={h.date} className="flex items-center gap-3">
                <span className="flex w-11 shrink-0 flex-col items-center rounded-md border border-border py-1 leading-none">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase">{formatDate(h.date, "MMM")}</span>
                  <span className="mt-0.5 text-base font-semibold tabular">{formatDate(h.date, "d")}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{h.name}</span>
                  <span className="block text-xs text-muted-foreground">{formatDate(h.date, "EEEE")}</span>
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <QuickActionsCard
          actions={[
            { label: "Apply leave", description: "Request time off", href: "/leave/apply", icon: CalendarPlus },
            { label: "View payslip", description: latestRun ? periodLabel(latestRun.period) : "Payslip history", href: latestRun ? `/payroll/payslips/PS-${latestRun.period}-${me.id}` : "/payroll/payslips", icon: Receipt },
            { label: "My performance", description: "Reviews and goals", href: "/performance/my", icon: Target },
            { label: "Ask AI assistant", description: "Leave, pay & policies", href: "/ai-assistant", icon: Bot },
          ]}
        />
        <SectionCard title="My goals" action={<Button asChild variant="ghost" size="sm"><Link href="/performance/my">All goals <ChevronRight /></Link></Button>}>
          {goals.length ? (
            <ul className="space-y-4">
              {goals.slice(0, 3).map((g) => (
                <li key={g.id}>
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="font-medium">{g.title}</span>
                    <span className="text-muted-foreground tabular">{g.progress}%</span>
                  </div>
                  <Progress value={g.progress} className="mt-2" />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No goals yet.</p>
          )}
        </SectionCard>
        <AiShortcutCard prompts={["How many leave days do I have?", "Show my attendance this month.", "What is my latest salary?"]} />
      </div>
    </FadeIn>
  );
}
