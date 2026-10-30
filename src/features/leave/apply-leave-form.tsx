"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, CalendarCheck, CheckCircle2, Info, Send } from "lucide-react";
import { useHRStore } from "@/store/hr-store";
import { useAuth } from "@/hooks/use-hr";
import { balanceFor, leaveBalances, validateLeave } from "@/lib/leave";
import { differenceInCalendarDays, fromDateKey, now, toDateKey, todayKey, isWorkingDay } from "@/lib/dates";
import { simulate } from "@/services/mock-api";
import type { LeaveTypeId } from "@/types";
import { Alert, AlertDescription, AlertTitle, Badge, Label, RadioGroup, RadioGroupItem, Separator, Switch, Textarea } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/overlays";
import { DatePicker, Field, FileUpload } from "@/components/forms/fields";
import { SectionCard } from "@/components/shared/common";
import { LeaveTypeLabel } from "./components";
import { formatDays, formatRange } from "./lib";

const dateKeyRe = /^\d{4}-\d{2}-\d{2}$/;

const schema = z
  .object({
    typeId: z.string().min(1, "Select a leave type."),
    startDate: z.string().min(1, "Select a start date."),
    endDate: z.string().min(1, "Select an end date."),
    halfDay: z.boolean(),
    halfDaySession: z.enum(["Morning", "Afternoon"]),
    reason: z.string().trim().min(5, "Give a short reason (at least 5 characters).").max(500, "Keep the reason under 500 characters."),
    attachmentName: z.string().nullable(),
  })
  .refine((v) => !v.startDate || !v.endDate || v.endDate >= v.startDate, { message: "End date cannot be before the start date.", path: ["endDate"] })
  .refine((v) => !v.startDate || v.startDate >= todayKey(), { message: "Leave can't start in the past.", path: ["startDate"] })
  .refine((v) => !v.halfDay || v.startDate === v.endDate, { message: "Half-day leave must start and end on the same day.", path: ["halfDay"] });

type Values = z.infer<typeof schema>;

