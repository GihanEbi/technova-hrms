"use client";

import * as React from "react";
import { toast } from "sonner";
import { Target } from "lucide-react";
import { useHRStore } from "@/store/hr-store";
import { simulate } from "@/services/mock-api";
import { addDays, formatDate, fromDateKey, isPastDay, now, todayKey } from "@/lib/dates";
import type { Goal } from "@/types";
import { Input, Label, Progress } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { DatePicker, Field } from "@/components/forms/fields";
import { EmptyState, StatusBadge } from "@/components/shared/common";

/** Read-only goal list. */
export function GoalList({ goals, emptyText }: { goals: Goal[]; emptyText: string }) {
  if (!goals.length) return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  return (
    <ul className="space-y-4">
      {goals.map((g) => (
        <li key={g.id}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium">{g.title}</p>
            <span className="text-xs text-muted-foreground tabular">{g.progress}%</span>
          </div>
          <Progress value={g.progress} className="mt-2" indicatorClassName={g.progress >= 100 ? "bg-success" : undefined} />
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground tabular">Due {formatDate(g.dueDate)}</p>
            <StatusBadge status={g.status} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Goals with inline progress editing for the signed-in employee. */
export function EditableGoalList({ goals, onAdd }: { goals: Goal[]; onAdd: () => void }) {
  if (!goals.length)
    return (
      <EmptyState
        icon={Target}
        title="No goals yet"
        description="Set a few measurable goals for this cycle and track your progress here."
        action={
          <Button variant="outline" onClick={onAdd}>
            Create your first goal
          </Button>
        }
      />
    );
  return (
    <ul className="divide-y divide-border border-t border-border">
      {goals.map((g) => (
        <GoalRow key={g.id} goal={g} />
      ))}
    </ul>
  );
}

function GoalRow({ goal }: { goal: Goal }) {
  const updateGoal = useHRStore((s) => s.updateGoal);
  const [value, setValue] = React.useState(String(goal.progress));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => setValue(String(goal.progress)), [goal.progress]);
  const num = Number(value);
  const dirty = value !== String(goal.progress);
  const overdue = goal.status !== "Completed" && isPastDay(goal.dueDate);

  const save = async () => {
    if (value.trim() === "" || !Number.isFinite(num) || num < 0 || num > 100 || !Number.isInteger(num)) {
      setError("Enter a whole number between 0 and 100.");
      return;
    }
    setError(null);
    setBusy(true);
    await simulate(() => updateGoal(goal.id, { progress: num }));
    setBusy(false);
    toast.success("Goal updated", { description: `${goal.title} is now ${num}% complete${num >= 100 ? " — nice work!" : "."}` });
  };

  return (
    <li className="px-5 py-4" data-testid={`goal-row-${goal.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">{goal.title}</p>
          <p className={`mt-0.5 text-xs tabular ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
            Due {formatDate(goal.dueDate)}
            {overdue && " · Overdue"}
          </p>
        </div>
        <StatusBadge status={goal.status} />
      </div>
      <Progress value={goal.progress} className="mt-3" indicatorClassName={goal.progress >= 100 ? "bg-success" : undefined} aria-label={`${goal.title} progress`} />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={Number.isFinite(num) ? Math.min(100, Math.max(0, num)) : 0}
          onChange={(e) => setValue(e.target.value)}
          aria-label={`Progress slider for ${goal.title}`}
          className="h-2 min-w-32 flex-1 cursor-pointer accent-primary"
        />
        <div className="flex items-center gap-2">
          <Label htmlFor={`goal-progress-${goal.id}`} className="sr-only">
            Progress for {goal.title}
          </Label>
          <div className="relative">
            <Input
              id={`goal-progress-${goal.id}`}
              type="number"
              min={0}
              max={100}
              inputMode="numeric"
              value={value}
              aria-invalid={!!error || undefined}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  save();
                }
              }}
              className="w-24 pr-7 text-right tabular [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-muted-foreground">%</span>
          </div>
          <Button size="sm" variant={dirty ? "default" : "outline"} onClick={save} loading={busy}>
            Update
          </Button>
        </div>
      </div>
      {error && (
        <p className="mt-1.5 text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}

export function AddGoalDialog({ open, onOpenChange, employeeId }: { open: boolean; onOpenChange: (o: boolean) => void; employeeId: string }) {
  const addGoal = useHRStore((s) => s.addGoal);
  const [title, setTitle] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [errors, setErrors] = React.useState<{ title?: string; dueDate?: string }>({});
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setTitle("");
      setDueDate("");
      setErrors({});
    }
  }, [open]);

  const save = async () => {
    const errs: typeof errors = {};
    if (title.trim().length < 3) errs.title = "Give the goal a short, specific title.";
    if (!dueDate) errs.dueDate = "Pick a due date.";
    else if (dueDate < todayKey()) errs.dueDate = "The due date can't be in the past.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    await simulate(() => addGoal({ employeeId, title: title.trim(), dueDate, progress: 0, status: "Not Started" }));
    setBusy(false);
    onOpenChange(false);
    toast.success("Goal added", { description: `${title.trim()} · due ${formatDate(dueDate)}` });
  };

  const today = fromDateKey(todayKey());
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent size="sm">
        <form
          noValidate
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <DialogHeader>
            <DialogTitle>Add goal</DialogTitle>
            <DialogDescription>Goals are shared with your reviewer and appear on your evaluations.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <Field label="Title" htmlFor="goal-title" required error={errors.title}>
              <Input id="goal-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Complete the AWS certification" aria-invalid={!!errors.title} />
            </Field>
            <Field label="Due date" htmlFor="goal-due" required error={errors.dueDate}>
              <DatePicker id="goal-due" value={dueDate} onChange={setDueDate} invalid={!!errors.dueDate} disabledDays={{ before: today }} startMonth={today} endMonth={addDays(now(), 730)} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Add goal
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
