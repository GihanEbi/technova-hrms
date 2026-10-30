"use client";

import * as React from "react";
import { useHRStore } from "@/store/hr-store";
import { useAuth } from "@/hooks/use-hr";
import { can } from "@/lib/permissions";
import { now } from "@/lib/dates";
import { round2 } from "@/lib/utils";
import { evaluationCriteria } from "@/data/seed-data/catalog";
import type { CriterionId, Employee, Evaluation, Role } from "@/types";

export const criteria = evaluationCriteria as readonly { id: CriterionId; label: string }[];

export const criterionHelp: Record<CriterionId, string> = {
  attendance: "Reliability, punctuality and respect for working hours.",
  communication: "Clarity with teammates, stakeholders and in writing.",
  teamwork: "Collaboration, support for others and shared ownership.",
  quality: "Accuracy, attention to detail and standard of deliverables.",
  technical: "Depth of role-specific knowledge and skills.",
  problemSolving: "Approach to analysing issues and finding solutions.",
  productivity: "Output, focus and delivery against commitments.",
};

/** Sort key for labels like "Q4 2026" or "H1 2026" (later periods sort higher; quarters before halves ending the same month). */
export function periodSortKey(label: string) {
  const m = /^(Q|H)(\d) (\d{4})$/.exec(label.trim());
  if (!m) return 0;
  const n = Number(m[2]);
  const endMonth = m[1] === "Q" ? n * 3 : n * 6;
  return Number(m[3]) * 100 + endMonth + (m[1] === "Q" ? 0.5 : 0);
}

export function comparePeriodsDesc(a: string, b: string) {
  return periodSortKey(b) - periodSortKey(a);
}

/** Review periods offered in the form, derived from the current date. */
export function reviewPeriodOptions(ref: Date = now()) {
  const year = ref.getFullYear();
  const q = Math.floor(ref.getMonth() / 3) + 1;
  const h = ref.getMonth() >= 6 ? 2 : 1;
  const out: string[] = [];
  for (let i = 0; i < 5; i++) {
    const idx = q - 1 - i; // 0-based quarter offset
    const y = year + Math.floor(idx / 4);
    const qq = ((idx % 4) + 4) % 4 + 1;
    out.push(`Q${qq} ${y}`);
  }
  for (let i = 0; i < 3; i++) {
    const idx = h - 1 - i;
    const y = year + Math.floor(idx / 2);
    const hh = ((idx % 2) + 2) % 2 + 1;
    out.push(`H${hh} ${y}`);
  }
  return out.sort(comparePeriodsDesc);
}

export function currentQuarterLabel(ref: Date = now()) {
  return `Q${Math.floor(ref.getMonth() / 3) + 1} ${ref.getFullYear()}`;
}

/** Overall score to display: drafts may have unrated criteria (stored as 0) so they're averaged over rated ones. */
export function displayOverall(ev: Pick<Evaluation, "ratings" | "overall" | "status">) {
  if (ev.status === "Submitted") return ev.overall;
  const vals = Object.values(ev.ratings).filter((v) => v > 0);
  return vals.length ? round2(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
}

/** Latest submitted Manager Review per employee. */
export function latestManagerReviews(evaluations: Evaluation[]) {
  const map = new Map<string, Evaluation>();
  evaluations
    .filter((e) => e.status === "Submitted" && e.type === "Manager Review")
    .forEach((e) => {
      const cur = map.get(e.employeeId);
      const key = (x: Evaluation) => `${String(periodSortKey(x.period)).padStart(8, "0")}|${x.submittedAt ?? ""}`;
      if (!cur || key(e) > key(cur)) map.set(e.employeeId, e);
    });
  return map;
}

/** The most recent review period that has submitted manager reviews (falls back to the current quarter). */
export function latestCycle(evaluations: Evaluation[]) {
  const periods = Array.from(new Set(evaluations.filter((e) => e.status === "Submitted" && e.type === "Manager Review").map((e) => e.period)));
  periods.sort(comparePeriodsDesc);
  return periods[0] ?? currentQuarterLabel();
}

export function canViewEvaluation(ev: Evaluation, viewer: { id: string; role: Role }, employees: Employee[]) {
  if (ev.reviewerId === viewer.id) return true;
  if (ev.employeeId === viewer.id) return ev.status === "Submitted";
  if (can(viewer.role, "performance.viewAll")) return true;
  if (viewer.role === "team_lead") return employees.find((e) => e.id === ev.employeeId)?.managerId === viewer.id;
  return false;
}

/** Employees the signed-in reviewer may write manager reviews for. */
export function useReviewScope() {
  const { role, employee: me } = useAuth();
  const employees = useHRStore((s) => s.data.employees);
  const canManage = can(role, "performance.manage");
  return React.useMemo(() => {
    const active = employees.filter((e) => !e.archived);
    let scope: Employee[] = [];
    if (canManage) {
      scope = can(role, "performance.viewAll") ? active.filter((e) => e.id !== me?.id) : active.filter((e) => e.managerId === me?.id);
    }
    const ids = new Set(scope.map((e) => e.id));
    return { canManage, scope, inScope: (id: string) => ids.has(id) };
  }, [employees, canManage, role, me]);
}
