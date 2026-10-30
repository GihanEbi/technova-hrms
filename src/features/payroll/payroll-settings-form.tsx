"use client";

import * as React from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Calculator, Info, Landmark, ListChecks, Plus, Scale, Trash2 } from "lucide-react";
import { useHRStore } from "@/store/hr-store";
import { useAuth } from "@/hooks/use-hr";
import { can } from "@/lib/permissions";
import { calculateApit } from "@/lib/payroll";
import { formatMoney } from "@/lib/utils";
import { simulate } from "@/services/mock-api";
import type { PayrollSettings } from "@/types";
import { Alert, AlertDescription, AlertTitle, Badge, Input, Switch } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/forms/fields";
import { MoneyInput } from "./money-input";
import { SectionCard } from "@/components/shared/common";

const num = (label: string, min: number, max: number, int = false) =>
  z
    .number({ error: `${label} is required.` })
    .refine((v) => Number.isFinite(v), `${label} must be a number.`)
    .refine((v) => !int || Number.isInteger(v), `${label} must be a whole number.`)
    .refine((v) => v >= min && v <= max, `${label} must be between ${min} and ${max}.`);

const schema = z
  .object({
    payDay: num("Pay day", 1, 28, true),
    epfEmployeeRate: num("EPF employee rate", 0, 100),
    epfEmployerRate: num("EPF employer rate", 0, 100),
    etfRate: num("ETF rate", 0, 100),
    overtimeMultiplier: num("Overtime multiplier", 1, 5),
    standardMonthlyHours: num("Standard monthly hours", 1, 400, true),
    lowNetThreshold: num("Low-pay threshold", 0, 10_000_000),
    apitEnabled: z.boolean(),
    apitBrackets: z
      .array(z.object({ upTo: z.number().nullable(), rate: num("Rate", 0, 100) }))
      .min(1, "Add at least one tax bracket."),
  })
  .superRefine((v, ctx) => {
    let prev = 0;
    v.apitBrackets.forEach((b, i) => {
      const last = i === v.apitBrackets.length - 1;
      if (last) return;
      if (b.upTo === null || !Number.isFinite(b.upTo) || b.upTo <= prev) {
        ctx.addIssue({ code: "custom", path: ["apitBrackets", i, "upTo"], message: `Must be greater than ${formatMoney(prev)}.` });
      } else prev = b.upTo;
    });
  });
type Values = z.infer<typeof schema>;

const components = [
  { name: "Basic salary", kind: "Earning", taxable: true, epf: true, note: "Prorated for mid-period joiners; unpaid leave deducted pro rata." },
  { name: "Transport allowance", kind: "Earning", taxable: true, epf: false, note: "Fixed monthly allowance." },
  { name: "Meal allowance", kind: "Earning", taxable: true, epf: false, note: "Fixed monthly allowance." },
  { name: "Other allowances", kind: "Earning", taxable: true, epf: false, note: "Role or location based allowances." },
  { name: "Overtime", kind: "Earning", taxable: true, epf: false, note: "Hours × (basic ÷ standard hours) × multiplier." },
  { name: "Bonus", kind: "Earning", taxable: true, epf: false, note: "One-off or seasonal payments." },
  { name: "EPF employee", kind: "Deduction", taxable: false, epf: false, note: "Statutory — % of EPF-able earnings." },
  { name: "APIT (PAYE)", kind: "Deduction", taxable: false, epf: false, note: "Progressive tax on taxable earnings." },
  { name: "Loan deduction", kind: "Deduction", taxable: false, epf: false, note: "Recurring staff loan instalment." },
  { name: "Other deductions", kind: "Deduction", taxable: false, epf: false, note: "Welfare, advances and similar." },
  { name: "Unpaid leave", kind: "Deduction", taxable: false, epf: false, note: "Reduces the EPF base and taxable pay." },
];

