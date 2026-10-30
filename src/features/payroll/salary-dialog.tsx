"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Info } from "lucide-react";
import { useHRStore } from "@/store/hr-store";
import { useLookups } from "@/hooks/use-hr";
import { calculatePayrollItem } from "@/lib/payroll";
import { periodLabel, todayKey } from "@/lib/dates";
import { cn, formatMoney } from "@/lib/utils";
import { simulate } from "@/services/mock-api";
import type { Employee, SalaryStructure } from "@/types";
import { Input, Separator } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { Field } from "@/components/forms/fields";
import { MoneyInput } from "./money-input";
import { PersonCell } from "@/components/shared/common";
import { currentPeriod, usePayrollContext } from "./payroll-utils";

const money = (label: string) =>
  z.number({ error: `${label} must be a number.` }).refine((v) => Number.isFinite(v), `${label} must be a valid amount.`).refine((v) => v >= 0, `${label} can't be negative.`);

const schema = z.object({
  basic: money("Basic salary").refine((v) => v > 0, "Basic salary must be greater than zero."),
  transportAllowance: money("Transport allowance"),
  mealAllowance: money("Meal allowance"),
  otherAllowance: money("Other allowances"),
  bonus: money("Bonus"),
  loanDeduction: money("Loan deduction"),
  otherDeduction: money("Other deductions"),
  overtimeHours: z
    .number({ error: "Overtime hours must be a number." })
    .refine((v) => Number.isFinite(v), "Enter a valid number of hours.")
    .refine((v) => v >= 0, "Overtime hours can't be negative.")
    .refine((v) => v <= 200, "Overtime hours can't exceed 200 per month."),
});
type Values = z.infer<typeof schema>;

export function emptySalary(employeeId: string): SalaryStructure {
  return {
    employeeId,
    currency: "LKR",
    frequency: "Monthly",
    basic: 0,
    transportAllowance: 0,
    mealAllowance: 0,
    otherAllowance: 0,
    overtimeHours: 0,
    bonus: 0,
    loanDeduction: 0,
    otherDeduction: 0,
    effectiveFrom: todayKey(),
    updatedAt: todayKey(),
  };
}

const currencyFields: { name: keyof Values; label: string; group: "earn" | "deduct" }[] = [
  { name: "basic", label: "Basic salary", group: "earn" },
  { name: "transportAllowance", label: "Transport allowance", group: "earn" },
  { name: "mealAllowance", label: "Meal allowance", group: "earn" },
  { name: "otherAllowance", label: "Other allowances", group: "earn" },
  { name: "bonus", label: "Bonus", group: "earn" },
  { name: "loanDeduction", label: "Loan deduction", group: "deduct" },
  { name: "otherDeduction", label: "Other deductions", group: "deduct" },
];

export function SalaryDialog({ employee, open, onOpenChange }: { employee: Employee | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">{employee && <SalaryForm key={employee.id} employee={employee} onDone={() => onOpenChange(false)} />}</DialogContent>
    </Dialog>
  );
}

