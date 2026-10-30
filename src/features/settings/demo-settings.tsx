"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArchiveRestore, Database, FlaskConical, HardDrive, RotateCcw, ShieldCheck } from "lucide-react";
import { useHRStore } from "@/store/hr-store";
import { useAuth } from "@/hooks/use-hr";
import { formatDateTime } from "@/lib/dates";
import { formatNumber, pluralize } from "@/lib/utils";
import { simulate } from "@/services/mock-api";
import { departments as seedDepartments, designations as seedDesignations } from "@/data/seed-data/catalog";
import { Alert, AlertDescription, AlertTitle, Avatar, Badge, Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, SectionCard } from "@/components/shared/common";

const seedEmployeeIds = new Set(Array.from({ length: 40 }, (_, i) => `EMP-${String(i + 1).padStart(4, "0")}`));
const seedDepartmentIds = new Set(seedDepartments.map((d) => d.id));
const seedDesignationIds = new Set(seedDesignations.map((d) => d.id));

export function DemoSettings() {
  const router = useRouter();
  const { user } = useAuth();
  const data = useHRStore((s) => s.data);
  const login = useHRStore((s) => s.login);
  const resetDemo = useHRStore((s) => s.resetDemo);
  const restoreEmployee = useHRStore((s) => s.restoreEmployee);
  const setDepartmentArchived = useHRStore((s) => s.setDepartmentArchived);
  const setDesignationArchived = useHRStore((s) => s.setDesignationArchived);
  const [confirmReset, setConfirmReset] = React.useState(false);
  const [restoring, setRestoring] = React.useState(false);
  const [storageKb, setStorageKb] = React.useState<number | null>(null);

  React.useEffect(() => {
    // Measure after the persist middleware has written the latest state.
    const t = setTimeout(() => {
      try {
        const raw = window.localStorage.getItem("technova-hrms") ?? "";
        setStorageKb(new Blob([raw]).size / 1024);
      } catch {
        setStorageKb(null);
      }
    }, 50);
    return () => clearTimeout(t);
  }, [data]);

  const archivedEmployees = data.employees.filter((e) => e.archived && seedEmployeeIds.has(e.id));
  const archivedDepartments = data.departments.filter((d) => d.archived && seedDepartmentIds.has(d.id));
  const archivedDesignations = data.designations.filter((d) => d.archived && seedDesignationIds.has(d.id));
  const restorable = archivedEmployees.length + archivedDepartments.length + archivedDesignations.length;

  const restoreSamples = async () => {
    if (!restorable) {
      toast.info("Nothing to restore", { description: "All sample employees, departments and designations are already active." });
      return;
    }
    setRestoring(true);
    const counts = { e: archivedEmployees.length, d: archivedDepartments.length, x: archivedDesignations.length };
    await simulate(() => {
      archivedDepartments.forEach((d) => setDepartmentArchived(d.id, false));
      archivedDesignations.forEach((d) => setDesignationArchived(d.id, false));
      archivedEmployees.forEach((e) => restoreEmployee(e.id));
    });
    setRestoring(false);
    toast.success(`Restored ${pluralize(restorable, "sample record")}`, {
      description: [pluralize(counts.e, "employee"), pluralize(counts.d, "department"), pluralize(counts.x, "designation")].join(" · "),
    });
  };

  const stats = [
    { label: "Employees", value: formatNumber(data.employees.length), testId: "stat-employees" },
    { label: "Attendance records", value: formatNumber(data.attendance.length), testId: "stat-attendance" },
    { label: "Leave requests", value: formatNumber(data.leaveRequests.length), testId: "stat-leave" },
    { label: "Payroll runs", value: formatNumber(data.payrollRuns.length), testId: "stat-payroll" },
    { label: "Storage used", value: storageKb == null ? "—" : `${storageKb.toFixed(1)} KB`, testId: "stat-storage" },
  ];

  return (
    <div className="space-y-6">
      <Alert variant="info">
        <FlaskConical />
        <div>
          <AlertTitle>This is a demo workspace</AlertTitle>
          <AlertDescription>
            Everything you see is sample data for TechNova Solutions, stored only in this browser. Changes you make persist across reloads until you reset the demo. No real
            emails, payments or payslips are sent.
          </AlertDescription>
        </div>
      </Alert>

      <SectionCard title="Switch demo role" description="Explore the product as each persona. You'll land on their dashboard with role-specific navigation and permissions.">
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {data.demoUsers.map((u) => {
            const e = data.employees.find((x) => x.id === u.employeeId);
            const name = e ? `${e.firstName} ${e.lastName}` : u.email;
            const current = u.id === user.id;
            return (
              <li key={u.id}>
                <Card className={`flex h-full flex-col p-4 ${current ? "border-primary/50 bg-primary-soft/40" : ""}`}>
                  <div className="flex items-center gap-3">
                    <Avatar name={name} src={e?.avatar} seed={e?.id} className="size-9 text-xs" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{u.roleLabel}</p>
                      <p className="truncate text-xs text-muted-foreground">{name}</p>
                    </div>
                  </div>
                  <p className="mt-3 flex-1 text-xs leading-relaxed text-muted-foreground">{u.description}</p>
                  {current ? (
                    <Badge variant="default" className="mt-4 self-start">
                      <ShieldCheck /> Current role
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-4"
                      aria-label={`Switch to ${u.roleLabel}`}
                      onClick={() => {
                        login(u.id);
                        router.push("/dashboard");
                        toast.success(`Switched to ${u.roleLabel}`, { description: `You're now viewing as ${name}.` });
                      }}
                    >
                      Switch to {u.roleLabel}
                    </Button>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-5">
        <SectionCard title="Demo data" description={`Seeded ${formatDateTime(data.seededAt)}`} className="lg:col-span-3" action={<Database className="size-4 text-muted-foreground" />}>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {stats.map((s) => (
              <div key={s.label} className="rounded-lg border border-border bg-subtle p-3" data-testid={s.testId}>
                <dt className="text-xs text-muted-foreground">{s.label}</dt>
                <dd className="mt-1 text-lg font-semibold tabular">{s.value}</dd>
              </div>
            ))}
            <div className="rounded-lg border border-border bg-subtle p-3" data-testid="stat-seeded">
              <dt className="text-xs text-muted-foreground">Data seeded</dt>
              <dd className="mt-1 text-sm font-semibold tabular">{formatDateTime(data.seededAt)}</dd>
            </div>
          </dl>
          <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
            <HardDrive className="size-3.5" /> Stored in this browser under the key <code className="rounded bg-muted px-1 font-mono">technova-hrms</code>.
          </p>
        </SectionCard>

        <SectionCard title="Maintenance" description="Recover sample records or start over." className="lg:col-span-2">
          <div className="space-y-4">
            <div className="rounded-lg border border-border p-4">
              <p className="text-sm font-medium">Restore sample records</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Brings back archived sample employees, departments and designations.{" "}
                {restorable ? `${pluralize(restorable, "record")} can be restored.` : "Nothing is archived right now."}
              </p>
              <Button variant="outline" size="sm" className="mt-3" onClick={restoreSamples} loading={restoring}>
                <ArchiveRestore /> Restore sample records
              </Button>
            </div>
            <div className="rounded-lg border border-destructive/30 bg-destructive-soft/40 p-4">
              <p className="text-sm font-medium">Reset demo data</p>
              <p className="mt-1 text-xs text-muted-foreground">Discards every change and reseeds fresh sample data. You stay signed in as your current role.</p>
              <Button variant="destructive" size="sm" className="mt-3" onClick={() => setConfirmReset(true)}>
                <RotateCcw /> Reset demo data
              </Button>
            </div>
          </div>
        </SectionCard>
      </div>

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        tone="destructive"
        icon={RotateCcw}
        title="Reset demo data?"
        description="All employees, attendance, leave, payroll, reviews and settings return to the original sample data. Your changes, chats and notification preferences will be lost."
        confirmLabel="Reset data"
        onConfirm={async () => {
          await simulate(() => resetDemo(), 500);
          toast.success("Demo data reset", { description: "Fresh sample data has been loaded." });
        }}
      />
    </div>
  );
}
