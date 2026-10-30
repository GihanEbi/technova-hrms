"use client";

import * as React from "react";
import Link from "next/link";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowRight, Award, Bot, Cake, CalendarClock, ChevronRight, Clock, Info, Sparkles, type LucideIcon } from "lucide-react";
import { useHRStore } from "@/store/hr-store";
import { useLookups } from "@/hooks/use-hr";
import { formatDate, now, relativeTime, shortPeriodLabel, toDateKey } from "@/lib/dates";
import { cn, formatCompactMoney, formatMoney } from "@/lib/utils";
import type { Activity, Employee } from "@/types";
import { Alert, Avatar, Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { EmptyState, SectionCard } from "@/components/shared/common";
import { axisProps, ChartLegend, chartColors, ChartTooltip, gridProps, tooltipCursor, chartAnimation } from "@/components/charts/chart-kit";
import { notificationIcons, notificationTones } from "@/components/layout/app-header";
import { runTotals } from "@/lib/payroll";
import type { DayCounts } from "./stats";
import { daysUntilAnniversary } from "./stats";

// ---------------- Demo date notice ----------------
export function DemoDateNotice() {
  const seededAt = useHRStore((s) => s.data.seededAt);
  if (toDateKey(new Date(seededAt)) === toDateKey(now())) return null;
  return (
    <Alert variant="info" className="mb-6">
      <Info />
      <div>
        <p className="font-medium">Demo data was generated on {formatDate(seededAt)}</p>
        <p className="mt-0.5 text-[13px] opacity-90">
          Attendance and leave are dated relative to that day. <Link href="/settings?tab=demo" className="font-medium underline underline-offset-2">Reset demo data</Link> to refresh everything for today.
        </p>
      </div>
    </Alert>
  );
}

// ---------------- Attendance overview ----------------
export function AttendanceChart({ days, title = "Attendance overview", description }: { days: DayCounts[]; title?: string; description?: string }) {
  const rows = days.map((d) => ({ label: formatDate(d.key, days.length > 10 ? "d MMM" : "EEE d"), Present: d.present, Late: d.late, "On leave": d.onLeave, Absent: d.absent }));
  return (
    <SectionCard title={title} description={description}>
      <ChartLegend
        className="mb-3"
        items={[
          { label: "Present", color: chartColors[1] },
          { label: "Late", color: chartColors[2] },
          { label: "On leave", color: chartColors[4] },
          { label: "Absent", color: chartColors[3] },
        ]}
      />
      <div className="h-64" data-testid="chart-attendance">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ left: -20, right: 4, top: 4 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={8} />
            <YAxis {...axisProps} allowDecimals={false} />
            <Tooltip content={<ChartTooltip />} cursor={tooltipCursor} />
            <Bar isAnimationActive={chartAnimation} dataKey="Present" stackId="a" fill={chartColors[1]} />
            <Bar isAnimationActive={chartAnimation} dataKey="Late" stackId="a" fill={chartColors[2]} />
            <Bar isAnimationActive={chartAnimation} dataKey="On leave" stackId="a" fill={chartColors[4]} />
            <Bar isAnimationActive={chartAnimation} dataKey="Absent" stackId="a" fill={chartColors[3]} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}

// ---------------- Department distribution ----------------
export function DepartmentChart({ employees }: { employees: Employee[] }) {
  const departments = useHRStore((s) => s.data.departments);
  const rows = departments
    .filter((d) => !d.archived)
    .map((d) => ({ name: d.name, value: employees.filter((e) => e.departmentId === d.id).length, color: `var(--${d.color})` }))
    .filter((r) => r.value > 0);
  const total = rows.reduce((s, r) => s + r.value, 0);
  return (
    <SectionCard title="Employees by department" description={`${total} active employees`}>
      <div className="flex flex-col items-center gap-5 sm:flex-row lg:flex-col">
        <div className="relative h-48 w-48 shrink-0" data-testid="chart-departments">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie isAnimationActive={chartAnimation} data={rows} dataKey="value" nameKey="name" innerRadius={58} outerRadius={86} paddingAngle={2} stroke="var(--surface)" strokeWidth={2}>
                {rows.map((r) => (
                  <Cell key={r.name} fill={r.color} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip formatter={(v) => `${v} people`} />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-semibold tabular">{total}</span>
            <span className="text-xs text-muted-foreground">people</span>
          </div>
        </div>
        <ul className="w-full space-y-2 text-sm">
          {rows.map((r) => (
            <li key={r.name} className="flex items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ background: r.color }} />
              <span className="flex-1 truncate text-muted-foreground">{r.name}</span>
              <span className="font-medium tabular">{r.value}</span>
              <span className="w-10 text-right text-xs text-muted-foreground tabular">{Math.round((r.value / Math.max(1, total)) * 100)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </SectionCard>
  );
}

// ---------------- Payroll trend ----------------
export function PayrollTrendChart() {
  const runs = useHRStore((s) => s.data.payrollRuns);
  const rows = runs
    .filter((r) => r.status === "Processed")
    .sort((a, b) => a.period.localeCompare(b.period))
    .map((r) => {
      const t = runTotals(r.items);
      return { label: shortPeriodLabel(r.period), Gross: t.gross, Net: t.net };
    });
  const last = rows[rows.length - 1];
  return (
    <SectionCard title="Monthly payroll trend" description={last ? `Latest net payroll ${formatMoney(last.Net)}` : "No processed payroll yet"} action={<Button asChild variant="ghost" size="sm"><Link href="/payroll">Payroll <ChevronRight /></Link></Button>}>
      <ChartLegend className="mb-3" items={[{ label: "Gross", color: chartColors[0] }, { label: "Net", color: chartColors[1] }]} />
      <div className="h-64" data-testid="chart-payroll">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ left: 4, right: 4, top: 4 }}>
            <defs>
              <linearGradient id="grossFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.25} />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis {...axisProps} width={64} tickFormatter={(v) => formatCompactMoney(v, "")} />
            <Tooltip content={<ChartTooltip formatter={(v) => formatMoney(v)} />} />
            <Area isAnimationActive={chartAnimation} type="monotone" dataKey="Gross" stroke={chartColors[0]} strokeWidth={2} fill="url(#grossFill)" />
            <Area isAnimationActive={chartAnimation} type="monotone" dataKey="Net" stroke={chartColors[1]} strokeWidth={2} fill="transparent" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}

// ---------------- Leave summary ----------------
export function LeaveSummaryChart({ employeeIds }: { employeeIds: Set<string> }) {
  const types = useHRStore((s) => s.data.leaveTypes);
  const requests = useHRStore((s) => s.data.leaveRequests);
  const year = String(now().getFullYear());
  const rows = types
    .filter((t) => t.active)
    .map((t) => {
      const mine = requests.filter((r) => r.typeId === t.id && employeeIds.has(r.employeeId) && r.startDate.startsWith(year));
      return {
        name: t.name.replace(" Leave", ""),
        Approved: mine.filter((r) => r.status === "Approved").reduce((s, r) => s + r.days, 0),
        Pending: mine.filter((r) => r.status === "Pending").reduce((s, r) => s + r.days, 0),
      };
    });
  return (
    <SectionCard title="Leave summary" description={`Days taken and requested in ${year}`} action={<Button asChild variant="ghost" size="sm"><Link href="/leave">Leave <ChevronRight /></Link></Button>}>
      <ChartLegend className="mb-3" items={[{ label: "Approved", color: chartColors[0] }, { label: "Pending", color: chartColors[2] }]} />
      <div className="h-64" data-testid="chart-leave">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ left: -20, right: 4, top: 4 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis {...axisProps} allowDecimals={false} />
            <Tooltip content={<ChartTooltip formatter={(v) => `${v} days`} />} cursor={tooltipCursor} />
            <Bar isAnimationActive={chartAnimation} dataKey="Approved" fill={chartColors[0]} radius={[4, 4, 0, 0]} maxBarSize={36} />
            <Bar isAnimationActive={chartAnimation} dataKey="Pending" fill={chartColors[2]} radius={[4, 4, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}

// ---------------- Activities ----------------
export function ActivitiesCard({ activities, limit = 6 }: { activities: Activity[]; limit?: number }) {
  const lookups = useLookups();
  const list = [...activities].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  return (
    <SectionCard title="Recent HR activity" description="Latest changes across the workspace" bodyClassName="px-0 pb-2">
      {list.length === 0 ? (
        <EmptyState title="No activity yet" />
      ) : (
        <ul data-testid="recent-activity">
          {list.map((a) => {
            const Icon = notificationIcons[a.type];
            const actor = lookups.employee(a.actorId);
            return (
              <li key={a.id}>
                <Link href={a.link} className="flex items-start gap-3 px-5 py-2.5 hover:bg-subtle">
                  <span className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full", notificationTones[a.type])}>
                    <Icon className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 text-sm leading-snug">
                    <span className="font-medium">{actor ? `${actor.firstName} ${actor.lastName}` : "System"}</span> <span className="text-muted-foreground">{a.text}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground/80">{relativeTime(a.createdAt)}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}

// ---------------- Pending approvals ----------------
export interface ApprovalItem {
  id: string;
  title: string;
  meta: string;
  href: string;
  employee?: Employee;
  kind: "Leave" | "Correction" | "Payroll";
}
export function PendingApprovalsCard({ items, viewAllHref = "/leave/requests" }: { items: ApprovalItem[]; viewAllHref?: string }) {
  return (
    <SectionCard
      title="Pending approvals"
      description={items.length ? `${items.length} item${items.length === 1 ? "" : "s"} waiting for a decision` : "Nothing waiting for you"}
      action={<Button asChild variant="ghost" size="sm"><Link href={viewAllHref}>View all <ChevronRight /></Link></Button>}
      bodyClassName="px-0 pb-2"
    >
      {items.length === 0 ? (
        <EmptyState icon={Clock} title="All caught up" description="New leave and correction requests will show up here." className="py-8" />
      ) : (
        <ul data-testid="pending-approvals">
          {items.slice(0, 6).map((it) => (
            <li key={it.id}>
              <Link href={it.href} className="flex items-center gap-3 px-5 py-2.5 hover:bg-subtle">
                {it.employee ? (
                  <Avatar name={`${it.employee.firstName} ${it.employee.lastName}`} src={it.employee.avatar} seed={it.employee.id} className="size-8 text-xs" />
                ) : (
                  <span className="flex size-8 items-center justify-center rounded-full bg-success-soft text-success-soft-foreground">
                    <CalendarClock className="size-4" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{it.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{it.meta}</span>
                </span>
                <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning-soft-foreground">{it.kind}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

// ---------------- Celebrations ----------------
export function CelebrationsCard({ employees, kind }: { employees: Employee[]; kind: "birthdays" | "anniversaries" }) {
  const lookups = useLookups();
  const today = now();
  const list = employees
    .map((e) => {
      const ref = kind === "birthdays" ? e.dateOfBirth : e.joinDate;
      const { days, date } = daysUntilAnniversary(ref, today);
      const years = date.getFullYear() - Number(ref.slice(0, 4));
      return { e, days, date, years };
    })
    .filter((x) => x.days <= 30 && (kind === "birthdays" || x.years >= 1))
    .sort((a, b) => a.days - b.days)
    .slice(0, 5);
  const Icon = kind === "birthdays" ? Cake : Award;
  return (
    <SectionCard title={kind === "birthdays" ? "Upcoming birthdays" : "Work anniversaries"} description="Next 30 days" action={<Icon className="size-4 text-muted-foreground" />}>
      {list.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">Nothing in the next 30 days.</p>
      ) : (
        <ul className="space-y-3" data-testid={kind === "birthdays" ? "upcoming-birthdays" : "work-anniversaries"}>
          {list.map(({ e, days, date, years }) => (
            <li key={e.id} className="flex items-center gap-3">
              <Avatar name={`${e.firstName} ${e.lastName}`} src={e.avatar} seed={e.id} className="size-8 text-xs" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {e.firstName} {e.lastName}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {kind === "birthdays" ? lookups.desName(e.designationId) : `${years} year${years === 1 ? "" : "s"} at TechNova`}
                </p>
              </div>
              <span className={cn("shrink-0 rounded-md px-2 py-1 text-xs font-medium tabular", days === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                {days === 0 ? "Today" : days === 1 ? "Tomorrow" : formatDate(date, "d MMM")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

// ---------------- Quick actions ----------------
export function QuickActionsCard({ actions }: { actions: { label: string; description: string; href: string; icon: LucideIcon }[] }) {
  return (
    <SectionCard title="Quick actions">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1" data-testid="quick-actions">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <Link key={a.label} href={a.href} className="group flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:border-primary/40 hover:bg-subtle">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{a.label}</span>
                <span className="block truncate text-xs text-muted-foreground">{a.description}</span>
              </span>
              <ArrowRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
          );
        })}
      </div>
    </SectionCard>
  );
}

// ---------------- AI shortcut ----------------
export function AiShortcutCard({ prompts }: { prompts: string[] }) {
  return (
    <Card className="relative overflow-hidden p-5" data-testid="ai-shortcut">
      <div className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-primary/10 blur-2xl" aria-hidden />
      <div className="relative">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Bot className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">AI HR Assistant</p>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Sparkles className="size-3" /> Demo simulation · answers from your HR data
            </p>
          </div>
        </div>
        <ul className="mt-4 space-y-1.5">
          {prompts.map((p) => (
            <li key={p}>
              <Link href={`/ai-assistant?q=${encodeURIComponent(p)}`} className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm transition-colors hover:border-primary/40 hover:bg-subtle dark:bg-subtle">
                <span className="flex-1 truncate">{p}</span>
                <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
        <Button asChild className="mt-4 w-full" variant="outline">
          <Link href="/ai-assistant">Open AI assistant</Link>
        </Button>
      </div>
    </Card>
  );
}

export function Greeting({ firstName }: { firstName: string }) {
  const h = now().getHours();
  const part = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  return (
    <>
      {part}, {firstName}
    </>
  );
}
