"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileSearch, History, Pencil, Star, Target, Trash2 } from "lucide-react";
import { useHRStore } from "@/store/hr-store";
import { useAuth, useLookups } from "@/hooks/use-hr";
import { can } from "@/lib/permissions";
import { formatDate, formatDateTime } from "@/lib/dates";
import { simulate } from "@/services/mock-api";
import { cn } from "@/lib/utils";
import { ratingLabels } from "@/data/seed-data/catalog";
import { Badge, Card, Progress } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { AccessDenied, ConfirmDialog, EmptyState, FadeIn, InfoGrid, PersonCell, SectionCard, StatusBadge } from "@/components/shared/common";
import { RatingStars } from "@/features/employees/rating-stars";
import { PerformanceTabs } from "./performance-tabs";
import { canViewEvaluation, comparePeriodsDesc, criteria, displayOverall } from "./utils";
import { GoalList } from "./goals";

export function EvaluationDetails({ id }: { id: string }) {
  const router = useRouter();
  const { role, employee: me } = useAuth();
  const evaluations = useHRStore((s) => s.data.evaluations);
  const employees = useHRStore((s) => s.data.employees);
  const goals = useHRStore((s) => s.data.goals);
  const deleteEvaluation = useHRStore((s) => s.deleteEvaluation);
  const lookups = useLookups();
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const deletingRef = React.useRef(false);

  const ev = evaluations.find((e) => e.id === id);
  if (!ev) {
    if (deletingRef.current) return null;
    return (
      <FadeIn>
        <Card>
          <EmptyState
            icon={FileSearch}
            title="Evaluation not found"
            description="This evaluation doesn't exist. It may have been deleted or the demo data was reset."
            action={
              <Button asChild variant="outline">
                <Link href={can(role, "performance.manage") ? "/performance" : "/performance/my"}>Back to performance</Link>
              </Button>
            }
          />
        </Card>
      </FadeIn>
    );
  }
  const viewer = { id: me.id, role };
  if (!canViewEvaluation(ev, viewer, employees)) return <AccessDenied />;

  const employee = lookups.employee(ev.employeeId);
  const name = lookups.name(ev.employeeId);
  const isDraft = ev.status === "Draft";
  const isReviewer = ev.reviewerId === me.id;
  const overall = displayOverall(ev);
  const history = evaluations
    .filter((e) => e.employeeId === ev.employeeId && e.id !== ev.id && canViewEvaluation(e, viewer, employees))
    .sort((a, b) => comparePeriodsDesc(a.period, b.period) || (b.submittedAt ?? b.createdAt).localeCompare(a.submittedAt ?? a.createdAt));
  const employeeGoals = goals.filter((g) => g.employeeId === ev.employeeId);
  const canLinkProfile = can(role, "employees.view") && (role !== "team_lead" || employee?.managerId === me.id);

  return (
    <FadeIn>
      <PerformanceTabs />
      <Card className="mb-6">
        <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">{ev.id}</span>
              <StatusBadge status={ev.status} />
              <Badge variant="outline">{ev.type}</Badge>
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                {ev.period} {ev.type === "Self Evaluation" ? "self evaluation" : "performance review"}
              </h1>
              <div className="mt-3">
                <PersonCell
                  name={name}
                  sub={`${lookups.desName(employee?.designationId)} · ${lookups.deptName(employee?.departmentId)}`}
                  src={employee?.avatar}
                  seed={ev.employeeId}
                  href={canLinkProfile ? `/employees/${ev.employeeId}` : undefined}
                />
              </div>
            </div>
            <InfoGrid
              columns={3}
              items={[
                { label: "Review period", value: ev.period },
                { label: "Reviewer", value: lookups.name(ev.reviewerId) },
                { label: isDraft ? "Last saved" : "Submitted", value: <span className="tabular">{isDraft ? formatDateTime(ev.createdAt) : formatDateTime(ev.submittedAt)}</span> },
              ]}
            />
          </div>
          <div className="flex shrink-0 flex-col gap-4 lg:items-end">
            <div className="rounded-xl border border-border bg-subtle px-5 py-4 lg:min-w-56 lg:text-right" data-testid="evaluation-overall">
              <p className="text-xs font-medium text-muted-foreground">Overall rating</p>
              <p className="mt-1 text-4xl font-semibold tracking-tight tabular">
                {overall ? overall.toFixed(2) : "—"}
                <span className="ml-1 text-base font-normal text-muted-foreground">/ 5</span>
              </p>
              <RatingStars value={overall} showValue={false} className="mt-1" />
              {overall > 0 && <p className="mt-1 text-xs text-muted-foreground">{ratingLabels[Math.min(5, Math.max(1, Math.round(overall)))]}</p>}
            </div>
            {isDraft && isReviewer && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setConfirmDelete(true)}>
                  <Trash2 /> Delete draft
                </Button>
                <Button asChild>
                  <Link href={`/performance/new?id=${ev.id}`}>
                    <Pencil /> Edit draft
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <SectionCard title="Ratings by criterion" description="Each criterion is rated on a 1–5 scale">
            <ul className="space-y-4">
              {criteria.map((c) => {
                const v = ev.ratings[c.id] ?? 0;
                return (
                  <li key={c.id} data-testid={`criterion-${c.id}`}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="font-medium">{c.label}</span>
                      <span className="shrink-0 text-muted-foreground tabular">
                        {v ? (
                          <>
                            <span className="font-semibold text-foreground">{v}</span> / 5 · {ratingLabels[v]}
                          </>
                        ) : (
                          "Not rated"
                        )}
                      </span>
                    </div>
                    <Progress
                      value={(v / 5) * 100}
                      className="mt-2"
                      aria-label={`${c.label}: ${v || 0} out of 5`}
                      indicatorClassName={cn(v >= 4 ? "bg-success" : v === 3 ? "bg-primary" : "bg-warning")}
                    />
                  </li>
                );
              })}
            </ul>
          </SectionCard>
          <SectionCard title="Feedback">
            <div className="grid gap-5 sm:grid-cols-2">
              <FeedbackBlock title="Strengths" text={ev.strengths} />
              <FeedbackBlock title="Areas for improvement" text={ev.improvements} />
              <div className="sm:col-span-2">
                <FeedbackBlock title="Comments" text={ev.comments} />
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Evaluation history" description={`Other evaluations for ${employee?.firstName ?? name}`} bodyClassName="px-0 pb-0" action={<History className="size-4 text-muted-foreground" />}>
            {history.length ? (
              <ul className="divide-y divide-border border-t border-border">
                {history.map((h) => (
                  <li key={h.id}>
                    <Link href={`/performance/${h.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-subtle">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-warning-soft text-warning-soft-foreground">
                        <Star className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {h.period} · {h.type}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {h.id} · {formatDate(h.submittedAt ?? h.createdAt)}
                        </span>
                      </span>
                      {h.status === "Submitted" ? <span className="text-sm font-semibold tabular">{h.overall.toFixed(2)}</span> : <StatusBadge status={h.status} />}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={History} title="No other evaluations" description="This is the only evaluation on record." className="py-8" />
            )}
          </SectionCard>
          <SectionCard title="Goals" action={<Target className="size-4 text-muted-foreground" />}>
            <GoalList goals={employeeGoals} emptyText="No goals set for this employee." />
          </SectionCard>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        tone="destructive"
        icon={Trash2}
        title="Delete this draft?"
        description={`The ${ev.period} draft for ${name} will be permanently removed. This can't be undone.`}
        confirmLabel="Delete draft"
        onConfirm={async () => {
          deletingRef.current = true;
          await simulate(() => deleteEvaluation(ev.id));
          toast.success("Draft deleted", { description: `${ev.id} was removed.` });
          router.push(can(role, "performance.manage") && ev.type === "Manager Review" ? "/performance" : "/performance/my");
        }}
      />
    </FadeIn>
  );
}

function FeedbackBlock({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <p className={cn("mt-1.5 text-sm leading-relaxed whitespace-pre-line", !text && "text-muted-foreground")}>{text || "Nothing added."}</p>
    </div>
  );
}
