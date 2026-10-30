"use client";

import * as React from "react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowRight, CalendarClock, CalendarPlus, CalendarRange, Hourglass, Palmtree, PartyPopper } from "lucide-react";
import { endOfMonth, endOfWeek, startOfMonth, startOfWeek } from "date-fns";
import { useHRStore } from "@/store/hr-store";
import { useAuth, useLookups } from "@/hooks/use-hr";
import { addDays, format, now, relativeTime, toDateKey } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/overlays";
import { axisProps, ChartTooltip, gridProps, tooltipCursor, chartAnimation } from "@/components/charts/chart-kit";
import { AccessDenied, EmptyState, FadeIn, KpiCard, ModuleTabs, PageHeader, PersonCell, SectionCard, StatusBadge } from "@/components/shared/common";
import { LeaveTypeLabel } from "@/features/leave/components";
import { coversDay, daysWithin, formatDays, formatRange, isLeaveManager, leaveApprovalScope, leaveColor, leaveTabs } from "@/features/leave/lib";
import type { LeaveRequest } from "@/types";

export default function LeaveOverviewPage() {
  const { role, employee: me } = useAuth();
  const employees = useHRStore((s) => s.data.employees);
  const leaveRequests = useHRStore((s) => s.data.leaveRequests);
  const leaveTypes = useHRStore((s) => s.data.leaveTypes);
  const settings = useHRStore((s) => s.data.leaveSettings);
  const holidays = useHRStore((s) => s.data.holidays);
  const lookups = useLookups();

  const current = now();
  const today = toDateKey(current);
  const year = current.getFullYear();
  const monthStart = toDateKey(startOfMonth(current));
  const monthEnd = toDateKey(endOfMonth(current));
  const weekStart = toDateKey(startOfWeek(current, { weekStartsOn: 1 }));
  const weekEnd = toDateKey(endOfWeek(current, { weekStartsOn: 1 }));
  const in14 = toDateKey(addDays(current, 14));

  const scopeIds = React.useMemo(() => new Set(leaveApprovalScope(role, me, employees).map((e) => e.id)), [role, me, employees]);
  const scoped = React.useMemo(() => leaveRequests.filter((r) => scopeIds.has(r.employeeId)), [leaveRequests, scopeIds]);
  const approved = scoped.filter((r) => r.status === "Approved");
  const pending = scoped.filter((r) => r.status === "Pending").sort((a, b) => a.startDate.localeCompare(b.startDate));

  const outToday = approved.filter((r) => coversDay(r, today));
  const outWeek = approved.filter((r) => r.startDate <= weekEnd && r.endDate >= weekStart).sort((a, b) => a.startDate.localeCompare(b.startDate));
  const approvedMonthDays = approved.reduce((s, r) => s + daysWithin(r, monthStart, monthEnd, settings, holidays), 0);
  const upcoming = scoped.filter((r) => (r.status === "Approved" || r.status === "Pending") && r.startDate > today && r.startDate <= in14);

  const chartData = leaveTypes
    .filter((t) => t.active)
    .map((t) => ({
      name: t.name.replace(" Leave", ""),
      fullName: t.name,
      days: approved.filter((r) => r.typeId === t.id).reduce((s, r) => s + daysWithin(r, `${year}-01-01`, `${year}-12-31`, settings, holidays), 0),
      color: leaveColor(t),
    }));
  const totalYear = chartData.reduce((s, d) => s + d.days, 0);

  if (!isLeaveManager(role)) return <AccessDenied />;

  const typeOf = (id: string) => leaveTypes.find((t) => t.id === id);
  const personRow = (r: LeaveRequest, right: React.ReactNode) => {
    const e = lookups.employee(r.employeeId);
    return (
      <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
        <PersonCell size="sm" name={lookups.name(r.employeeId)} sub={`${typeOf(r.typeId)?.name ?? "Leave"} · ${formatRange(r.startDate, r.endDate)}`} src={e?.avatar} seed={r.employeeId} />
        <div className="shrink-0">{right}</div>
      </li>
    );
  };

  return (
    <FadeIn>
      <PageHeader
        title="Leave management"
        description={role === "team_lead" ? `Leave overview for the ${scopeIds.size} people who report to you.` : `Company-wide leave overview for ${scopeIds.size} active employees.`}
        actions={
          <Button asChild>
            <Link href="/leave/apply">
              <CalendarPlus /> Apply leave
            </Link>
          </Button>
        }
      />
      <ModuleTabs tabs={leaveTabs(role)} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Pending requests" value={pending.length} icon={Hourglass} tone="warning" hint="Awaiting a decision" href="/leave/requests" testId="kpi-pending" />
        <KpiCard label="On leave today" value={new Set(outToday.map((r) => r.employeeId)).size} icon={Palmtree} tone="info" hint={format(current, "EEE, d MMM")} testId="kpi-on-leave" />
        <KpiCard label="Approved this month" value={formatDays(approvedMonthDays)} icon={CalendarRange} tone="success" hint={format(current, "MMMM yyyy")} testId="kpi-approved-month" />
        <KpiCard
          label="Upcoming leave"
          value={upcoming.length}
          icon={CalendarClock}
          tone="primary"
          hint={`Next 14 days · ${upcoming.filter((r) => r.status === "Pending").length} pending`}
          testId="kpi-upcoming"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SectionCard title="Leave by type" description={`Approved working days in ${year} · ${formatDays(totalYear)} total`} className="lg:col-span-2">
          {totalYear === 0 ? (
            <EmptyState icon={CalendarRange} title="No approved leave yet" description={`Approved leave taken in ${year} will appear here.`} />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barCategoryGap="32%">
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="name" {...axisProps} />
                <YAxis allowDecimals={false} {...axisProps} />
                <Tooltip
                  cursor={tooltipCursor}
                  content={<ChartTooltip formatter={(v) => formatDays(v)} labelFormatter={(l) => chartData.find((d) => d.name === l)?.fullName ?? l} />}
                />
                <Bar isAnimationActive={chartAnimation} dataKey="days" name="Approved days" radius={[6, 6, 0, 0]} maxBarSize={64}>
                  {chartData.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        <SectionCard title="Who's out" description="Approved leave">
          <Tabs defaultValue="today">
            <TabsList aria-label="Who's out period">
              <TabsTrigger value="today">Today · {outToday.length}</TabsTrigger>
              <TabsTrigger value="week">This week · {outWeek.length}</TabsTrigger>
            </TabsList>
            <TabsContent value="today">
              {outToday.length === 0 ? (
                <EmptyState icon={PartyPopper} title="Everyone's in today" description="No approved leave for today." className="py-8" />
              ) : (
                <ul className="divide-y divide-border">{outToday.map((r) => personRow(r, <span className="text-xs text-muted-foreground">{r.endDate === today ? "Last day today" : `Until ${format(new Date(`${r.endDate}T00:00:00`), "d MMM")}`}</span>))}</ul>
              )}
            </TabsContent>
            <TabsContent value="week">
              {outWeek.length === 0 ? (
                <EmptyState icon={PartyPopper} title="No leave this week" description="Nobody has approved leave this week." className="py-8" />
              ) : (
                <ul className="divide-y divide-border">{outWeek.map((r) => personRow(r, <span className="text-xs text-muted-foreground tabular">{formatDays(r.days)}</span>))}</ul>
              )}
            </TabsContent>
          </Tabs>
        </SectionCard>
      </div>

      <SectionCard
        className="mt-6"
        title="Pending approvals"
        description={pending.length ? `${pending.length} request${pending.length === 1 ? "" : "s"} waiting for a decision` : "Nothing waiting for you"}
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/leave/requests">
              Review requests <ArrowRight />
            </Link>
          </Button>
        }
      >
        {pending.length === 0 ? (
          <EmptyState icon={Hourglass} title="You're all caught up" description="New leave requests from your team will appear here." className="py-8" />
        ) : (
          <ul className="divide-y divide-border">
            {pending.slice(0, 5).map((r) => {
              const e = lookups.employee(r.employeeId);
              return (
                <li key={r.id}>
                  <Link href="/leave/requests" className="-mx-2 flex flex-col gap-2 rounded-md px-2 py-3 hover:bg-subtle sm:flex-row sm:items-center sm:justify-between">
                    <PersonCell name={lookups.name(r.employeeId)} sub={`${r.id} · submitted ${relativeTime(r.createdAt)}`} src={e?.avatar} seed={r.employeeId} />
                    <div className="flex flex-wrap items-center gap-3 text-sm sm:justify-end">
                      <LeaveTypeLabel type={typeOf(r.typeId)} />
                      <span className="text-muted-foreground tabular">{formatRange(r.startDate, r.endDate)}</span>
                      <span className="font-medium tabular">{formatDays(r.days)}</span>
                      <StatusBadge status={r.status} />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </FadeIn>
  );
}