function toValues(s: PayrollSettings): Values {
  return {
    payDay: s.payDay,
    epfEmployeeRate: s.epfEmployeeRate,
    epfEmployerRate: s.epfEmployerRate,
    etfRate: s.etfRate,
    overtimeMultiplier: s.overtimeMultiplier,
    standardMonthlyHours: s.standardMonthlyHours,
    lowNetThreshold: s.lowNetThreshold,
    apitEnabled: s.apitEnabled,
    apitBrackets: s.apitBrackets.map((b, i, arr) => ({ upTo: i === arr.length - 1 ? null : b.upTo, rate: b.rate })),
  };
}

/** Reusable payroll settings form (used on /payroll/settings and inside the global Settings page). */
export function PayrollSettingsForm() {
  const settings = useHRStore((s) => s.data.payrollSettings);
  const updatePayrollSettings = useHRStore((s) => s.updatePayrollSettings);
  const { role } = useAuth();
  const editable = can(role, "settings.payroll");

  const form = useForm<Values>({ resolver: zodResolver(schema), mode: "onTouched", defaultValues: toValues(settings) });
  const { register, control, handleSubmit, formState, watch, reset } = form;
  const errors = formState.errors;
  const brackets = useFieldArray({ control, name: "apitBrackets" });
  const apitEnabled = watch("apitEnabled");
  const watchedBrackets = watch("apitBrackets");
  const [sample, setSample] = React.useState(300000);

  const sampleTax = React.useMemo(() => {
    const clean = watchedBrackets.map((b, i, arr) => ({ upTo: i === arr.length - 1 ? null : Number(b.upTo) || 0, rate: Number(b.rate) || 0 }));
    return calculateApit(sample, clean);
  }, [watchedBrackets, sample]);

  const numberOpts = { setValueAs: (v: unknown) => (v === "" || v === null || v === undefined ? Number.NaN : Number(v)) };

  const onSubmit = handleSubmit(async (v) => {
    const patch: Partial<PayrollSettings> = { ...v, apitBrackets: v.apitBrackets.map((b, i, arr) => ({ upTo: i === arr.length - 1 ? null : b.upTo, rate: b.rate })) };
    await simulate(() => updatePayrollSettings(patch));
    reset(v);
    toast.success("Payroll settings saved", { description: "New rules apply to generated and recalculated draft runs. Processed payslips are unchanged." });
  });

  const addBracket = () => {
    const list = watchedBrackets;
    const lastCeiling = list.length > 1 ? Number(list[list.length - 2].upTo) || 0 : 0;
    const lastRate = list.length ? Number(list[list.length - 1].rate) || 0 : 0;
    brackets.insert(Math.max(0, list.length - 1), { upTo: lastCeiling + 50000, rate: lastRate });
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6" aria-label="Payroll settings">
      <Alert variant="info">
        <Info />
        <div>
          <AlertTitle>Illustrative values</AlertTitle>
          <AlertDescription>
            The rates and tax brackets below are example values for this demo only — they are not current legal EPF, ETF or APIT rates. Confirm statutory rates with the relevant authorities before using any payroll system in production.
          </AlertDescription>
        </div>
      </Alert>
      {!editable && (
        <Alert>
          <Info />
          <AlertDescription>Your role can view payroll settings but not change them.</AlertDescription>
        </Alert>
      )}

      <fieldset disabled={!editable} className="space-y-6">
        <SectionCard title="Pay cycle & overtime" description="When employees are paid and how overtime is valued." action={<Calculator className="size-4 text-muted-foreground" />}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Payroll cycle" htmlFor="payroll-cycle" hint="Only monthly payroll is supported.">
              <Input id="payroll-cycle" value="Monthly" readOnly disabled />
            </Field>
            <Field label="Pay day" htmlFor="payroll-payDay" required error={errors.payDay?.message} hint="Day of the month, 1–28.">
              <Input id="payroll-payDay" type="number" min={1} max={28} className="tabular" aria-invalid={!!errors.payDay} {...register("payDay", numberOpts)} />
            </Field>
            <Field label="Overtime multiplier" htmlFor="payroll-overtimeMultiplier" required error={errors.overtimeMultiplier?.message} hint="× the hourly rate, e.g. 1.5">
              <Input id="payroll-overtimeMultiplier" type="number" step="0.05" min={1} className="tabular" aria-invalid={!!errors.overtimeMultiplier} {...register("overtimeMultiplier", numberOpts)} />
            </Field>
            <Field label="Standard monthly hours" htmlFor="payroll-standardMonthlyHours" required error={errors.standardMonthlyHours?.message} hint="Used to derive the hourly rate.">
              <Input id="payroll-standardMonthlyHours" type="number" min={1} className="tabular" aria-invalid={!!errors.standardMonthlyHours} {...register("standardMonthlyHours", numberOpts)} />
            </Field>
            <Field label="Low-pay review threshold" htmlFor="payroll-lowNetThreshold" required error={errors.lowNetThreshold?.message} hint="Net pay below this is flagged.">
              <Controller control={control} name="lowNetThreshold" render={({ field }) => <MoneyInput id="payroll-lowNetThreshold" value={field.value} onChange={field.onChange} onBlur={field.onBlur} invalid={!!errors.lowNetThreshold} disabled={!editable} />} />
            </Field>
          </div>
        </SectionCard>

        <SectionCard title="Statutory contributions" description="Applied to basic pay after unpaid-leave deductions." action={<Landmark className="size-4 text-muted-foreground" />}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="EPF employee (%)" htmlFor="payroll-epfEmployeeRate" required error={errors.epfEmployeeRate?.message} hint="Deducted from pay">
              <Input id="payroll-epfEmployeeRate" type="number" step="0.5" className="tabular" aria-invalid={!!errors.epfEmployeeRate} {...register("epfEmployeeRate", numberOpts)} />
            </Field>
            <Field label="EPF employer (%)" htmlFor="payroll-epfEmployerRate" required error={errors.epfEmployerRate?.message} hint="Paid by the company">
              <Input id="payroll-epfEmployerRate" type="number" step="0.5" className="tabular" aria-invalid={!!errors.epfEmployerRate} {...register("epfEmployerRate", numberOpts)} />
            </Field>
            <Field label="ETF (%)" htmlFor="payroll-etfRate" required error={errors.etfRate?.message} hint="Paid by the company">
              <Input id="payroll-etfRate" type="number" step="0.5" className="tabular" aria-invalid={!!errors.etfRate} {...register("etfRate", numberOpts)} />
            </Field>
          </div>
        </SectionCard>

        <SectionCard
          title="APIT (PAYE) tax table"
          description="Progressive monthly brackets applied to taxable pay."
          action={
            <div className="flex items-center gap-2">
              <Controller control={control} name="apitEnabled" render={({ field }) => <Switch id="payroll-apitEnabled" checked={field.value} onCheckedChange={field.onChange} disabled={!editable} />} />
              <label htmlFor="payroll-apitEnabled" className="text-sm font-medium">
                Enable APIT
              </label>
            </div>
          }
        >
          <div className={apitEnabled ? "" : "pointer-events-none opacity-50"} aria-disabled={!apitEnabled}>
            <div className="overflow-hidden rounded-lg border border-border">
              <div className="grid grid-cols-[2rem_1fr_7rem_2.25rem] items-center gap-3 bg-subtle px-3 py-2 text-xs font-medium text-muted-foreground sm:grid-cols-[2.5rem_1fr_9rem_2.25rem]">
                <span>#</span>
                <span>Monthly taxable income up to</span>
                <span>Rate (%)</span>
                <span className="sr-only">Remove</span>
              </div>
              <ul className="divide-y divide-border">
                {brackets.fields.map((f, i) => {
                  const last = i === brackets.fields.length - 1;
                  const upErr = errors.apitBrackets?.[i]?.upTo?.message;
                  const rateErr = errors.apitBrackets?.[i]?.rate?.message;
                  return (
                    <li key={f.id} className="grid grid-cols-[2rem_1fr_7rem_2.25rem] items-start gap-3 px-3 py-2.5 sm:grid-cols-[2.5rem_1fr_9rem_2.25rem]">
                      <span className="pt-2 text-xs text-muted-foreground tabular">{i + 1}</span>
                      <div className="min-w-0">
                        {last ? (
                          <p className="flex h-9 items-center text-sm text-muted-foreground">and above</p>
                        ) : (
                          <Controller
                            control={control}
                            name={`apitBrackets.${i}.upTo`}
                            render={({ field }) => <MoneyInput id={`apit-upTo-${i}`} aria-label={`Bracket ${i + 1} up to`} value={field.value ?? 0} onChange={field.onChange} onBlur={field.onBlur} invalid={!!upErr} disabled={!editable} />}
                          />
                        )}
                        {upErr && <p className="mt-1 text-xs font-medium text-destructive" role="alert">{upErr}</p>}
                      </div>
                      <div>
                        <Input id={`apit-rate-${i}`} aria-label={`Bracket ${i + 1} rate`} type="number" step="0.5" min={0} max={100} className="tabular" aria-invalid={!!rateErr} {...register(`apitBrackets.${i}.rate`, numberOpts)} />
                        {rateErr && <p className="mt-1 text-xs font-medium text-destructive" role="alert">{rateErr}</p>}
                      </div>
                      <Button type="button" variant="ghost" size="icon-sm" className="mt-0.5" aria-label={`Remove bracket ${i + 1}`} disabled={last || brackets.fields.length <= 2} onClick={() => brackets.remove(i)}>
                        <Trash2 />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button type="button" variant="outline" size="sm" onClick={addBracket} disabled={brackets.fields.length >= 10}>
                <Plus /> Add bracket
              </Button>
              <div className="flex items-center gap-2 text-sm">
                <label htmlFor="apit-sample" className="text-muted-foreground">Try:</label>
                <div className="w-40">
                  <MoneyInput id="apit-sample" value={sample} onChange={setSample} />
                </div>
                <span className="text-muted-foreground">→</span>
                <span className="font-medium tabular" data-testid="apit-sample-tax">{formatMoney(sampleTax)}</span>
              </div>
            </div>
          </div>
        </SectionCard>
      </fieldset>

      <SectionCard title="Salary components" description="How each component is treated by the calculation engine (read-only)." action={<ListChecks className="size-4 text-muted-foreground" />} bodyClassName="px-0 pb-0">
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-subtle text-xs text-muted-foreground">
              <tr>
                <th className="px-5 py-2.5 text-left font-medium">Component</th>
                <th className="px-3 py-2.5 text-left font-medium">Type</th>
                <th className="px-3 py-2.5 text-left font-medium">Taxable</th>
                <th className="px-3 py-2.5 text-left font-medium">EPF/ETF base</th>
                <th className="hidden px-5 py-2.5 text-left font-medium md:table-cell">How it's calculated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {components.map((c) => (
                <tr key={c.name}>
                  <td className="px-5 py-2.5 font-medium whitespace-nowrap">{c.name}</td>
                  <td className="px-3 py-2.5">
                    <Badge variant={c.kind === "Earning" ? "success" : "warning"}>{c.kind}</Badge>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{c.kind === "Earning" ? (c.taxable ? "Yes" : "No") : "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{c.kind === "Earning" ? (c.epf ? "Yes" : "No") : "—"}</td>
                  <td className="hidden px-5 py-2.5 text-muted-foreground md:table-cell">{c.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {editable && (
        <div className="sticky bottom-0 z-10 -mx-4 flex flex-col-reverse gap-2 border-t border-border bg-background/90 px-4 py-3 backdrop-blur sm:mx-0 sm:flex-row sm:items-center sm:justify-end sm:rounded-xl sm:border sm:px-5">
          {Object.keys(errors).length > 0 ? (
            <p className="mr-auto text-sm text-destructive">Please fix the highlighted fields.</p>
          ) : (
            <p className="mr-auto flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <Scale className="size-3.5" /> {formState.isDirty ? "You have unsaved changes." : "All changes saved."}
            </p>
          )}
          <Button type="button" variant="outline" disabled={!formState.isDirty || formState.isSubmitting} onClick={() => reset(toValues(settings))}>
            Reset
          </Button>
          <Button type="submit" loading={formState.isSubmitting}>
            Save settings
          </Button>
        </div>
      )}
    </form>
  );
}
