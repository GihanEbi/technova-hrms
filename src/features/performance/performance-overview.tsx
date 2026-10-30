"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CheckCircle2, ClipboardCheck, FilePen, PenSquare, Search, Star, Target, UserCheck } from "lucide-react";
import { useHRStore } from "@/store/hr-store";
import { useAuth, useLookups } from "@/hooks/use-hr";
import { formatDate } from "@/lib/dates";
import { pluralize } from "@/lib/utils";
import type { Evaluation } from "@/types";
import { Card, Input } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/overlays";
import { DataTable } from "@/components/tables/data-table";
import { AccessDenied, EmptyState, FadeIn, KpiCard, PageHeader, PersonCell, SectionCard, StatusBadge } from "@/components/shared/common";
import { axisProps, chartColors, ChartTooltip, gridProps, tooltipCursor, chartAnimation } from "@/components/charts/chart-kit";
import { RatingStars } from "@/features/employees/rating-stars";
import { ratingLabels } from "@/data/seed-data/catalog";
import { PerformanceTabs } from "./performance-tabs";
import { comparePeriodsDesc, displayOverall, latestCycle, latestManagerReviews, useReviewScope } from "./utils";

export function PerformanceOverview() {
  const router = useRouter();
  const { role, employee: me } = useAuth();
  const evaluations = useHRStore((s) => s.data.evaluations);
  const goals = useHRStore((s) => s.data.goals);
  const departments = useHRStore((s) => s.data.departments);
  const lookups = useLookups();
  const { canManage, scope, inScope } = useReviewScope();

  const [query, setQuery] = React.useState("");
  const [period, setPeriod] = React.useState("all");
  const [status, setStatus] = React.useState("all");

  const scoped = React.useMemo(
    () => evaluations.filter((e) => (inScope(e.employeeId) || e.reviewerId === me.id) && !(e.status === "Draft" && e.reviewerId !== me.id && e.employeeId === e.reviewerId)),
    [evaluations, inScope, me.id],
  );
  const cycle = latestCycle(evaluations);
  const latest = React.useMemo(() => {
    const m = latestManagerReviews(evaluations);
    return scope.map((e) => m.get(e.id)).filter((x): x is Evaluation => !!x);
  }, [evaluations, scope]);

  if (!canManage) return <AccessDenied />;

  const avg = latest.length ? latest.reduce((a, b) => a + b.overall, 0) / latest.length : 0;
  const submittedThisCycle = scoped.filter((e) => e.status === "Submitted" && e.type === "Manager Review" && e.period === cycle && inScope(e.employeeId));
  const reviewedIds = new Set(submittedThisCycle.map((e) => e.employeeId));
  const drafts = scoped.filter((e) => e.status === "Draft");
  const scopedGoals = goals.filter((g) => inScope(g.employeeId));
  const completedGoals = scopedGoals.filter((g) => g.status === "Completed").length;
  const goalPct = scopedGoals.length ? Math.round((completedGoals / scopedGoals.length) * 100) : 0;
  const due = scope.filter((e) => !reviewedIds.has(e.id));

  const distribution = [1, 2, 3, 4, 5].map((r) => ({ rating: String(r), label: ratingLabels[r], count: latest.filter((e) => Math.min(5, Math.max(1, Math.round(e.overall))) === r).length }));
  const byDept = departments
    .filter((d) => !d.archived)
    .map((d) => {
      const list = latest.filter((e) => lookups.employee(e.employeeId)?.departmentId === d.id);
      return { name: d.name, code: d.code, color: `var(--${d.color})`, avg: list.length ? Math.round((list.reduce((a, b) => a + b.overall, 0) / list.length) * 100) / 100 : 0, count: list.length };
    })
    .filter((d) => d.count > 0)
    .sort((a, b) => b.avg - a.avg);

  const periods = Array.from(new Set(scoped.map((e) => e.period))).sort(comparePeriodsDesc);
  const q = query.trim().toLowerCase();
  const filtered = scoped.filter((e) => {
    if (period !== "all" && e.period !== period) return false;
    if (status !== "all" && e.status !== status) return false;
    if (!q) return true;
    return [lookups.name(e.employeeId), lookups.name(e.reviewerId), e.id, e.employeeId, e.type].some((v) => v.toLowerCase().includes(q));
  });

  const columns: ColumnDef<Evaluation, unknown>[] = [
    {
      id: "employee",
      header: "Employee",
      accessorFn: (e) => lookups.name(e.employeeId),
      cell: ({ row }) => {
        const emp = lookups.employee(row.original.employeeId);
        return <PersonCell name={lookups.name(row.original.employeeId)} sub={`${row.original.id} · ${lookups.desName(emp?.designationId)}`} src={emp?.avatar} seed={emp?.id} />;
      },
    },
    { accessorKey: "period", header: "Period", sortingFn: (a, b) => -comparePeriodsDesc(a.original.period, b.original.period) },
    { accessorKey: "type", header: "Type", meta: { className: "hidden lg:table-cell" } },
    { id: "reviewer", header: "Reviewer", accessorFn: (e) => lookups.name(e.reviewerId), meta: { className: "hidden xl:table-cell" } },
    {
      id: "overall",
      header: "Overall",
      accessorFn: (e) => displayOverall(e),
      cell: ({ getValue }) => ((getValue() as number) > 0 ? <RatingStars value={getValue() as number} /> : <span className="text-muted-foreground">—</span>),
      meta: { className: "hidden sm:table-cell" },
    },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusBadge status={getValue() as string} /> },
    {
      id: "date",
      header: "Date",
      accessorFn: (e) => e.submittedAt ?? e.createdAt,
      cell: ({ getValue }) => <span className="tabular">{formatDate(getValue() as string)}</span>,
      meta: { className: "hidden md:table-cell" },
    },
  ];

  return (
    <FadeIn>
      <PageHeader
        title="Performance"
        description={role === "team_lead" ? `Reviews and goals for your ${pluralize(scope.length, "direct report")}.` : `Evaluations, ratings and goals across ${pluralize(scope.length, "employee")}.`}
        actions={
          <Button asChild>
            <Link href="/performance/new">
              <PenSquare /> New evaluation
            </Link>
          </Button>
        }
      />
      <PerformanceTabs />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Average rating" value={avg ? avg.toFixed(2) : "—"} icon={Star} hint={`Latest manager reviews · ${pluralize(latest.length, "employee")}`} testId="kpi-average-rating" />
        <KpiCard label="Reviews submitted" value={submittedThisCycle.length} icon={ClipboardCheck} tone="success" hint={`${cycle} cycle · ${scope.length ? Math.round((reviewedIds.size / scope.length) * 100) : 0}% coverage`} testId="kpi-reviews-submitted" />
        <KpiCard label="Drafts pending" value={drafts.length} icon={FilePen} tone="warning" hint="Saved but not yet submitted" testId="kpi-drafts" />
        <KpiCard label="Goals completed" value={`${goalPct}%`} icon={Target} tone="info" hint={`${completedGoals} of ${pluralize(scopedGoals.length, "goal")}`} testId="kpi-goals-completed" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3 [&>*]:min-w-0">
        <SectionCard title="Rating distribution" description="Employees by rounded overall rating (latest manager review)">
          {latest.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={distribution} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="rating" {...axisProps} tickFormatter={(v) => `${v}★`} />
                <YAxis allowDecimals={false} {...axisProps} />
                <Tooltip cursor={tooltipCursor} content={<ChartTooltip formatter={(v) => pluralize(v, "employee")} labelFormatter={(r) => `${r} · ${ratingLabels[Number(r)]}`} />} />
                <Bar isAnimationActive={chartAnimation} dataKey="count" name="Employees" radius={[4, 4, 0, 0]} maxBarSize={48}>
                  {distribution.map((d, i) => (
                    <Cell key={d.rating} fill={i >= 3 ? chartColors[1] : i === 2 ? chartColors[0] : chartColors[2]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState icon={Star} title="No submitted reviews yet" description="Ratings appear once manager reviews are submitted." />
          )}
        </SectionCard>
        <SectionCard title="Average rating by department" description="Mean of the latest manager review per employee">
          {byDept.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={byDept} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid {...gridProps} horizontal={false} vertical />
                <XAxis type="number" domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} {...axisProps} />
                <YAxis type="category" dataKey="code" width={48} {...axisProps} />
                <Tooltip cursor={tooltipCursor} content={<ChartTooltip formatter={(v) => `${v.toFixed(2)} / 5`} labelFormatter={(c) => byDept.find((d) => d.code === c)?.name ?? c} />} />
                <Bar isAnimationActive={chartAnimation} dataKey="avg" name="Average rating" radius={[0, 4, 4, 0]} maxBarSize={24}>
                  {byDept.map((d) => (
                    <Cell key={d.code} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState icon={Star} title="No department data yet" description="Submit manager reviews to compare departments." />
          )}
        </SectionCard>
        <SectionCard className="lg:col-span-2 xl:col-span-1" title="Due for review" description={`No submitted manager review for ${cycle}`} bodyClassName="px-0 pb-0" action={<span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular">{due.length}</span>}>
          {due.length ? (
            <ul className="scrollbar-thin max-h-[284px] divide-y divide-border overflow-y-auto border-t border-border" aria-label="Due for review">
              {due.map((e) => {
                const name = `${e.firstName} ${e.lastName}`;
                const draft = evaluations.find((x) => x.employeeId === e.id && x.reviewerId === me.id && x.status === "Draft" && x.type === "Manager Review");
                return (
                  <li key={e.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <PersonCell size="sm" name={name} sub={lookups.desName(e.designationId)} src={e.avatar} seed={e.id} />
                    </div>
                    {draft ? (
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/performance/new?id=${draft.id}`} aria-label={`Continue draft for ${name}`}>
                          Continue draft
                        </Link>
                      </Button>
                    ) : (
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/performance/new?employee=${e.id}`} aria-label={`Start review for ${name}`}>
                          Start review
                        </Link>
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon={CheckCircle2} title="Everyone is reviewed" description={`All employees in your scope have a submitted ${cycle} review.`} />
          )}
        </SectionCard>
      </div>

      <div className="mt-6">
        <Card className="min-w-0">
          <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by employee, reviewer or ID…" className="pl-9" aria-label="Search evaluations" />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:flex">
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="sm:w-36" aria-label="Filter by period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All periods</SelectItem>
                  {periods.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="sm:w-36" aria-label="Filter by status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="Submitted">Submitted</SelectItem>
                  <SelectItem value="Draft">Draft</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DataTable
            label="Evaluations"
            columns={columns}
            data={filtered}
            getRowId={(e) => e.id}
            initialSorting={[{ id: "date", desc: true }]}
            onRowClick={(e) => router.push(`/performance/${e.id}`)}
            rowTestId={(e) => `evaluation-row-${e.id}`}
            emptyTitle="No evaluations match your filters"
            emptyDescription="Try another period or status, or start a new evaluation."
            emptyAction={
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setQuery("");
                  setPeriod("all");
                  setStatus("all");
                }}
              >
                Clear filters
              </Button>
            }
          />
        </Card>

      </div>
      <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <UserCheck className="size-3.5" /> The current cycle is the most recent period with submitted manager reviews ({cycle}).
      </p>
    </FadeIn>
  );
}
