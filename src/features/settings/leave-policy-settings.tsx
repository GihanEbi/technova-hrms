"use client";

import * as React from "react";
import { toast } from "sonner";
import { CalendarCog, Clock } from "lucide-react";
import { useHRStore } from "@/store/hr-store";
import { simulate } from "@/services/mock-api";
import type { LeaveType, LeaveTypeId } from "@/types";
import { Badge, Checkbox, Input, Label, Switch } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Field, TimeInput } from "@/components/forms/fields";
import { SectionCard } from "@/components/shared/common";

type Draft = Record<LeaveTypeId, { allocation: string; noticeDays: string; maxConsecutive: string; active: boolean }>;

const weekdays = [
  { day: 1, label: "Mon", name: "Monday" },
  { day: 2, label: "Tue", name: "Tuesday" },
  { day: 3, label: "Wed", name: "Wednesday" },
  { day: 4, label: "Thu", name: "Thursday" },
  { day: 5, label: "Fri", name: "Friday" },
  { day: 6, label: "Sat", name: "Saturday" },
  { day: 0, label: "Sun", name: "Sunday" },
];

function toDraft(types: LeaveType[]): Draft {
  return Object.fromEntries(
    types.map((t) => [t.id, { allocation: String(t.allocation), noticeDays: String(t.noticeDays), maxConsecutive: String(t.maxConsecutive), active: t.active }]),
  ) as Draft;
}

const isInt = (v: string) => /^\d+$/.test(v.trim());

export function LeavePolicySettings() {
  return (
    <div className="space-y-6">
      <LeaveTypesCard />
      <WorkingDaysCard />
    </div>
  );
}

function LeaveTypesCard() {
  const leaveTypes = useHRStore((s) => s.data.leaveTypes);
  const updateLeaveType = useHRStore((s) => s.updateLeaveType);
  const [draft, setDraft] = React.useState<Draft>(() => toDraft(leaveTypes));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => setDraft(toDraft(leaveTypes)), [leaveTypes]);

  const set = (id: LeaveTypeId, key: keyof Draft[LeaveTypeId], value: string | boolean) => setDraft((d) => ({ ...d, [id]: { ...d[id], [key]: value } }));
  const dirty = leaveTypes.some((t) => {
    const d = draft[t.id];
    return d && (d.allocation !== String(t.allocation) || d.noticeDays !== String(t.noticeDays) || d.maxConsecutive !== String(t.maxConsecutive) || d.active !== t.active);
  });

  const save = async () => {
    const errs: Record<string, string> = {};
    leaveTypes.forEach((t) => {
      const d = draft[t.id];
      if (!isInt(d.allocation) || Number(d.allocation) > 365) errs[`${t.id}.allocation`] = "0–365 days";
      if (!isInt(d.noticeDays) || Number(d.noticeDays) > 90) errs[`${t.id}.noticeDays`] = "0–90 days";
      if (!isInt(d.maxConsecutive) || Number(d.maxConsecutive) < 1 || Number(d.maxConsecutive) > 365) errs[`${t.id}.maxConsecutive`] = "1–365 days";
    });
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast.error("Leave types not saved", { description: "Fix the highlighted values and try again." });
      return;
    }
    setBusy(true);
    await simulate(() =>
      leaveTypes.forEach((t) => {
        const d = draft[t.id];
        updateLeaveType(t.id, { allocation: Number(d.allocation), noticeDays: Number(d.noticeDays), maxConsecutive: Number(d.maxConsecutive), active: d.active });
      }),
    );
    setBusy(false);
    toast.success("Leave types updated", { description: "New allocations and rules apply to balances and future requests." });
  };

  const numberCell = (t: LeaveType, key: "allocation" | "noticeDays" | "maxConsecutive", label: string) => {
    const id = `lt-${t.id}-${key}`;
    const err = errors[`${t.id}.${key}`];
    return (
      <TableCell>
        <Label htmlFor={id} className="sr-only">
          {label} for {t.name}
        </Label>
        <Input
          id={id}
          type="number"
          min={0}
          inputMode="numeric"
          className="w-24 text-right tabular"
          value={draft[t.id]?.[key] ?? ""}
          aria-invalid={!!err || undefined}
          onChange={(e) => {
            set(t.id, key, e.target.value);
            setErrors((x) => ({ ...x, [`${t.id}.${key}`]: "" }));
          }}
        />
        {err && (
          <p className="mt-1 text-xs font-medium whitespace-normal text-destructive" role="alert">
            {err}
          </p>
        )}
      </TableCell>
    );
  };

  return (
    <SectionCard title="Leave types" description="Annual allocations and request rules. An allocation of 0 means no limit (unpaid leave)." bodyClassName="px-0 pb-0" action={<CalendarCog className="size-4 text-muted-foreground" />}>
      <div className="border-t border-border">
        <Table aria-label="Leave types">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Leave type</TableHead>
              <TableHead>Allocation (days)</TableHead>
              <TableHead>Notice (days)</TableHead>
              <TableHead>Max consecutive</TableHead>
              <TableHead>Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaveTypes.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: `var(--${t.color})` }} aria-hidden />
                    <div>
                      <p className="font-medium">{t.name}</p>
                      <Badge variant={t.paid ? "success" : "secondary"} className="mt-1">
                        {t.paid ? "Paid" : "Unpaid"}
                      </Badge>
                    </div>
                  </div>
                </TableCell>
                {numberCell(t, "allocation", "Allocation days")}
                {numberCell(t, "noticeDays", "Notice days")}
                {numberCell(t, "maxConsecutive", "Max consecutive days")}
                <TableCell>
                  <Switch id={`lt-${t.id}-active`} checked={draft[t.id]?.active ?? false} onCheckedChange={(v) => set(t.id, "active", v)} aria-label={`${t.name} active`} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-3 sm:flex-row sm:items-center sm:justify-end">
        <Button variant="outline" disabled={!dirty || busy} onClick={() => setDraft(toDraft(leaveTypes))}>
          Reset
        </Button>
        <Button onClick={save} loading={busy}>
          Save leave types
        </Button>
      </div>
    </SectionCard>
  );
}

