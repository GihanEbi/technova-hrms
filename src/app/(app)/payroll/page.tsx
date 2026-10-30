"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowRight, Banknote, CalendarClock, CheckCircle2, CircleDollarSign, Download, Gift, Landmark, MinusCircle, Users, Wallet } from "lucide-react";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useHRStore } from "@/store/hr-store";
import { eligibleEmployees, runTotals } from "@/lib/payroll";
import { formatDate, formatDateTime, now, periodLabel, shortPeriodLabel, todayKey } from "@/lib/dates";
import { cn, downloadBlob, formatCompactMoney, formatMoney, pluralize, toCsv } from "@/lib/utils";
import { Card, Progress } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { EmptyState, KpiCard, SectionCard, StatusBadge } from "@/components/shared/common";
import { axisProps, ChartLegend, ChartTooltip, chartColors, gridProps, tooltipCursor, chartAnimation } from "@/components/charts/chart-kit";
import { PayrollPageFrame } from "@/features/payroll/payroll-shell";
import { currentPeriod, pctChange, processedRuns, sortRunsDesc } from "@/features/payroll/payroll-utils";
import { PayrollStepper } from "@/features/payroll/payroll-stepper";

const axisMoney = (v: number) => (Math.abs(v) >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : `${Math.round(v / 1000)}K`);

