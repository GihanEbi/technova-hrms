"use client";

// Dialog for requesting an attendance correction. Reused by /attendance/my and /attendance/corrections.
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Info } from "lucide-react";
import { useHRStore } from "@/store/hr-store";
import { simulate } from "@/services/mock-api";
import { addDays, format, formatDate, formatTime, fromDateKey, now, timeOf, toDateKey } from "@/lib/dates";
import { Textarea } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { DatePicker, Field, TimeInput } from "@/components/forms/fields";
import { StatusBadge } from "@/components/shared/common";
import { describeDay } from "./lib";

const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/;

const schema = z
  .object({
    date: z.string().min(1, "Select the date to correct."),
    clockIn: z.string().regex(hhmm, "Enter the corrected clock-in time."),
    clockOut: z.string().regex(hhmm, "Enter the corrected clock-out time."),
    reason: z.string().trim().min(10, "Explain the correction in at least 10 characters.").max(500, "Keep the reason under 500 characters."),
  })
  .refine((v) => !hhmm.test(v.clockIn) || !hhmm.test(v.clockOut) || v.clockOut > v.clockIn, {
    message: "Clock-out must be after clock-in.",
    path: ["clockOut"],
  });

type Values = z.infer<typeof schema>;

/** How far back employees may request corrections. */
const LOOKBACK_DAYS = 60;

export function CorrectionDialog({
  open,
  onOpenChange,
  employeeId,
  initialDate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  initialDate?: string;
}) {
  const attendance = useHRStore((s) => s.data.attendance);
  const corrections = useHRStore((s) => s.data.corrections);
  const settings = useHRStore((s) => s.data.leaveSettings);
  const holidays = useHRStore((s) => s.data.holidays);
  const employee = useHRStore((s) => s.data.employees.find((e) => e.id === employeeId));
  const submitCorrection = useHRStore((s) => s.submitCorrection);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { date: "", clockIn: settings.workdayStart, clockOut: settings.workdayEnd, reason: "" },
  });
  const { register, control, handleSubmit, formState, watch, setValue, reset, setError } = form;
  const errors = formState.errors;
  const date = watch("date");

  const recordFor = React.useCallback((key: string) => attendance.find((a) => a.employeeId === employeeId && a.date === key), [attendance, employeeId]);

  const applyDate = React.useCallback(
    (key: string) => {
      const rec = key ? recordFor(key) : undefined;
      setValue("clockIn", rec?.clockIn ? timeOf(rec.clockIn) : settings.workdayStart, { shouldValidate: formState.isSubmitted });
      setValue("clockOut", rec?.clockOut ? timeOf(rec.clockOut) : settings.workdayEnd, { shouldValidate: formState.isSubmitted });
    },
    [recordFor, setValue, settings.workdayStart, settings.workdayEnd, formState.isSubmitted],
  );

  // Reset whenever the dialog opens
  React.useEffect(() => {
    if (!open) return;
    const key = initialDate ?? "";
    const rec = key ? attendance.find((a) => a.employeeId === employeeId && a.date === key) : undefined;
    reset({
      date: key,
      clockIn: rec?.clockIn ? timeOf(rec.clockIn) : settings.workdayStart,
      clockOut: rec?.clockOut ? timeOf(rec.clockOut) : settings.workdayEnd,
      reason: "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const today = toDateKey(now());
  const minKey = toDateKey(addDays(now(), -LOOKBACK_DAYS));
  const joinKey = employee?.joinDate ?? minKey;
  const isSelectable = (d: Date) => {
    const key = toDateKey(d);
    if (key > today || key < minKey || key < joinKey) return false;
    return describeDay(key, settings, holidays).working;
  };

  const record = date ? recordFor(date) : undefined;
  const pendingSameDay = date ? corrections.find((c) => c.employeeId === employeeId && c.date === date && c.status === "Pending") : undefined;

  const onSubmit = handleSubmit(async (v) => {
    if (!isSelectable(fromDateKey(v.date))) {
      setError("date", { message: "Choose a past working day (today or earlier)." });
      return;
    }
    const dup = useHRStore.getState().data.corrections.find((c) => c.employeeId === employeeId && c.date === v.date && c.status === "Pending");
    if (dup) {
      setError("date", { message: `You already have a pending request (${dup.id}) for this date.` });
      return;
    }
    if (v.date === today) {
      const nowHm = format(now(), "HH:mm");
      if (v.clockOut > nowHm) {
        setError("clockOut", { message: "Clock-out can't be later than the current time." });
        return;
      }
    }
    const id = await simulate(() =>
      submitCorrection({ employeeId, date: v.date, clockIn: v.clockIn, clockOut: v.clockOut, reason: v.reason.trim() }),
    );
    toast.success("Correction request submitted", {
      description: `${id} for ${formatDate(v.date, "EEE, d MMM")} is awaiting approval.`,
    });
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !formState.isSubmitting && onOpenChange(o)}>
      <DialogContent size="md">
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>Request attendance correction</DialogTitle>
            <DialogDescription>Fix a missed or incorrect clock-in or clock-out. Your manager and HR will review the request.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <Field label="Date" htmlFor="correction-date" required error={errors.date?.message} hint="Past working days only, up to 60 days back.">
              <Controller
                control={control}
                name="date"
                render={({ field }) => (
                  <DatePicker
                    id="correction-date"
                    value={field.value}
                    invalid={!!errors.date}
                    disabledDays={(d: Date) => !isSelectable(d)}
                    onChange={(v) => {
                      field.onChange(v);
                      applyDate(v);
                    }}
                  />
                )}
              />
            </Field>

            {date && (
              <div className="flex items-start gap-3 rounded-lg border border-border bg-subtle px-3 py-2.5 text-[13px]">
                <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">Current record · {formatDate(date, "EEE, d MMM yyyy")}</p>
                  {record ? (
                    <p className="mt-0.5 text-muted-foreground tabular">
                      In {formatTime(record.clockIn)} · Out {formatTime(record.clockOut)}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-muted-foreground">No attendance was recorded for this day.</p>
                  )}
                </div>
                {record && <StatusBadge status={record.status} />}
              </div>
            )}

            {pendingSameDay && (
              <p className="text-xs font-medium text-destructive" role="alert">
                A correction for this date is already pending ({pendingSameDay.id}). Wait for it to be reviewed before submitting another.
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Corrected clock in" htmlFor="correction-in" required error={errors.clockIn?.message}>
                <TimeInput id="correction-in" aria-invalid={!!errors.clockIn} {...register("clockIn")} />
              </Field>
              <Field label="Corrected clock out" htmlFor="correction-out" required error={errors.clockOut?.message}>
                <TimeInput id="correction-out" aria-invalid={!!errors.clockOut} {...register("clockOut")} />
              </Field>
            </div>

            <Field label="Reason" htmlFor="correction-reason" required error={errors.reason?.message} hint="At least 10 characters.">
              <Textarea
                id="correction-reason"
                rows={3}
                aria-invalid={!!errors.reason}
                placeholder="e.g. Forgot to clock out after the client meeting."
                {...register("reason")}
              />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={formState.isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" loading={formState.isSubmitting} disabled={!!pendingSameDay}>
              Submit request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