function WorkingDaysCard() {
  const settings = useHRStore((s) => s.data.leaveSettings);
  const updateLeaveSettings = useHRStore((s) => s.updateLeaveSettings);
  const [days, setDays] = React.useState<number[]>(settings.workingDays);
  const [start, setStart] = React.useState(settings.workdayStart);
  const [end, setEnd] = React.useState(settings.workdayEnd);
  const [grace, setGrace] = React.useState(String(settings.graceMinutes));
  const [halfDay, setHalfDay] = React.useState(String(settings.halfDayHours));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setDays(settings.workingDays);
    setStart(settings.workdayStart);
    setEnd(settings.workdayEnd);
    setGrace(String(settings.graceMinutes));
    setHalfDay(String(settings.halfDayHours));
  }, [settings]);

  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  const save = async () => {
    const errs: Record<string, string> = {};
    if (!days.length) errs.days = "Select at least one working day.";
    if (!/^\d{2}:\d{2}$/.test(start)) errs.start = "Enter a start time.";
    if (!/^\d{2}:\d{2}$/.test(end)) errs.end = "Enter an end time.";
    else if (!errs.start && toMin(end) <= toMin(start)) errs.end = "The workday must end after it starts.";
    if (!isInt(grace) || Number(grace) > 120) errs.grace = "Enter 0–120 minutes.";
    const hd = Number(halfDay);
    if (halfDay.trim() === "" || !Number.isFinite(hd) || hd <= 0 || hd > 12) errs.halfDay = "Enter 0.5–12 hours.";
    else if (!errs.start && !errs.end && hd * 60 >= toMin(end) - toMin(start)) errs.halfDay = "Must be shorter than the full workday.";
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast.error("Working-day rules not saved", { description: "Fix the highlighted fields and try again." });
      return;
    }
    setBusy(true);
    await simulate(() => updateLeaveSettings({ workingDays: [...days].sort(), workdayStart: start, workdayEnd: end, graceMinutes: Number(grace), halfDayHours: hd }));
    setBusy(false);
    toast.success("Working-day rules saved", { description: `${days.length} working days · ${start}–${end} · ${grace} min grace.` });
  };

  const hours = /^\d{2}:\d{2}$/.test(start) && /^\d{2}:\d{2}$/.test(end) ? (toMin(end) - toMin(start)) / 60 : 0;

  return (
    <SectionCard title="Working-day rules" description="Used for leave day counts, lateness and payroll working days." action={<Clock className="size-4 text-muted-foreground" />}>
      <fieldset>
        <legend className="text-sm font-medium">Working weekdays</legend>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {weekdays.map((w) => {
            const checked = days.includes(w.day);
            return (
              <label
                key={w.day}
                htmlFor={`workday-${w.day}`}
                className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${checked ? "border-primary/40 bg-primary-soft text-primary-soft-foreground" : "border-border hover:bg-accent"}`}
              >
                <Checkbox
                  id={`workday-${w.day}`}
                  checked={checked}
                  aria-label={w.name}
                  onCheckedChange={(v) => {
                    setDays((d) => (v ? [...d, w.day] : d.filter((x) => x !== w.day)));
                    setErrors((x) => ({ ...x, days: "" }));
                  }}
                />
                {w.label}
              </label>
            );
          })}
        </div>
        {errors.days && (
          <p className="mt-1.5 text-xs font-medium text-destructive" role="alert">
            {errors.days}
          </p>
        )}
      </fieldset>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Workday start" htmlFor="workday-start" error={errors.start}>
          <TimeInput id="workday-start" value={start} onChange={(e) => setStart(e.target.value)} aria-invalid={!!errors.start || undefined} />
        </Field>
        <Field label="Workday end" htmlFor="workday-end" error={errors.end} hint={hours > 0 ? `${hours.toFixed(1)} hour workday` : undefined}>
          <TimeInput id="workday-end" value={end} onChange={(e) => setEnd(e.target.value)} aria-invalid={!!errors.end || undefined} />
        </Field>
        <Field label="Grace minutes" htmlFor="grace-minutes" error={errors.grace} hint="Clock-ins after this are marked late">
          <Input id="grace-minutes" type="number" min={0} max={120} inputMode="numeric" className="tabular" value={grace} onChange={(e) => setGrace(e.target.value)} aria-invalid={!!errors.grace || undefined} />
        </Field>
        <Field label="Half-day hours" htmlFor="half-day-hours" error={errors.halfDay} hint="Minimum hours for a half day">
          <Input id="half-day-hours" type="number" min={0.5} max={12} step={0.5} inputMode="decimal" className="tabular" value={halfDay} onChange={(e) => setHalfDay(e.target.value)} aria-invalid={!!errors.halfDay || undefined} />
        </Field>
      </div>
      <div className="mt-5 flex justify-end">
        <Button onClick={save} loading={busy}>
          Save working-day rules
        </Button>
      </div>
    </SectionCard>
  );
}