function SalaryForm({ employee, onDone }: { employee: Employee; onDone: () => void }) {
  const salaries = useHRStore((s) => s.data.salaries);
  const settings = useHRStore((s) => s.data.payrollSettings);
  const updateSalary = useHRStore((s) => s.updateSalary);
  const lookups = useLookups();
  const existing = salaries.find((s) => s.employeeId === employee.id);
  const base = existing ?? emptySalary(employee.id);
  const period = currentPeriod();
  const ctx = usePayrollContext(period);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      basic: base.basic,
      transportAllowance: base.transportAllowance,
      mealAllowance: base.mealAllowance,
      otherAllowance: base.otherAllowance,
      bonus: base.bonus,
      loanDeduction: base.loanDeduction,
      otherDeduction: base.otherDeduction,
      overtimeHours: base.overtimeHours,
    },
  });
  const { control, formState, handleSubmit, register, watch } = form;
  const errors = formState.errors;
  const values = watch();

  const preview = React.useMemo(() => {
    const clean = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);
    const draft: SalaryStructure = {
      ...base,
      basic: clean(values.basic),
      transportAllowance: clean(values.transportAllowance),
      mealAllowance: clean(values.mealAllowance),
      otherAllowance: clean(values.otherAllowance),
      bonus: clean(values.bonus),
      loanDeduction: clean(values.loanDeduction),
      otherDeduction: clean(values.otherDeduction),
      overtimeHours: clean(values.overtimeHours),
    };
    return calculatePayrollItem(employee, draft, ctx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(values), employee, ctx, base]);

  const onSubmit = handleSubmit(async (v) => {
    await simulate(() => updateSalary(employee.id, v));
    toast.success("Salary structure updated", {
      description: `${employee.firstName} ${employee.lastName}'s pay changes apply from the next payroll run (${formatMoney(preview.net)} estimated net).`,
    });
    onDone();
  });

  const name = `${employee.firstName} ${employee.lastName}`;
  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col" aria-label="Edit salary structure">
      <DialogHeader>
        <DialogTitle>Edit salary structure</DialogTitle>
        <DialogDescription>
          Monthly pay components for {name} ({employee.id}). Changes apply to draft and future payroll runs — processed payslips are never altered.
        </DialogDescription>
      </DialogHeader>
      <DialogBody>
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-5">
            <PersonCell name={name} sub={`${lookups.desName(employee.designationId)} · ${lookups.deptName(employee.departmentId)}`} src={employee.avatar} seed={employee.id} />
            <div>
              <p className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Earnings</p>
              <div className="grid gap-4 sm:grid-cols-2">
                {currencyFields
                  .filter((f) => f.group === "earn")
                  .map((f) => (
                    <Field key={f.name} label={f.label} htmlFor={`salary-${f.name}`} required={f.name === "basic"} error={errors[f.name]?.message}>
                      <Controller
                        control={control}
                        name={f.name}
                        render={({ field }) => <MoneyInput id={`salary-${f.name}`} value={field.value} onChange={field.onChange} onBlur={field.onBlur} invalid={!!errors[f.name]} />}
                      />
                    </Field>
                  ))}
                <Field label="Overtime hours" htmlFor="salary-overtimeHours" error={errors.overtimeHours?.message} hint={`Paid at ${settings.overtimeMultiplier}× the hourly rate (basic ÷ ${settings.standardMonthlyHours} h).`}>
                  <Input
                    id="salary-overtimeHours"
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    className="tabular"
                    aria-invalid={!!errors.overtimeHours}
                    {...register("overtimeHours", { setValueAs: (v) => (v === "" || v === null ? 0 : Number(v)) })}
                  />
                </Field>
              </div>
            </div>
            <div>
              <p className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Deductions</p>
              <div className="grid gap-4 sm:grid-cols-2">
                {currencyFields
                  .filter((f) => f.group === "deduct")
                  .map((f) => (
                    <Field key={f.name} label={f.label} htmlFor={`salary-${f.name}`} error={errors[f.name]?.message}>
                      <Controller
                        control={control}
                        name={f.name}
                        render={({ field }) => <MoneyInput id={`salary-${f.name}`} value={field.value} onChange={field.onChange} onBlur={field.onBlur} invalid={!!errors[f.name]} />}
                      />
                    </Field>
                  ))}
              </div>
            </div>
          </div>

          <aside className="h-fit rounded-xl border border-border bg-subtle p-4" aria-label="Payroll preview" data-testid="salary-preview">
            <p className="text-sm font-semibold">Live preview</p>
            <p className="text-xs text-muted-foreground">{periodLabel(period)} · {preview.workingDays} working days</p>
            <dl className="mt-4 space-y-2 text-sm">
              <Row label="Gross pay" value={preview.gross} strong />
              <Separator className="my-2" />
              <Row label={`EPF employee (${settings.epfEmployeeRate}%)`} value={-preview.epfEmployee} />
              <Row label="APIT" value={-preview.apit} />
              {preview.loanDeduction > 0 && <Row label="Loan deduction" value={-preview.loanDeduction} />}
              {preview.otherDeduction > 0 && <Row label="Other deductions" value={-preview.otherDeduction} />}
              {preview.unpaidLeaveDeduction > 0 && <Row label={`Unpaid leave (${preview.unpaidLeaveDays} d)`} value={-preview.unpaidLeaveDeduction} />}
              <Separator className="my-2" />
              <div className="flex items-center justify-between rounded-lg bg-primary-soft px-3 py-2 text-primary-soft-foreground">
                <dt className="text-sm font-medium">Net pay</dt>
                <dd className="font-semibold tabular" data-testid="salary-preview-net">{formatMoney(preview.net)}</dd>
              </div>
            </dl>
            <div className="mt-4 rounded-lg border border-dashed border-border p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Info className="size-3.5" /> Employer contributions · illustrative
              </p>
              <dl className="mt-2 space-y-1.5 text-sm">
                <Row label={`EPF employer (${settings.epfEmployerRate}%)`} value={preview.epfEmployer} />
                <Row label={`ETF (${settings.etfRate}%)`} value={preview.etfEmployer} />
              </dl>
            </div>
            {preview.warnings.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-warning-soft-foreground">
                {preview.warnings.map((w) => (
                  <li key={w} className="rounded-md bg-warning-soft px-2 py-1">{w}</li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      </DialogBody>
      <DialogFooter>
        {Object.keys(errors).length > 0 && <p className="mr-auto self-center text-sm text-destructive">Please fix the highlighted fields.</p>}
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={formState.isSubmitting}>
          Save changes
        </Button>
      </DialogFooter>
    </form>
  );
}

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className={cn("text-muted-foreground", strong && "font-medium text-foreground")}>{label}</dt>
      <dd className={cn("tabular", strong && "font-semibold", value < 0 && "text-muted-foreground")}>
        {value < 0 ? `− ${formatMoney(-value)}` : formatMoney(value)}
      </dd>
    </div>
  );
}
