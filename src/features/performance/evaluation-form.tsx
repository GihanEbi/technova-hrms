"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { toast } from "sonner";
import { AlertCircle, ClipboardCheck, FileSearch, Save, Send } from "lucide-react";
import { useHRStore } from "@/store/hr-store";
import { useAuth, useLookups } from "@/hooks/use-hr";
import { simulate } from "@/services/mock-api";
import { cn } from "@/lib/utils";
import type { CriterionId, Evaluation } from "@/types";
import { ratingLabels } from "@/data/seed-data/catalog";
import { Alert, AlertDescription, AlertTitle, Card, Textarea } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/overlays";
import { Field, SearchableSelect } from "@/components/forms/fields";
import { AccessDenied, EmptyState, FadeIn, PageHeader, SectionCard } from "@/components/shared/common";
import { RatingStars } from "@/features/employees/rating-stars";
import { PerformanceTabs } from "./performance-tabs";
import { criteria, criterionHelp, currentQuarterLabel, reviewPeriodOptions, useReviewScope } from "./utils";

type Ratings = Partial<Record<CriterionId, number>>;

export function EvaluationFormPage() {
  const params = useSearchParams();
  const { employee: me } = useAuth();
  const evaluations = useHRStore((s) => s.data.evaluations);
  const { canManage, inScope } = useReviewScope();
  const id = params.get("id");
  const employeeParam = params.get("employee");
  const selfParam = params.get("type") === "self";

  const existing = id ? evaluations.find((e) => e.id === id) : undefined;

  let body: React.ReactNode;
  if (id && !existing) {
    body = (
      <Card>
        <EmptyState
          icon={FileSearch}
          title="Evaluation not found"
          description="This draft doesn't exist. It may have been deleted or the demo data was reset."
          action={
            <Button asChild variant="outline">
              <Link href={canManage ? "/performance" : "/performance/my"}>Back to performance</Link>
            </Button>
          }
        />
      </Card>
    );
  } else if (existing && (existing.reviewerId !== me.id || (existing.type === "Manager Review" && !inScope(existing.employeeId)))) {
    body = <AccessDenied />;
  } else if (existing && existing.status === "Submitted") {
    body = (
      <Card>
        <EmptyState
          icon={ClipboardCheck}
          title="This evaluation was already submitted"
          description="Submitted evaluations are locked and can no longer be edited."
          action={
            <Button asChild variant="outline">
              <Link href={`/performance/${existing.id}`}>View evaluation</Link>
            </Button>
          }
        />
      </Card>
    );
  } else if (!existing && employeeParam && !selfParam && employeeParam !== me.id && !inScope(employeeParam)) {
    body = <AccessDenied />;
  } else {
    const forceSelf = !canManage || selfParam || employeeParam === me.id;
    body = <EvaluationForm key={existing?.id ?? `${employeeParam}-${forceSelf}`} existing={existing} initialEmployee={employeeParam} initialSelf={forceSelf} />;
  }

  const editing = !!existing && existing.status === "Draft";
  return (
    <FadeIn>
      <PageHeader
        title={editing ? "Edit evaluation draft" : selfParam || !canManage ? "Self evaluation" : "New evaluation"}
        description={editing ? `Continue working on ${existing!.id}. Drafts are only visible to you until submitted.` : "Rate each criterion from 1 to 5 and capture strengths and development areas."}
      />
      <PerformanceTabs />
      {body}
    </FadeIn>
  );
}

