"use client";

import * as React from "react";
import Link from "next/link";
import { ClipboardList, PenSquare, Plus, Star, Target, TrendingUp } from "lucide-react";
import { useHRStore } from "@/store/hr-store";
import { useAuth, useLookups } from "@/hooks/use-hr";
import { formatDate } from "@/lib/dates";
import { pluralize } from "@/lib/utils";
import { ratingLabels } from "@/data/seed-data/catalog";
import { Button } from "@/components/ui/button";
import { EmptyState, FadeIn, KpiCard, PageHeader, SectionCard, StatusBadge } from "@/components/shared/common";
import { RatingStars } from "@/features/employees/rating-stars";
import { PerformanceTabs } from "./performance-tabs";
import { AddGoalDialog, EditableGoalList } from "./goals";
import { comparePeriodsDesc, displayOverall, latestManagerReviews } from "./utils";

export function MyPerformance() {
  const { employee: me } = useAuth();
  const evaluations = useHRStore((s) => s.data.evaluations);
  const allGoals = useHRStore((s) => s.data.goals);
  const lookups = useLookups();
  const [addOpen, setAddOpen] = React.useState(false);

  const mine = evaluations
    .filter((e) => e.employeeId === me.id && (e.status === "Submitted" || e.reviewerId === me.id))
    .sort((a, b) => comparePeriodsDesc(a.period, b.period) || (b.submittedAt ?? b.createdAt).localeCompare(a.submittedAt ?? a.createdAt));
  const latest = latestManagerReviews(evaluations).get(me.id) ?? mine.find((e) => e.status === "Submitted");
  const goals = allGoals.filter((g) => g.employeeId === me.id).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const completed = goals.filter((g) => g.status === "Completed").length;
  const avgProgress = goals.length ? Math.round(goals.reduce((a, b) => a + b.progress, 0) / goals.length) : 0;
  const selfDraft = mine.find((e) => e.type === "Self Evaluation" && e.status === "Draft");

  return (
    <FadeIn>
      <PageHeader
        title="My Performance"
        description="Your reviews, ratings and goals in one place."
        actions={
          <>
            <Button variant="outline" onClick={() => setAddOpen(true)}>
              <Plus /> Add goal
            </Button>
            <Button asChild>
              <Link href={selfDraft ? `/performance/new?id=${selfDraft.id}` : "/performance/new?type=self"}>
                <PenSquare /> {selfDraft ? "Continue self evaluation" : "Start self evaluation"}
              </Link>
            </Button>
          </>
        }
      />
      <PerformanceTabs />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Latest overall rating"
          value={latest ? latest.overall.toFixed(2) : "—"}
          icon={Star}
          hint={latest ? `${latest.period} · ${ratingLabels[Math.min(5, Math.max(1, Math.round(latest.overall)))]}` : "No submitted review yet"}
          testId="kpi-my-rating"
        />
        <KpiCard label="Evaluations" value={mine.length} icon={ClipboardList} tone="info" hint={`${mine.filter((e) => e.status === "Submitted").length} submitted`} />
        <KpiCard label="Goals completed" value={`${completed}/${goals.length}`} icon={Target} tone="success" hint={goals.length ? `${Math.round((completed / goals.length) * 100)}% of your goals` : "Add your first goal"} />
        <KpiCard label="Average goal progress" value={`${avgProgress}%`} icon={TrendingUp} tone="warning" hint={pluralize(goals.filter((g) => g.status === "In Progress").length, "goal") + " in progress"} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <SectionCard title="Evaluation history" description="Manager reviews and your self evaluations" className="min-w-0 lg:col-span-2" bodyClassName="px-0 pb-0">
          {mine.length ? (
            <ul className="divide-y divide-border border-t border-border" aria-label="Evaluation history">
              {mine.map((ev) => {
                const ov = displayOverall(ev);
                return (
                  <li key={ev.id}>
                    <Link href={`/performance/${ev.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-subtle">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning-soft text-warning-soft-foreground">
                        <Star className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {ev.period} · {ev.type}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {ev.type === "Self Evaluation" ? "By you" : `By ${lookups.name(ev.reviewerId)}`} · {formatDate(ev.submittedAt ?? ev.createdAt)}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        {ov > 0 && <RatingStars value={ov} />}
                        <StatusBadge status={ev.status} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              icon={ClipboardList}
              title="No evaluations yet"
              description="Your manager reviews and self evaluations will appear here."
              action={
                <Button asChild variant="outline">
                  <Link href="/performance/new?type=self">Start self evaluation</Link>
                </Button>
              }
            />
          )}
        </SectionCard>

        <SectionCard
          title="My goals"
          description="Update your progress as you go"
          className="min-w-0 lg:col-span-3"
          bodyClassName="px-0 pb-0"
        >
          <EditableGoalList goals={goals} onAdd={() => setAddOpen(true)} />
        </SectionCard>
      </div>

      <AddGoalDialog open={addOpen} onOpenChange={setAddOpen} employeeId={me.id} />
    </FadeIn>
  );
}