export default function PayrollDashboardPage() {
  const runs = useHRStore((s) => s.data.payrollRuns);
  const employees = useHRStore((s) => s.data.employees);
  const settings = useHRStore((s) => s.data.payrollSettings);

  const period = currentPeriod();
  const processed = React.useMemo(() => processedRuns(runs), [runs]);
  const latest = processed[0];
  const previous = processed[1];
  const latestTotals = React.useMemo(() => (latest ? runTotals(latest.items) : null), [latest]);
  const prevTotals = React.useMemo(() => (previous ? runTotals(previous.items) : null), [previous]);
  const currentRun = runs.find((r) => r.period === period);
  const currentStatus = currentRun?.status ?? "Not started";
  const year = String(now().getFullYear());
  const completedThisYear = processed.filter((r) => r.period.startsWith(year)).length;
  const eligible = eligibleEmployees(employees, period).length;

  const netChange = latestTotals && prevTotals ? pctChange(latestTotals.net, prevTotals.net) : null;

  const chartData = React.useMemo(
    () =>
      sortRunsDesc(runs)
        .reverse()
        .map((r) => {
          const t = runTotals(r.items);
          return { label: shortPeriodLabel(r.period), period: r.period, gross: t.gross, net: t.net, employerCost: t.employerCost, status: r.status };
        }),
    [runs],
  );

  const payDate = `${period}-${String(settings.payDay).padStart(2, "0")}`;
  const ctaLabel = !currentRun ? "Start payroll" : currentRun.status === "Processed" ? "View payslips" : "Continue payroll";
  const ctaHref = currentRun?.status === "Processed" ? `/payroll/payslips?period=${period}` : "/payroll/process";

  const earnings = latestTotals
    ? [
        { label: "Basic salary", value: latestTotals.basic, color: chartColors[0] },
        { label: "Allowances", value: latestTotals.allowances, color: chartColors[1] },
        { label: "Overtime", value: latestTotals.overtime, color: chartColors[2] },
        { label: "Bonus", value: latestTotals.bonus, color: chartColors[5] },
      ]
    : [];
  const statutory = latestTotals
    ? [
        { label: `EPF employee (${settings.epfEmployeeRate}%)`, value: latestTotals.epfEmployee, note: "Deducted" },
        { label: "APIT (PAYE)", value: latestTotals.apit, note: "Deducted" },
        { label: `EPF employer (${settings.epfEmployerRate}%)`, value: latestTotals.epfEmployer, note: "Employer" },
        { label: `ETF (${settings.etfRate}%)`, value: latestTotals.etf, note: "Employer" },
      ]
    : [];
  const statMax = Math.max(1, ...statutory.map((s) => s.value));

  const exportSummary = () => {
    const rows = sortRunsDesc(runs).map((r) => {
      const t = runTotals(r.items);
      return [r.period, r.status, t.employees, t.gross, t.allowances, t.overtime, t.bonus, t.epfEmployee, t.apit, t.deductions, t.net, t.epfEmployer, t.etf, t.employerCost, r.payDate];
    });
    downloadBlob(
      toCsv(["Period", "Status", "Employees", "Gross", "Allowances", "Overtime", "Bonus", "EPF employee", "APIT", "Total deductions", "Net", "EPF employer", "ETF", "Employer cost", "Pay date"], rows),
      `payroll-runs-${todayKey()}.csv`,
      "text/csv",
    );
    toast.success("Export ready", { description: `${rows.length} payroll runs exported to CSV.` });
  };

  return (
    <PayrollPageFrame
      title="Payroll"
      description={latest ? `Last processed: ${periodLabel(latest.period)} · ${pluralize(latestTotals?.employees ?? 0, "employee")} paid on ${formatDate(latest.payDate)}.` : "Run monthly payroll, manage salary structures and publish payslips."}
      actions={
        <Button variant="outline" onClick={exportSummary} disabled={!runs.length}>
          <Download /> Export runs CSV
        </Button>
      }
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard
            label="Total monthly payroll"
            icon={Wallet}
            value={latestTotals ? formatCompactMoney(latestTotals.net) : "—"}
            trend={netChange === null ? null : { value: `${netChange >= 0 ? "+" : ""}${netChange.toFixed(1)}%`, positive: netChange >= 0 }}
            hint={previous ? `net vs ${shortPeriodLabel(previous.period)}` : latest ? `net · ${periodLabel(latest.period)}` : "No processed runs yet"}
            testId="kpi-total-payroll"
          />
          <KpiCard label="Employees paid" icon={Users} tone="success" value={latestTotals?.employees ?? 0} hint={latest ? periodLabel(latest.period) : "No processed runs yet"} />
          <KpiCard
            label="Pending payroll"
            icon={CalendarClock}
            tone={currentStatus === "Processed" ? "success" : "warning"}
            value={<span className="text-xl">{currentStatus}</span>}
            hint={`${periodLabel(period)} · pay day ${formatDate(payDate, "d MMM")}`}
            href="/payroll/process"
            testId="kpi-pending-payroll"
          />
          <KpiCard label="Completed payroll runs" icon={CheckCircle2} tone="info" value={completedThisYear} hint={`Processed in ${year}`} href="/payroll/history" />
          <KpiCard label="Allowances" icon={Gift} tone="primary" value={latestTotals ? formatCompactMoney(latestTotals.allowances) : "—"} hint="Transport, meal and other" />
          <KpiCard label="Deductions" icon={MinusCircle} tone="danger" value={latestTotals ? formatCompactMoney(latestTotals.deductions) : "—"} hint="EPF, APIT, loans and other" />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <SectionCard
            className="lg:col-span-2"
            title="Payroll trend"
            description="Gross pay, net pay and total employer cost per run"
            action={
              <ChartLegend
                items={[
                  { label: "Gross", color: chartColors[0] },
                  { label: "Net", color: chartColors[1] },
                  { label: "Employer cost", color: chartColors[2] },
                ]}
              />
            }
          >
            {chartData.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} barGap={4}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="label" {...axisProps} />
                  <YAxis {...axisProps} tickFormatter={axisMoney} width={52} />
                  <Tooltip content={<ChartTooltip formatter={(v) => formatMoney(v)} />} cursor={tooltipCursor} />
                  <Bar isAnimationActive={chartAnimation} dataKey="gross" name="Gross" fill={chartColors[0]} radius={[4, 4, 0, 0]} maxBarSize={26} />
                  <Bar isAnimationActive={chartAnimation} dataKey="net" name="Net" fill={chartColors[1]} radius={[4, 4, 0, 0]} maxBarSize={26} />
                  <Line isAnimationActive={chartAnimation} dataKey="employerCost" name="Employer cost" stroke={chartColors[2]} strokeWidth={2} dot={{ r: 3 }} type="monotone" />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState title="No payroll runs yet" description="Generate the first payroll run to see the trend." />
            )}
          </SectionCard>

          <Card className="flex flex-col p-5" data-testid="current-period-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[13px] font-medium text-muted-foreground">Current period</p>
                <p className="mt-1 text-lg font-semibold tracking-tight">{periodLabel(period)}</p>
              </div>
              <StatusBadge status={currentStatus} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-subtle p-3">
                <dt className="text-xs text-muted-foreground">Pay day</dt>
                <dd className="mt-0.5 font-medium tabular">{formatDate(payDate, "EEE, d MMM")}</dd>
              </div>
              <div className="rounded-lg bg-subtle p-3">
                <dt className="text-xs text-muted-foreground">Eligible employees</dt>
                <dd className="mt-0.5 font-medium tabular">{currentRun ? currentRun.items.length : eligible}</dd>
              </div>
              {currentRun && (
                <div className="col-span-2 rounded-lg bg-subtle p-3">
                  <dt className="text-xs text-muted-foreground">Net payable</dt>
                  <dd className="mt-0.5 font-medium tabular">{formatMoney(runTotals(currentRun.items).net)}</dd>
                </div>
              )}
            </dl>
            <div className="mt-5">
              <PayrollStepper status={currentRun?.status ?? null} compact />
            </div>
            <p className="mt-4 text-[13px] text-muted-foreground">
              {!currentRun
                ? "Payroll for this month hasn't been generated yet. Review salary structures, then start the run."
                : currentRun.status === "Draft"
                  ? "A draft is ready for review. Check warnings and submit it for approval."
                  : currentRun.status === "Pending Approval"
                    ? "Submitted and waiting for approval."
                    : currentRun.status === "Approved"
                      ? "Approved — process it to publish payslips."
                      : `Processed ${formatDateTime(currentRun.processedAt)}. Payslips are available to employees.`}
            </p>
            <div className="mt-auto pt-5">
              <Button asChild className="w-full" size="lg">
                <Link href={ctaHref}>
                  {ctaLabel} <ArrowRight />
                </Link>
              </Button>
            </div>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <SectionCard
            title="Recent payroll runs"
            description="Latest runs across all statuses"
            action={
              <Button asChild variant="ghost" size="sm">
                <Link href="/payroll/history">
                  View all <ArrowRight />
                </Link>
              </Button>
            }
            bodyClassName="px-0 pb-2"
          >
            {runs.length ? (
              <ul className="divide-y divide-border">
                {sortRunsDesc(runs)
                  .slice(0, 6)
                  .map((r) => {
                    const t = runTotals(r.items);
                    return (
                      <li key={r.id}>
                        <Link href={r.status === "Processed" ? `/payroll/payslips?period=${r.period}` : `/payroll/process?period=${r.period}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-subtle">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
                            <Banknote className="size-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{periodLabel(r.period)}</p>
                            <p className="text-xs text-muted-foreground tabular">
                              {pluralize(t.employees, "employee")} · {formatCompactMoney(t.net)} net
                            </p>
                          </div>
                          <StatusBadge status={r.status} />
                        </Link>
                      </li>
                    );
                  })}
              </ul>
            ) : (
              <EmptyState title="No payroll runs" description="Runs appear here once generated." />
            )}
          </SectionCard>

          <SectionCard className="lg:col-span-2" title="Cost breakdown" description={latest ? `Latest processed run · ${periodLabel(latest.period)}` : "No processed run yet"}>
            {latestTotals ? (
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <div className="flex items-baseline justify-between">
                    <p className="text-sm font-medium">Earnings</p>
                    <p className="text-sm font-semibold tabular">{formatMoney(latestTotals.gross)}</p>
                  </div>
                  <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                    {earnings.map((e) => (
                      <span key={e.label} style={{ width: `${(e.value / Math.max(1, latestTotals.gross)) * 100}%`, background: e.color }} />
                    ))}
                  </div>
                  <ul className="mt-4 space-y-2.5">
                    {earnings.map((e) => (
                      <li key={e.label} className="flex items-center gap-2 text-sm">
                        <span className="size-2 shrink-0 rounded-full" style={{ background: e.color }} />
                        <span className="flex-1 text-muted-foreground">{e.label}</span>
                        <span className="text-xs text-muted-foreground tabular">{((e.value / Math.max(1, latestTotals.gross)) * 100).toFixed(1)}%</span>
                        <span className="w-28 text-right font-medium tabular">{formatCompactMoney(e.value)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="flex items-baseline justify-between">
                    <p className="text-sm font-medium">Statutory contributions</p>
                    <p className="text-xs text-muted-foreground">illustrative rates</p>
                  </div>
                  <ul className="mt-3 space-y-3">
                    {statutory.map((s) => (
                      <li key={s.label}>
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="flex items-center gap-2 text-muted-foreground">
                            {s.note === "Employer" ? <Landmark className="size-3.5" /> : <CircleDollarSign className="size-3.5" />}
                            {s.label}
                          </span>
                          <span className="font-medium tabular">{formatCompactMoney(s.value)}</span>
                        </div>
                        <Progress value={(s.value / statMax) * 100} className="mt-1.5 h-1.5" indicatorClassName={cn(s.note === "Employer" ? "bg-chart-5" : "bg-chart-4")} />
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 flex items-center justify-between rounded-lg bg-subtle px-3 py-2 text-sm">
                    <span className="text-muted-foreground">Total employer cost</span>
                    <span className="font-semibold tabular">{formatMoney(latestTotals.employerCost)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState title="Nothing to break down yet" description="Process a payroll run to see the cost breakdown." />
            )}
          </SectionCard>
        </div>
      </div>
    </PayrollPageFrame>
  );
}