function EvaluationForm({ existing, initialEmployee, initialSelf }: { existing?: Evaluation; initialEmployee: string | null; initialSelf: boolean }) {
  const router = useRouter();
  const { employee: me } = useAuth();
  const lookups = useLookups();
  const evaluations = useHRStore((s) => s.data.evaluations);
  const saveEvaluation = useHRStore((s) => s.saveEvaluation);
  const { canManage, scope, inScope } = useReviewScope();
  const periodOptions = React.useMemo(() => {
    const list = reviewPeriodOptions();
    if (existing && !list.includes(existing.period)) list.unshift(existing.period);
    return list;
  }, [existing]);

  const [type, setType] = React.useState<Evaluation["type"]>(existing?.type ?? (initialSelf ? "Self Evaluation" : "Manager Review"));
  const [employeeId, setEmployeeId] = React.useState<string>(
    existing?.employeeId ?? (type === "Self Evaluation" ? me.id : initialEmployee && inScope(initialEmployee) ? initialEmployee : ""),
  );
  const [period, setPeriod] = React.useState(existing?.period ?? currentQuarterLabel());
  const [ratings, setRatings] = React.useState<Ratings>(() => {
    if (!existing) return {};
    const r: Ratings = {};
    (Object.entries(existing.ratings) as [CriterionId, number][]).forEach(([k, v]) => {
      if (v > 0) r[k] = v;
    });
    return r;
  });
  const [strengths, setStrengths] = React.useState(existing?.strengths ?? "");
  const [improvements, setImprovements] = React.useState(existing?.improvements ?? "");
  const [comments, setComments] = React.useState(existing?.comments ?? "");
  const [draftId, setDraftId] = React.useState<string | undefined>(existing?.id);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState<"draft" | "submit" | null>(null);

  const isSelf = type === "Self Evaluation";
  const locked = !!existing;
  const values = criteria.map((c) => ratings[c.id]).filter((v): v is number => !!v);
  const overall = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

  const employeeOptions = scope.map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName}`, description: `${lookups.desName(e.designationId)} · ${e.id}` }));
  const selfOption = [{ value: me.id, label: `${me.firstName} ${me.lastName}`, description: `You · ${me.id}` }];

  const changeType = (t: Evaluation["type"]) => {
    setType(t);
    setEmployeeId(t === "Self Evaluation" ? me.id : initialEmployee && inScope(initialEmployee) ? initialEmployee : "");
    setErrors({});
  };

  const save = async (submit: boolean) => {
    const errs: Record<string, string> = {};
    if (!employeeId) errs.employee = "Select the employee you're reviewing.";
    else if (!isSelf && !inScope(employeeId)) errs.employee = "This employee isn't in your review scope.";
    if (!period) errs.period = "Select a review period.";
    if (submit) {
      criteria.forEach((c) => {
        if (!ratings[c.id]) errs[c.id] = "Select a rating from 1 to 5.";
      });
      if (strengths.trim().length < 3) errs.strengths = "Describe at least one strength before submitting.";
    }
    const duplicate = evaluations.find(
      (e) => e.id !== draftId && e.status === "Submitted" && e.employeeId === employeeId && e.type === type && e.period === period && (isSelf || e.reviewerId === me.id),
    );
    if (duplicate) errs.period = `A submitted ${type.toLowerCase()} already exists for ${period} (${duplicate.id}).`;
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast.error(submit ? "Evaluation not submitted" : "Draft not saved", { description: "Please fix the highlighted fields." });
      return;
    }
    // Reuse an existing draft for the same person, type and period instead of creating a duplicate.
    const reuse = draftId ?? evaluations.find((e) => e.status === "Draft" && e.reviewerId === me.id && e.employeeId === employeeId && e.type === type && e.period === period)?.id;
    const full = Object.fromEntries(criteria.map((c) => [c.id, ratings[c.id] ?? 0])) as Record<CriterionId, number>;
    setBusy(submit ? "submit" : "draft");
    const id = await simulate(() =>
      saveEvaluation({ id: reuse, employeeId, type, period, ratings: full, strengths: strengths.trim(), improvements: improvements.trim(), comments: comments.trim() }, submit),
    );
    setBusy(null);
    if (submit) {
      toast.success("Evaluation submitted", { description: `${lookups.name(employeeId)} · ${period} · overall ${overall.toFixed(2)}` });
      router.push(`/performance/${id}`);
    } else {
      setDraftId(id);
      toast.success("Draft saved", { description: `${id} is saved. You can come back and finish it later.` });
      router.replace(`/performance/new?id=${id}`, { scroll: false });
    }
  };

  const errorCount = Object.keys(errors).length;

  return (
    <form
      noValidate
      aria-label="Evaluation form"
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        save(true);
      }}
    >
      <SectionCard title="Review details" description="Who is being reviewed and for which period.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Employee" htmlFor="eval-employee" required error={errors.employee}>
            <SearchableSelect
              id="eval-employee"
              value={employeeId}
              onChange={(v) => {
                setEmployeeId(v);
                setErrors((x) => ({ ...x, employee: "" }));
              }}
              options={isSelf ? selfOption : employeeOptions}
              placeholder="Select employee"
              searchPlaceholder="Search people in your scope…"
              disabled={isSelf || locked}
              invalid={!!errors.employee}
            />
          </Field>
          <Field label="Review type" htmlFor="eval-type" hint={!canManage ? "You can submit self evaluations only." : undefined}>
            <Select value={type} onValueChange={(v) => changeType(v as Evaluation["type"])} disabled={!canManage || locked}>
              <SelectTrigger id="eval-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {canManage && <SelectItem value="Manager Review">Manager Review</SelectItem>}
                <SelectItem value="Self Evaluation">Self Evaluation</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Review period" htmlFor="eval-period" required error={errors.period}>
            <Select
              value={period}
              onValueChange={(v) => {
                setPeriod(v);
                setErrors((x) => ({ ...x, period: "" }));
              }}
            >
              <SelectTrigger id="eval-period" aria-invalid={!!errors.period}>
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                {periodOptions.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <SectionCard title="Ratings" description="1 = Needs improvement · 3 = Meets expectations · 5 = Outstanding" bodyClassName="px-0 pb-0">
          <ul className="divide-y divide-border border-t border-border">
            {criteria.map((c) => (
              <li key={c.id} className="px-5 py-4">
                <RatingControl
                  id={c.id}
                  label={c.label}
                  help={criterionHelp[c.id]}
                  value={ratings[c.id]}
                  error={errors[c.id]}
                  onChange={(v) => {
                    setRatings((r) => ({ ...r, [c.id]: v }));
                    setErrors((x) => ({ ...x, [c.id]: "" }));
                  }}
                />
              </li>
            ))}
          </ul>
        </SectionCard>

        <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <Card className="p-5" data-testid="overall-rating">
            <p className="text-[13px] font-medium text-muted-foreground">Overall rating</p>
            <p className="mt-2 text-4xl font-semibold tracking-tight tabular" aria-live="polite">
              {overall ? overall.toFixed(2) : "—"}
              <span className="ml-1 text-base font-normal text-muted-foreground">/ 5</span>
            </p>
            <RatingStars value={overall} showValue={false} className="mt-2" />
            <p className="mt-3 text-xs text-muted-foreground tabular">
              {values.length} of {criteria.length} criteria rated
              {overall ? ` · ${ratingLabels[Math.min(5, Math.max(1, Math.round(overall)))]}` : ""}
            </p>
          </Card>
          {errorCount > 0 && Object.values(errors).some(Boolean) && (
            <Alert variant="destructive">
              <AlertCircle />
              <div>
                <AlertTitle>Some details are missing</AlertTitle>
                <AlertDescription>Rate all {criteria.length} criteria and add strengths before submitting.</AlertDescription>
              </div>
            </Alert>
          )}
        </div>
      </div>

      <SectionCard title="Feedback" description="Specific examples make feedback actionable.">
        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Strengths" htmlFor="eval-strengths" required error={errors.strengths}>
            <Textarea
              id="eval-strengths"
              rows={4}
              value={strengths}
              aria-invalid={!!errors.strengths}
              onChange={(e) => {
                setStrengths(e.target.value);
                setErrors((x) => ({ ...x, strengths: "" }));
              }}
              placeholder="What is going well? Where do they excel?"
            />
          </Field>
          <Field label="Areas for improvement" htmlFor="eval-improvements">
            <Textarea id="eval-improvements" rows={4} value={improvements} onChange={(e) => setImprovements(e.target.value)} placeholder="Where can they grow over the next cycle?" />
          </Field>
          <Field label="Comments" htmlFor="eval-comments" className="lg:col-span-2">
            <Textarea id="eval-comments" rows={3} value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Additional context, agreed actions or support needed" />
          </Field>
        </div>
      </SectionCard>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-col-reverse gap-2 border-t border-border bg-background/90 px-4 py-3 backdrop-blur sm:mx-0 sm:flex-row sm:items-center sm:justify-end sm:rounded-xl sm:border sm:px-5">
        <p className="mr-auto hidden text-xs text-muted-foreground sm:block">{draftId ? `Editing draft ${draftId}` : "Drafts are private until you submit."}</p>
        <Button type="button" variant="ghost" onClick={() => router.push(canManage && !isSelf ? "/performance" : "/performance/my")} disabled={!!busy}>
          Cancel
        </Button>
        <Button type="button" variant="outline" onClick={() => save(false)} loading={busy === "draft"} disabled={!!busy}>
          <Save /> Save draft
        </Button>
        <Button type="submit" loading={busy === "submit"} disabled={!!busy}>
          <Send /> Submit evaluation
        </Button>
      </div>
    </form>
  );
}

function RatingControl({ id, label, help, value, error, onChange }: { id: string; label: string; help: string; value?: number; error?: string; onChange: (v: number) => void }) {
  const [hover, setHover] = React.useState<number | null>(null);
  const shown = hover ?? value;
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium" id={`crit-${id}-label`}>
          {label}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground" id={`crit-${id}-help`}>
          {help}
        </p>
        {error && (
          <p className="mt-1 text-xs font-medium text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-start gap-1.5 sm:items-end">
        <RadioGroupPrimitive.Root
          aria-label={`${label} rating`}
          aria-describedby={`crit-${id}-help`}
          aria-invalid={!!error || undefined}
          value={value ? String(value) : ""}
          onValueChange={(v) => onChange(Number(v))}
          orientation="horizontal"
          className="flex gap-1.5"
          onMouseLeave={() => setHover(null)}
          data-testid={`rating-${id}`}
        >
          {[1, 2, 3, 4, 5].map((n) => {
            const selected = value === n;
            const filled = !!shown && n <= shown;
            return (
              <RadioGroupPrimitive.Item
                key={n}
                value={String(n)}
                aria-label={String(n)}
                title={ratingLabels[n]}
                onMouseEnter={() => setHover(n)}
                onFocus={() => setHover(null)}
                className={cn(
                  "flex size-9 items-center justify-center rounded-md border text-sm font-medium tabular transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30",
                  filled ? "border-primary/40 bg-primary-soft text-primary-soft-foreground" : "border-border bg-surface text-muted-foreground hover:bg-accent dark:bg-subtle",
                  selected && "border-primary bg-primary text-primary-foreground",
                  error && !value && "border-destructive/60",
                )}
              >
                {n}
              </RadioGroupPrimitive.Item>
            );
          })}
        </RadioGroupPrimitive.Root>
        <span className={cn("h-4 text-xs", shown ? "text-foreground" : "text-muted-foreground")} aria-hidden>
          {shown ? ratingLabels[shown] : "Not rated"}
        </span>
      </div>
    </div>
  );
}