function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function ApplyLeaveForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { employee: me } = useAuth();
  const leaveTypes = useHRStore((s) => s.data.leaveTypes);
  const leaveRequests = useHRStore((s) => s.data.leaveRequests);
  const settings = useHRStore((s) => s.data.leaveSettings);
  const holidays = useHRStore((s) => s.data.holidays);
  const applyLeave = useHRStore((s) => s.applyLeave);
  const activeTypes = leaveTypes.filter((t) => t.active);

  const prefill = React.useMemo(() => {
    const type = params.get("type");
    const start = params.get("start");
    const end = params.get("end");
    return {
      typeId: type && activeTypes.some((t) => t.id === type) ? type : "",
      startDate: start && dateKeyRe.test(start) ? start : "",
      endDate: end && dateKeyRe.test(end) ? end : start && dateKeyRe.test(start) ? start : "",
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { ...prefill, halfDay: false, halfDaySession: "Morning", reason: "", attachmentName: null },
  });
  const { control, register, handleSubmit, watch, setValue, formState } = form;
  const errors = formState.errors;
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const typeId = watch("typeId") as LeaveTypeId | "";
  const startDate = watch("startDate");
  const endDate = watch("endDate");
  const halfDay = watch("halfDay");
  const attachmentName = watch("attachmentName");
  const type = activeTypes.find((t) => t.id === typeId);
  const sameDay = !!startDate && startDate === endDate;

  React.useEffect(() => {
    if (!sameDay && halfDay) setValue("halfDay", false);
  }, [sameDay, halfDay, setValue]);
  React.useEffect(() => {
    setSubmitError(null);
  }, [typeId, startDate, endDate, halfDay]);

  const today = todayKey();
  const year = startDate ? Number(startDate.slice(0, 4)) : now().getFullYear();
  const balance = type ? balanceFor(leaveBalances(me.id, leaveTypes, leaveRequests, year), type.id) : undefined;
  const validation =
    type && startDate && endDate
      ? validateLeave({ employeeId: me.id, typeId: type.id, startDate, endDate, halfDay, types: leaveTypes, requests: leaveRequests, settings, holidays })
      : null;
  const days = validation?.days ?? 0;
  const noticeShort = type && startDate && type.noticeDays > 0 && differenceInCalendarDays(fromDateKey(startDate), fromDateKey(today)) < type.noticeDays;
  const unlimited = !balance || balance.available === Infinity;

  const selectable = (d: Date) => toDateKey(d) >= today && isWorkingDay(d, settings, holidays);

  const onSubmit = handleSubmit(async (v) => {
    const check = validateLeave({
      employeeId: me.id,
      typeId: v.typeId as LeaveTypeId,
      startDate: v.startDate,
      endDate: v.endDate,
      halfDay: v.halfDay,
      types: useHRStore.getState().data.leaveTypes,
      requests: useHRStore.getState().data.leaveRequests,
      settings,
      holidays,
    });
    if (!check.ok) {
      setSubmitError(check.error ?? "This request can't be submitted.");
      return;
    }
    const req = await simulate(() =>
      applyLeave({
        employeeId: me.id,
        typeId: v.typeId as LeaveTypeId,
        startDate: v.startDate,
        endDate: v.endDate,
        halfDay: v.halfDay,
        halfDaySession: v.halfDay ? v.halfDaySession : null,
        reason: v.reason.trim(),
        attachmentName: v.attachmentName,
        source: "Portal",
      }),
    );
    const name = activeTypes.find((t) => t.id === req.typeId)?.name.toLowerCase() ?? "leave";
    toast.success("Leave request submitted", { description: `${req.id} · ${formatDays(req.days)} of ${name} is pending approval.` });
    router.push("/leave/my");
  });

  return (
    <form onSubmit={onSubmit} noValidate aria-label="Apply leave" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
      <SectionCard title="Leave details" description="Choose the type and dates. Weekends and public holidays aren't counted.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Leave type" htmlFor="leave-type" required error={errors.typeId?.message} className="sm:col-span-2">
            <Controller
              control={control}
              name="typeId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="leave-type" aria-invalid={!!errors.typeId} onBlur={field.onBlur}>
                    <SelectValue placeholder="Select a leave type" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeTypes.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field label="Start date" htmlFor="start-date" required error={errors.startDate?.message}>
            <Controller
              control={control}
              name="startDate"
              render={({ field }) => (
                <DatePicker
                  id="start-date"
                  value={field.value}
                  invalid={!!errors.startDate}
                  disabledDays={(d: Date) => !selectable(d)}
                  onChange={(v) => {
                    field.onChange(v);
                    const end = form.getValues("endDate");
                    if (!end || end < v) setValue("endDate", v, { shouldValidate: formState.isSubmitted });
                  }}
                />
              )}
            />
          </Field>
          <Field label="End date" htmlFor="end-date" required error={errors.endDate?.message}>
            <Controller
              control={control}
              name="endDate"
              render={({ field }) => (
                <DatePicker
                  id="end-date"
                  value={field.value}
                  invalid={!!errors.endDate}
                  disabledDays={(d: Date) => !selectable(d) || (!!startDate && toDateKey(d) < startDate)}
                  onChange={field.onChange}
                />
              )}
            />
          </Field>

          <div className="sm:col-span-2">
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3">
              <div className="min-w-0">
                <Label htmlFor="half-day">Half day</Label>
                <p className="mt-1 text-xs text-muted-foreground">{sameDay ? "Take only the morning or afternoon off." : "Available when the start and end date are the same."}</p>
              </div>
              <Controller
                control={control}
                name="halfDay"
                render={({ field }) => <Switch id="half-day" checked={field.value} onCheckedChange={field.onChange} disabled={!sameDay} />}
              />
            </div>
            {errors.halfDay?.message && <p className="mt-1.5 text-xs font-medium text-destructive" role="alert">{errors.halfDay.message}</p>}
          </div>

          {halfDay && sameDay && (
            <div className="sm:col-span-2">
              <p className="mb-2 text-sm font-medium" id="session-label">
                Session
              </p>
              <Controller
                control={control}
                name="halfDaySession"
                render={({ field }) => (
                  <RadioGroup value={field.value} onValueChange={field.onChange} aria-labelledby="session-label" className="flex flex-wrap gap-3">
                    {(["Morning", "Afternoon"] as const).map((s) => (
                      <label key={s} htmlFor={`session-${s.toLowerCase()}`} className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary-soft">
                        <RadioGroupItem id={`session-${s.toLowerCase()}`} value={s} />
                        {s}
                        <span className="text-xs text-muted-foreground">{s === "Morning" ? "until 1:00 PM" : "from 1:00 PM"}</span>
                      </label>
                    ))}
                  </RadioGroup>
                )}
              />
            </div>
          )}

          <Field label="Reason" htmlFor="leave-reason" required error={errors.reason?.message} className="sm:col-span-2">
            <Textarea id="leave-reason" rows={4} aria-invalid={!!errors.reason} placeholder="e.g. Family function in Kandy" {...register("reason")} />
          </Field>

          <Field label="Attachment" htmlFor="leave-attachment" hint={type?.requiresAttachmentAfter ? `Recommended for ${type.name.toLowerCase()} longer than ${type.requiresAttachmentAfter} days.` : "Optional — e.g. a medical certificate."} className="sm:col-span-2">
            <FileUpload
              id="leave-attachment"
              accept=".pdf,.png,.jpg,.jpeg"
              label="Upload a supporting document"
              fileName={attachmentName}
              onFile={(f) => setValue("attachmentName", f.name, { shouldDirty: true })}
              onClear={() => setValue("attachmentName", null, { shouldDirty: true })}
            />
          </Field>
        </div>

        {submitError && (
          <Alert variant="destructive" className="mt-5">
            <AlertTriangle />
            <div>
              <AlertTitle>Can't submit this request</AlertTitle>
              <AlertDescription>{submitError}</AlertDescription>
            </div>
          </Alert>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
          <Button asChild variant="outline" type="button">
            <Link href="/leave/my">
              <ArrowLeft /> Back to my leave
            </Link>
          </Button>
          <Button type="submit" loading={formState.isSubmitting}>
            {!formState.isSubmitting && <Send />}
            Submit request
          </Button>
        </div>
      </SectionCard>

      <div className="lg:sticky lg:top-20" data-testid="leave-summary">
        <SectionCard title="Summary" description="Updates as you fill in the form.">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              {type ? <LeaveTypeLabel type={type} className="text-sm font-medium" /> : <span className="text-sm text-muted-foreground">No leave type selected</span>}
              {type && <Badge variant={type.paid ? "success" : "secondary"}>{type.paid ? "Paid" : "Unpaid"}</Badge>}
            </div>
            <div className="rounded-lg border border-border bg-subtle p-4">
              <p className="text-xs font-medium text-muted-foreground">Working days requested</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight tabular" data-testid="summary-days">
                {fmt(days)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground tabular">{startDate && endDate && endDate >= startDate ? formatRange(startDate, endDate) : "Pick your dates"}</p>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-border p-3">
                <dt className="text-xs text-muted-foreground">Balance before</dt>
                <dd className="mt-1 font-semibold tabular" data-testid="summary-before">
                  {!type ? "—" : unlimited ? "No limit" : `${fmt(balance!.available)} days`}
                </dd>
              </div>
              <div className="rounded-lg border border-border p-3">
                <dt className="text-xs text-muted-foreground">Balance after</dt>
                <dd className={`mt-1 font-semibold tabular ${!unlimited && balance && balance.available - days < 0 ? "text-destructive" : ""}`} data-testid="summary-after">
                  {!type ? "—" : unlimited ? "No limit" : `${fmt(balance!.available - days)} days`}
                </dd>
              </div>
            </dl>

            {validation && !validation.ok && (
              <Alert variant="destructive" data-testid="summary-error">
                <AlertTriangle />
                <div>
                  <AlertTitle>Fix before submitting</AlertTitle>
                  <AlertDescription>{validation.error}</AlertDescription>
                </div>
              </Alert>
            )}
            {validation?.ok && (
              <Alert variant="success">
                <CheckCircle2 />
                <div>
                  <AlertTitle>Looks good</AlertTitle>
                  <AlertDescription>
                    {formatDays(days)} will be sent to your manager for approval.
                  </AlertDescription>
                </div>
              </Alert>
            )}
            {(validation?.warning || noticeShort) && (
              <Alert variant="warning">
                <Info />
                <div>
                  <AlertTitle>Heads up</AlertTitle>
                  <AlertDescription>
                    {noticeShort && type && <p>{type.name} should be requested at least {type.noticeDays} days in advance.</p>}
                    {validation?.warning && <p>{validation.warning}{attachmentName ? " (attached)" : ""}</p>}
                  </AlertDescription>
                </div>
              </Alert>
            )}

            {type && (
              <>
                <Separator />
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    <CalendarCheck className="size-3.5" /> {type.name} rules
                  </p>
                  <ul className="space-y-1.5 text-[13px]">
                    <li className="flex justify-between gap-3"><span className="text-muted-foreground">Yearly allocation</span><span className="tabular">{type.allocation === 0 ? "No limit" : `${type.allocation} days`}</span></li>
                    <li className="flex justify-between gap-3"><span className="text-muted-foreground">Max consecutive</span><span className="tabular">{type.maxConsecutive} days</span></li>
                    <li className="flex justify-between gap-3"><span className="text-muted-foreground">Notice</span><span className="tabular">{type.noticeDays ? `${type.noticeDays} days` : "None"}</span></li>
                    <li className="flex justify-between gap-3"><span className="text-muted-foreground">Attachment</span><span>{type.requiresAttachmentAfter ? `After ${type.requiresAttachmentAfter} days` : "Not required"}</span></li>
                  </ul>
                  <p className="mt-3 text-xs text-muted-foreground">{type.description}</p>
                </div>
              </>
            )}
          </div>
        </SectionCard>
      </div>
    </form>
  );
}
