"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileCheck2,
  History,
  Loader2,
  PartyPopper,
  PlayCircle,
  Receipt,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { useHRStore } from "@/store/hr-store";
import { useAuth, useLookups } from "@/hooks/use-hr";
import { can } from "@/lib/permissions";
import { eligibleEmployees, generatePayrollItems, periodBounds, runTotals } from "@/lib/payroll";
import { formatDate, formatDateTime, periodLabel, workingDaysInPeriod } from "@/lib/dates";
import { formatMoney, pluralize } from "@/lib/utils";
import { simulate } from "@/services/mock-api";
import type { PayrollItem, PayrollRun } from "@/types";
import { Alert, AlertDescription, AlertTitle, Card, Skeleton } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/overlays";
import { Field } from "@/components/forms/fields";
import { ConfirmDialog, LoadingState, StatusBadge } from "@/components/shared/common";
import { PayrollPageFrame } from "@/features/payroll/payroll-shell";
import { PayrollStepper } from "@/features/payroll/payroll-stepper";
import { BreakdownDialog, PayrollItemsTable, RunTotalsStrip, WarningsPanel } from "@/features/payroll/run-components";
import { currentPeriod, periodOptions, usePayrollContext } from "@/features/payroll/payroll-utils";

export default function ProcessPayrollPage() {
  return (
    <React.Suspense fallback={<LoadingState />}>
      <ProcessPayroll />
    </React.Suspense>
  );
}

