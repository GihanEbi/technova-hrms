"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Clock, Users, Wallet, type LucideIcon } from "lucide-react";
import { useHRStore } from "@/store/hr-store";
import { useAuth } from "@/hooks/use-hr";
import { can } from "@/lib/permissions";
import { runTotals } from "@/lib/payroll";
import { addDays, now, periodLabel, toDateKey } from "@/lib/dates";
import { formatCompactMoney } from "@/lib/utils";
import { Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { AccessDenied, FadeIn, PageHeader } from "@/components/shared/common";
import { ReportTabs } from "@/features/reports/report-kit";

interface ReportCard {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  figure: string;
  figureLabel: string;
  tone: string;
  visible: boolean;
}

export default function ReportsOverviewPage() {
  const { role } = useAuth();
  const data = useHRStore((s) => s.data);
  const hr = can(role, "reports.hr");
  const pay = can(role, "reports.payroll");

  const cards = React.useMemo<ReportCard[]>(() => {
    const active = data.employees.filter((e) => !e.archived);
    const year = String(now().getFullYear());
    const joiners = active.filter((e) => e.joinDate.startsWith(year)).length;
    const from = toDateKey(addDays(now(), -29));
    const recent = data.attendance.filter((a) => a.date >= from);
    const onLeave = recent.filter((a) => a.status === "On Leave").length;
    const attended = recent.filter((a) => a.status === "Present" || a.status === "Late" || a.status === "Half Day").length;
    const rate = recent.length - onLeave ? (attended / (recent.length - onLeave)) * 100 : 0;
    const leaveDays = data.leaveRequests.filter((l) => l.status === "Approved" && l.startDate.startsWith(year)).reduce((s, l) => s + l.days, 0);
    const pending = data.leaveRequests.filter((l) => l.status === "Pending").length;
    const processed = data.payrollRuns.filter((r) => r.status === "Processed").sort((a, b) => b.period.localeCompare(a.period));
    const ytdNet = processed.filter((r) => r.period.startsWith(year)).reduce((s, r) => s + runTotals(r.items).net, 0);
    return [
      { href: "/reports/employees", title: "Employee Report", description: `Headcount by department, type and status. ${joiners} joined in ${year}.`, icon: Users, figure: String(active.length), figureLabel: "active employees", tone: "bg-primary-soft text-primary-soft-foreground", visible: hr },
      { href: "/reports/attendance", title: "Attendance Report", description: "Attendance rate, late arrivals and absences over the last 30 days.", icon: Clock, figure: `${rate.toFixed(1)}%`, figureLabel: "attendance rate (30 days)", tone: "bg-success-soft text-success-soft-foreground", visible: hr },
      { href: "/reports/leave", title: "Leave Report", description: `Requests and days taken by type and month. ${pending} pending approval.`, icon: CalendarDays, figure: String(leaveDays), figureLabel: `approved leave days in ${year}`, tone: "bg-info-soft text-info-soft-foreground", visible: hr },
      { href: "/reports/payroll", title: "Payroll Report", description: processed[0] ? `Gross, statutory deductions and net by period. Latest: ${periodLabel(processed[0].period)}.` : "Gross, statutory deductions and net by period.", icon: Wallet, figure: formatCompactMoney(ytdNet), figureLabel: `net payroll ${year} to date`, tone: "bg-warning-soft text-warning-soft-foreground", visible: pay },
    ];
  }, [data, hr, pay]);

  if (!hr && !pay) {
    return (
      <FadeIn>
        <PageHeader title="Reports" />
        <AccessDenied />
      </FadeIn>
    );
  }

  const visible = cards.filter((c) => c.visible);
  return (
    <FadeIn>
      <PageHeader title="Reports" description="Live reports built from the current HR and payroll records. Filter, export to CSV or PDF, or print." />
      <ReportTabs />
      <div className="grid gap-4 md:grid-cols-2">
        {visible.map((c) => (
          <Card key={c.href} className="flex flex-col p-5 transition-shadow hover:shadow-md" data-testid={`report-card-${c.href.split("/").pop()}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold tracking-tight">{c.title}</h2>
                <p className="mt-1 text-[13px] text-muted-foreground">{c.description}</p>
              </div>
              <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${c.tone}`}>
                <c.icon className="size-4" />
              </span>
            </div>
            <div className="mt-5 flex items-end justify-between gap-3">
              <div>
                <p className="text-3xl font-semibold tracking-tight tabular">{c.figure}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{c.figureLabel}</p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href={c.href} aria-label={`Open report: ${c.title}`}>
                  Open report <ArrowRight />
                </Link>
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </FadeIn>
  );
}