function ProcessPayroll() {
  const params = useSearchParams();
  const router = useRouter();
  const runs = useHRStore((s) => s.data.payrollRuns);
  const requested = params.get("period");
  const options = React.useMemo(() => {
    const base = periodOptions();
    if (requested && /^\d{4}-\d{2}$/.test(requested) && !base.includes(requested)) base.push(requested);
    return base.sort((a, b) => b.localeCompare(a));
  }, [requested]);
  const [period, setPeriod] = React.useState(() => (requested && /^\d{4}-\d{2}$/.test(requested) ? requested : currentPeriod()));
  const [selected, setSelected] = React.useState<PayrollItem | null>(null);
  const [justProcessed, setJustProcessed] = React.useState<string | null>(null);

  const run = runs.find((r) => r.period === period) ?? null;
  const status = run?.status ?? null;

  const changePeriod = (p: string) => {
    setPeriod(p);
    setJustProcessed(null);
    router.replace(`/payroll/process?period=${p}`, { scroll: false });
  };

  return (
    <PayrollPageFrame title="Process Payroll" description="Generate, review, approve and process the monthly payroll run.">
      <div className="space-y-6">
        <Card className="p-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:gap-8">
            <div className="flex items-end gap-3 lg:w-80 lg:shrink-0">
              <Field label="Payroll period" htmlFor="payroll-period" className="flex-1">
                <Select value={period} onValueChange={changePeriod}>
                  <SelectTrigger id="payroll-period">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((p) => {
                      const r = runs.find((x) => x.period === p);
                      return (
                        <SelectItem key={p} value={p}>
                          {periodLabel(p)}
                          {p === currentPeriod() ? " (current)" : r ? ` · ${r.status}` : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </Field>
              <div className="pb-1.5" data-testid="payroll-status">
                <StatusBadge status={status ?? "Not started"} />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <PayrollStepper status={status} />
            </div>
          </div>
        </Card>

        {!run ? (
          <GenerateStep period={period} />
        ) : justProcessed === run.id && run.status === "Processed" ? (
          <ProcessedSuccess run={run} />
        ) : (
          <RunStep run={run} onSelect={setSelected} onProcessed={() => setJustProcessed(run.id)} />
        )}
      </div>
      <BreakdownDialog item={selected} period={period} onOpenChange={(o) => !o && setSelected(null)} />
    </PayrollPageFrame>
  );
}

// ---------------- Step 1: generate ----------------
function GenerateStep({ period }: { period: string }) {
  const employees = useHRStore((s) => s.data.employees);
  const salaries = useHRStore((s) => s.data.salaries);
  const payDay = useHRStore((s) => s.data.payrollSettings.payDay);
  const generatePayroll = useHRStore((s) => s.generatePayroll);
  const { role } = useAuth();
  const ctx = usePayrollContext(period);
  const [busy, setBusy] = React.useState(false);

  const summary = React.useMemo(() => {
    const eligible = eligibleEmployees(employees, period);
    const { start } = periodBounds(period);
    const items = generatePayrollItems(employees, salaries, ctx);
    return {
      eligible: eligible.length,
      missing: eligible.filter((e) => !salaries.some((s) => s.employeeId === e.id && s.basic > 0)).length,
      joiners: eligible.filter((e) => e.joinDate > start).length,
      unpaid: items.filter((i) => i.unpaidLeaveDays > 0).length,
      workingDays: workingDaysInPeriod(period, ctx.leaveSettings, ctx.holidays).length,
      estimatedNet: runTotals(items).net,
    };
  }, [employees, salaries, ctx, period]);
  const payDate = `${period}-${String(payDay).padStart(2, "0")}`;

  const generate = async () => {
    setBusy(true);
    try {
      await simulate(() => generatePayroll(period), 1100);
      toast.success("Draft payroll generated", { description: `${periodLabel(period)} · ${pluralize(summary.eligible, "employee")} calculated. Review the draft before submitting.` });
    } finally {
      setBusy(false);
    }
  };

  if (busy) {
    return (
      <Card className="p-6" aria-live="polite">
        <div className="flex items-center gap-3">
          <Loader2 className="size-5 animate-spin text-primary" />
          <div>
            <p className="text-sm font-semibold">Calculating payroll for {periodLabel(period)}…</p>
            <p className="text-[13px] text-muted-foreground">Applying salary structures, unpaid leave, overtime, EPF/ETF and APIT for {pluralize(summary.eligible, "employee")}.</p>
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
        <Skeleton className="mt-4 h-48 rounded-lg" />
      </Card>
    );
  }

  const facts = [
    { icon: Users, label: "Eligible employees", value: String(summary.eligible) },
    { icon: CalendarDays, label: "Working days", value: String(summary.workingDays) },
    { icon: Clock, label: "Pay date", value: formatDate(payDate, "d MMM yyyy") },
    { icon: UserPlus, label: "Mid-period joiners", value: String(summary.joiners) },
    { icon: Wallet, label: "Estimated net", value: formatMoney(summary.estimatedNet) },
    { icon: FileCheck2, label: "Missing salary structures", value: String(summary.missing), warn: summary.missing > 0 },
  ];

  return (
    <Card className="overflow-hidden">
      <div className="grid gap-0 lg:grid-cols-[1fr_360px]">
        <div className="p-6">
          <span className="inline-flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
            <PlayCircle className="size-5" />
          </span>
          <h2 className="mt-4 text-lg font-semibold tracking-tight">Start {periodLabel(period)} payroll</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            No payroll run exists for this period yet. Generating creates a <span className="font-medium text-foreground">Draft</span> from current salary structures, approved unpaid leave and attendance. Nothing is paid until the run is approved and processed.
          </p>
          <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {facts.map((f) => (
              <div key={f.label} className="rounded-lg border border-border bg-subtle p-3">
                <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <f.icon className="size-3.5" /> {f.label}
                </dt>
                <dd className={`mt-1 text-sm font-semibold break-words tabular ${f.warn ? "text-warning" : ""}`}>{f.value}</dd>
              </div>
            ))}
          </dl>
          {summary.unpaid > 0 && (
            <p className="mt-4 text-[13px] text-muted-foreground">
              {pluralize(summary.unpaid, "employee")} {summary.unpaid === 1 ? "has" : "have"} approved unpaid leave in this period — it will be deducted from basic pay.
            </p>
          )}
        </div>
        <div className="flex flex-col justify-center gap-3 border-t border-border bg-subtle p-6 lg:border-t-0 lg:border-l">
          <p className="text-sm font-medium">Ready to calculate?</p>
          <p className="text-[13px] text-muted-foreground">You can recalculate or discard the draft at any time before it's submitted for approval.</p>
          {can(role, "payroll.process") ? (
            <Button size="lg" onClick={generate} className="mt-2">
              <PlayCircle /> Generate payroll
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">Your role can view payroll but not generate runs.</p>
          )}
          <Button asChild variant="ghost" size="sm">
            <Link href="/payroll/salary-structures">Review salary structures first</Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ---------------- Steps 2–4 ----------------
function RunStep({ run, onSelect, onProcessed }: { run: PayrollRun; onSelect: (i: PayrollItem) => void; onProcessed: () => void }) {
  const lookups = useLookups();
  const { role } = useAuth();
  const canProcess = can(role, "payroll.process");
  const generatePayroll = useHRStore((s) => s.generatePayroll);
  const submitPayroll = useHRStore((s) => s.submitPayroll);
  const approvePayroll = useHRStore((s) => s.approvePayroll);
  const processPayroll = useHRStore((s) => s.processPayroll);
  const discardPayroll = useHRStore((s) => s.discardPayroll);
  const [busy, setBusy] = React.useState<null | "recalc" | "submit">(null);
  const [confirm, setConfirm] = React.useState<null | "discard" | "approve" | "process">(null);
  const label = periodLabel(run.period);
  const totals = runTotals(run.items);

  const recalc = async () => {
    setBusy("recalc");
    try {
      await simulate(() => generatePayroll(run.period), 700);
      toast.success("Payroll recalculated", { description: `${label} draft refreshed with the latest salary, leave and attendance data.` });
    } finally {
      setBusy(null);
    }
  };
  const submit = async () => {
    setBusy("submit");
    try {
      await simulate(() => submitPayroll(run.id));
      toast.success("Submitted for approval", { description: `${label} payroll (${formatMoney(totals.net)} net) is awaiting approval.` });
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      {run.status === "Draft" && (
        <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Review the draft</p>
            <p className="text-[13px] text-muted-foreground">
              Generated {formatDateTime(run.createdAt)} by {lookups.name(run.createdBy)}. Check totals and warnings, then submit for approval.
            </p>
          </div>
          {canProcess && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="ghost" className="text-destructive hover:bg-destructive-soft" onClick={() => setConfirm("discard")} disabled={!!busy}>
                <Trash2 /> Discard draft
              </Button>
              <Button variant="outline" onClick={recalc} loading={busy === "recalc"} disabled={!!busy}>
                {busy !== "recalc" && <RefreshCw />} Recalculate
              </Button>
              <Button onClick={submit} loading={busy === "submit"} disabled={!!busy}>
                {busy !== "submit" && <Send />} Submit for approval
              </Button>
            </div>
          )}
        </Card>
      )}

      {run.status === "Pending Approval" && (
        <Alert variant="warning" className="flex-col gap-3 sm:flex-row sm:items-center">
          <ShieldCheck />
          <div className="min-w-0 flex-1">
            <AlertTitle>Awaiting approval</AlertTitle>
            <AlertDescription>
              Submitted {formatDateTime(run.submittedAt)} · {pluralize(totals.employees, "employee")} · {formatMoney(totals.net)} net. In this demo both Admin and Payroll Manager may approve.
            </AlertDescription>
          </div>
          {canProcess && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="ghost" className="text-destructive hover:bg-destructive-soft" onClick={() => setConfirm("discard")}>
                <Trash2 /> Discard run
              </Button>
              <Button onClick={() => setConfirm("approve")}>
                <BadgeCheck /> Approve payroll
              </Button>
            </div>
          )}
        </Alert>
      )}

      {run.status === "Approved" && (
        <Alert variant="success" className="flex-col gap-3 sm:flex-row sm:items-center">
          <BadgeCheck />
          <div className="min-w-0 flex-1">
            <AlertTitle>Approved and ready to process</AlertTitle>
            <AlertDescription>
              Approved {formatDateTime(run.approvedAt)} by {lookups.name(run.approvedBy)}. Processing publishes {pluralize(totals.employees, "payslip")} and notifies employees.
            </AlertDescription>
          </div>
          {canProcess && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="ghost" className="text-destructive hover:bg-destructive-soft" onClick={() => setConfirm("discard")}>
                <Trash2 /> Discard run
              </Button>
              <Button onClick={() => setConfirm("process")}>
                <PlayCircle /> Process payroll
              </Button>
            </div>
          )}
        </Alert>
      )}

      {run.status === "Processed" && (
        <Alert variant="success" className="flex-col gap-3 sm:flex-row sm:items-center" data-testid="payroll-processed-alert">
          <CheckCircle2 />
          <div className="min-w-0 flex-1">
            <AlertTitle>This period has already been processed</AlertTitle>
            <AlertDescription>
              Processed {formatDateTime(run.processedAt)} by {lookups.name(run.processedBy)}. Payslips are published and the run is locked — it can't be processed again.
            </AlertDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline">
              <Link href="/payroll/history">
                <History /> View history
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/payroll/payslips?period=${run.period}`}>
                <Receipt /> View payslips
              </Link>
            </Button>
          </div>
        </Alert>
      )}

      <RunTotalsStrip items={run.items} />
      {run.status === "Draft" && <WarningsPanel items={run.items} onSelect={onSelect} />}
      <PayrollItemsTable items={run.items} onSelect={onSelect} title={run.status === "Processed" ? "Payroll register" : "Payroll preview"} />

      <ConfirmDialog
        open={confirm === "discard"}
        onOpenChange={(o) => !o && setConfirm(null)}
        tone="destructive"
        icon={Trash2}
        title={`Discard the ${label} ${run.status === "Draft" ? "draft" : "run"}?`}
        description="The calculated items for this period will be deleted. You can generate a fresh draft afterwards."
        confirmLabel={run.status === "Draft" ? "Discard draft" : "Discard run"}
        onConfirm={async () => {
          await simulate(() => discardPayroll(run.id));
          toast.success("Payroll discarded", { description: `The ${label} run was removed.` });
        }}
      />
      <ConfirmDialog
        open={confirm === "approve"}
        onOpenChange={(o) => !o && setConfirm(null)}
        icon={BadgeCheck}
        title={`Approve payroll for ${label}?`}
        description={
          <>
            You're approving {pluralize(totals.employees, "employee")} with a net payout of <span className="font-medium whitespace-nowrap text-foreground">{formatMoney(totals.net)}</span> (employer cost {formatMoney(totals.employerCost)}). After approval the run can be processed.
          </>
        }
        confirmLabel="Approve payroll"
        onConfirm={async () => {
          await simulate(() => approvePayroll(run.id));
          toast.success("Payroll approved", { description: `${label} payroll is approved and ready to process.` });
        }}
      />
      <ConfirmDialog
        open={confirm === "process"}
        onOpenChange={(o) => !o && setConfirm(null)}
        icon={PlayCircle}
        title={`Process payroll for ${label}?`}
        description={
          <>
            Payslips will be generated for {pluralize(totals.employees, "employee")} and each employee will be notified. Net payout: <span className="font-medium whitespace-nowrap text-foreground">{formatMoney(totals.net)}</span>. This action can't be undone.
          </>
        }
        confirmLabel="Process payroll"
        onConfirm={async () => {
          await simulate(() => {
            processPayroll(run.id);
            onProcessed();
          }, 900);
          toast.success("Payroll processed", { description: `${totals.employees} payslips generated for ${label}.` });
        }}
      />
    </>
  );
}

function ProcessedSuccess({ run }: { run: PayrollRun }) {
  const totals = runTotals(run.items);
  return (
    <>
      <Card className="overflow-hidden" data-testid="payroll-success">
        <div className="flex flex-col items-center px-6 py-10 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-success-soft text-success-soft-foreground">
            <PartyPopper className="size-7" />
          </span>
          <h2 className="mt-4 text-xl font-semibold tracking-tight">{periodLabel(run.period)} payroll processed</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {pluralize(totals.employees, "payslip")} were generated and employees have been notified. Pay date: {formatDate(run.payDate)}.
          </p>
          <dl className="mt-6 grid w-full max-w-lg grid-cols-3 gap-3">
            {[
              ["Employees", String(totals.employees)],
              ["Gross", formatMoney(totals.gross)],
              ["Net paid", formatMoney(totals.net)],
            ].map(([l, v]) => (
              <div key={l} className="rounded-lg bg-subtle p-3">
                <dt className="text-xs text-muted-foreground">{l}</dt>
                <dd className="mt-0.5 truncate text-sm font-semibold tabular">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline">
              <Link href="/payroll/history">
                <History /> Payroll history
              </Link>
            </Button>
            <Button asChild size="lg">
              <Link href={`/payroll/payslips?period=${run.period}`}>
                <Receipt /> View payslips
              </Link>
            </Button>
          </div>
        </div>
      </Card>
    </>
  );
}
