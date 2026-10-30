"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import {
  Archive,
  ArchiveRestore,
  Briefcase,
  Building2,
  CalendarDays,
  Cake,
  Clock,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Receipt,
  Star,
  UserRound,
  Users,
} from "lucide-react";
import { useHRStore } from "@/store/hr-store";
import { useLookups, useSession } from "@/hooks/use-hr";
import { can } from "@/lib/permissions";
import { differenceInCalendarDays, formatDate, formatTime, fromDateKey, minutesToHours, periodLabel, workedMinutes } from "@/lib/dates";
import { leaveBalances } from "@/lib/leave";
import { formatMoney } from "@/lib/utils";
import { simulate } from "@/services/mock-api";
import type { AttendanceRecord, LeaveRequest } from "@/types";
import { Avatar, Badge, Card, Input, Progress, Textarea } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/overlays";
import { Field, FileUpload, readImageAsDataUrl } from "@/components/forms/fields";
import { DataTable } from "@/components/tables/data-table";
import { AccessDenied, ConfirmDialog, EmptyState, FadeIn, InfoGrid, PersonCell, SectionCard, StatusBadge, Timeline } from "@/components/shared/common";
import { RatingStars } from "@/features/employees/rating-stars";

export function EmployeeNotFound() {
  return (
    <Card>
      <EmptyState
        icon={UserRound}
        title="Employee not found"
        description="This employee record doesn't exist. It may have been removed when the demo data was reset."
        action={
          <Button asChild variant="outline">
            <Link href="/employees">Back to employees</Link>
          </Button>
        }
      />
    </Card>
  );
}

function tenure(joinDate: string) {
  const days = differenceInCalendarDays(new Date(), fromDateKey(joinDate));
  if (days < 0) return "Starts soon";
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  if (years === 0 && months === 0) return `${days} days`;
  return [years ? `${years} yr` : "", months ? `${months} mo` : ""].filter(Boolean).join(" ");
}

export function EmployeeProfileView({ employeeId, self = false }: { employeeId: string; self?: boolean }) {
  const router = useRouter();
  const { role, employee: me } = useSession();
  const data = useHRStore((s) => s.data);
  const archiveEmployee = useHRStore((s) => s.archiveEmployee);
  const restoreEmployee = useHRStore((s) => s.restoreEmployee);
  const lookups = useLookups();
  const [confirmArchive, setConfirmArchive] = React.useState(false);
  const [editContact, setEditContact] = React.useState(false);

  const employee = data.employees.find((e) => e.id === employeeId);
  if (!employee) return <EmployeeNotFound />;

  const isSelf = self || me?.id === employee.id;
  const allowed =
    isSelf || can(role ?? undefined, "employees.view") && (role !== "team_lead" || employee.managerId === me?.id);
  if (!allowed) return <AccessDenied />;

  const canManage = can(role ?? undefined, "employees.manage") && !isSelf;
  const canSeePay = isSelf || can(role ?? undefined, "salary.view");
  const name = `${employee.firstName} ${employee.lastName}`;
  const manager = lookups.employee(employee.managerId);
  const reports = data.employees.filter((e) => e.managerId === employee.id && !e.archived);
  const year = new Date().getFullYear();

  return (
    <FadeIn>
      {/* Header */}
      <Card className="mb-6 overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-primary/15 via-primary/5 to-transparent sm:h-24" aria-hidden />
        <div className="flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
          <div className="-mt-10 flex flex-col gap-4 sm:flex-row sm:items-end">
            <Avatar name={name} src={employee.avatar} seed={employee.id} className="size-20 border-4 border-surface text-xl shadow-sm" />
            <div className="min-w-0 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{name}</h1>
                <StatusBadge status={employee.archived ? "Archived" : employee.status} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {lookups.desName(employee.designationId)} · {lookups.deptName(employee.departmentId)} · <span className="font-mono text-xs">{employee.id}</span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {isSelf && (
              <Button variant="outline" onClick={() => setEditContact(true)}>
                <Pencil /> Update contact details
              </Button>
            )}
            {canManage && !employee.archived && (
              <>
                <Button variant="outline" onClick={() => setConfirmArchive(true)}>
                  <Archive /> Archive
                </Button>
                <Button asChild>
                  <Link href={`/employees/${employee.id}/edit`}>
                    <Pencil /> Edit employee
                  </Link>
                </Button>
              </>
            )}
            {canManage && employee.archived && (
              <Button
                onClick={async () => {
                  await simulate(() => restoreEmployee(employee.id));
                  toast.success("Employee restored");
                }}
              >
                <ArchiveRestore /> Restore employee
              </Button>
            )}
          </div>
        </div>
        <div className="grid gap-px border-t border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Mail, label: "Email", value: employee.email },
            { icon: Phone, label: "Phone", value: employee.phone },
            { icon: Users, label: "Reports to", value: manager ? `${manager.firstName} ${manager.lastName}` : "—" },
            { icon: CalendarDays, label: "Joined", value: `${formatDate(employee.joinDate)} · ${tenure(employee.joinDate)}` },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex min-w-0 items-center gap-3 bg-surface px-5 py-3.5">
              <Icon className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="truncate text-sm font-medium">{value}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList aria-label="Profile sections">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="employment">Employment</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="leave">Leave</TabsTrigger>
          {canSeePay && <TabsTrigger value="payroll">Payroll</TabsTrigger>}
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-6 lg:grid-cols-3">
            <SectionCard title="Personal details" className="lg:col-span-2">
              <InfoGrid
                items={[
                  { label: "Full name", value: name },
                  { label: "Gender", value: employee.gender },
                  { label: "Date of birth", value: formatDate(employee.dateOfBirth) },
                  { label: "Phone", value: employee.phone },
                  { label: "Email", value: employee.email },
                  { label: "Address", value: employee.address },
                ]}
              />
              <div className="mt-6 rounded-lg border border-border bg-subtle p-4">
                <p className="mb-3 text-sm font-medium">Emergency contact</p>
                <InfoGrid
                  columns={3}
                  items={[
                    { label: "Name", value: employee.emergencyContact.name },
                    { label: "Relationship", value: employee.emergencyContact.relationship },
                    { label: "Phone", value: employee.emergencyContact.phone },
                  ]}
                />
              </div>
            </SectionCard>
            <div className="space-y-6">
              <SectionCard title="Skills">
                {employee.skills.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {employee.skills.map((s) => (
                      <Badge key={s} variant="outline" className="py-1">
                        {s}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No skills recorded.</p>
                )}
              </SectionCard>
              <SectionCard title={`Direct reports (${reports.length})`}>
                {reports.length ? (
                  <ul className="space-y-3">
                    {reports.slice(0, 6).map((r) => (
                      <li key={r.id}>
                        <PersonCell size="sm" name={`${r.firstName} ${r.lastName}`} sub={lookups.desName(r.designationId)} src={r.avatar} seed={r.id} href={can(role ?? undefined, "employees.view") ? `/employees/${r.id}` : undefined} />
                      </li>
                    ))}
                    {reports.length > 6 && <li className="text-xs text-muted-foreground">+{reports.length - 6} more</li>}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No direct reports.</p>
                )}
              </SectionCard>
              {employee.notes && canManage && (
                <SectionCard title="HR notes">
                  <p className="text-sm whitespace-pre-line text-muted-foreground">{employee.notes}</p>
                </SectionCard>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="employment">
          <div className="grid gap-6 lg:grid-cols-3">
            <SectionCard title="Employment details" className="lg:col-span-2">
              <InfoGrid
                columns={3}
                items={[
                  { label: "Employee ID", value: <span className="font-mono">{employee.id}</span> },
                  { label: "Department", value: lookups.deptName(employee.departmentId) },
                  { label: "Designation", value: lookups.desName(employee.designationId) },
                  { label: "Level", value: lookups.designation(employee.designationId)?.level },
                  { label: "Reporting manager", value: manager ? `${manager.firstName} ${manager.lastName}` : "—" },
                  { label: "Employment type", value: employee.employmentType },
                  { label: "Status", value: <StatusBadge status={employee.archived ? "Archived" : employee.status} /> },
                  { label: "Joining date", value: formatDate(employee.joinDate) },
                  { label: "Tenure", value: tenure(employee.joinDate) },
                ]}
              />
            </SectionCard>
            <SectionCard title="Timeline">
              <Timeline
                items={[
                  ...(employee.archivedAt ? [{ id: "arch", icon: Archive, title: "Archived", meta: formatDate(employee.archivedAt), tone: "danger" as const }] : []),
                  ...(employee.status === "Probation" ? [{ id: "prob", icon: Clock, title: "Probation period in progress", meta: "Review due 6 months after joining", tone: "info" as const }] : []),
                  { id: "role", icon: Briefcase, title: `${lookups.desName(employee.designationId)}`, meta: lookups.deptName(employee.departmentId), tone: "primary" },
                  { id: "join", icon: Building2, title: `Joined TechNova Solutions`, meta: formatDate(employee.joinDate), tone: "success" },
                  { id: "dob", icon: Cake, title: "Birthday", meta: formatDate(employee.dateOfBirth, "d MMMM"), tone: "warning" },
                ]}
              />
            </SectionCard>
          </div>
        </TabsContent>

        <TabsContent value="attendance">
          <AttendanceTab records={data.attendance.filter((a) => a.employeeId === employee.id)} />
        </TabsContent>

        <TabsContent value="leave">
          <LeaveTab
            balances={leaveBalances(employee.id, data.leaveTypes, data.leaveRequests, year)}
            requests={data.leaveRequests.filter((l) => l.employeeId === employee.id)}
            typeName={(id) => data.leaveTypes.find((t) => t.id === id)?.name ?? id}
          />
        </TabsContent>

        {canSeePay && (
          <TabsContent value="payroll">
            <PayrollTab employeeId={employee.id} />
          </TabsContent>
        )}

        <TabsContent value="performance">
          <PerformanceTab employeeId={employee.id} />
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        tone="destructive"
        icon={Archive}
        title={`Archive ${name}?`}
        description="Archived employees are hidden from the directory and excluded from future payroll runs. Their history is preserved and they can be restored."
        confirmLabel="Archive employee"
        onConfirm={async () => {
          await simulate(() => archiveEmployee(employee.id));
          toast.success("Employee archived");
          router.push("/employees");
        }}
      />
      {isSelf && <ContactDialog open={editContact} onOpenChange={setEditContact} employeeId={employee.id} />}
    </FadeIn>
  );
}

function ContactDialog({ open, onOpenChange, employeeId }: { open: boolean; onOpenChange: (o: boolean) => void; employeeId: string }) {
  const employee = useHRStore((s) => s.data.employees.find((e) => e.id === employeeId))!;
  const update = useHRStore((s) => s.updateEmployee);
  const [phone, setPhone] = React.useState(employee.phone);
  const [address, setAddress] = React.useState(employee.address);
  const [ecName, setEcName] = React.useState(employee.emergencyContact.name);
  const [ecRel, setEcRel] = React.useState(employee.emergencyContact.relationship);
  const [ecPhone, setEcPhone] = React.useState(employee.emergencyContact.phone);
  const [avatar, setAvatar] = React.useState<string | null>(employee.avatar);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (open) {
      setPhone(employee.phone);
      setAddress(employee.address);
      setEcName(employee.emergencyContact.name);
      setEcRel(employee.emergencyContact.relationship);
      setEcPhone(employee.emergencyContact.phone);
      setAvatar(employee.avatar);
      setError(null);
    }
  }, [open, employee]);
  const save = async () => {
    if (!/^\+?[0-9 ()-]{9,17}$/.test(phone) || !/^\+?[0-9 ()-]{9,17}$/.test(ecPhone)) return setError("Enter valid phone numbers, e.g. +94 77 123 4567.");
    if (address.trim().length < 5 || ecName.trim().length < 2) return setError("Address and emergency contact name are required.");
    setBusy(true);
    await simulate(() => update(employeeId, { phone, address, avatar, emergencyContact: { name: ecName, relationship: ecRel, phone: ecPhone } }));
    setBusy(false);
    onOpenChange(false);
    toast.success("Contact details updated");
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update contact details</DialogTitle>
          <DialogDescription>Keep your phone, address and emergency contact up to date.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {error && <p className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive-soft-foreground" role="alert">{error}</p>}
          <div className="flex items-center gap-4">
            <Avatar name={`${employee.firstName} ${employee.lastName}`} src={avatar} seed={employee.id} className="size-14" />
            <div className="flex-1">
              <FileUpload id="selfAvatar" accept="image/png,image/jpeg" label="Change photo" hint="PNG or JPG" onFile={async (f) => setAvatar(await readImageAsDataUrl(f))} />
            </div>
          </div>
          <Field label="Phone" htmlFor="selfPhone" required>
            <Input id="selfPhone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label="Address" htmlFor="selfAddress" required>
            <Textarea id="selfAddress" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Emergency contact" htmlFor="selfEcName" required>
              <Input id="selfEcName" value={ecName} onChange={(e) => setEcName(e.target.value)} />
            </Field>
            <Field label="Relationship" htmlFor="selfEcRel">
              <Input id="selfEcRel" value={ecRel} onChange={(e) => setEcRel(e.target.value)} />
            </Field>
            <Field label="Contact phone" htmlFor="selfEcPhone" required>
              <Input id="selfEcPhone" value={ecPhone} onChange={(e) => setEcPhone(e.target.value)} />
            </Field>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            Save details
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AttendanceTab({ records }: { records: AttendanceRecord[] }) {
  const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date));
  const count = (s: string) => records.filter((r) => r.status === s).length;
  const worked = records.map((r) => workedMinutes(r.clockIn, r.clockOut)).filter((m) => m > 0);
  const avg = worked.length ? worked.reduce((a, b) => a + b, 0) / worked.length : 0;
  const columns: ColumnDef<AttendanceRecord, unknown>[] = [
    { accessorKey: "date", header: "Date", cell: ({ getValue }) => <span className="tabular">{formatDate(getValue() as string, "EEE, d MMM yyyy")}</span> },
    { accessorKey: "clockIn", header: "Clock in", cell: ({ getValue }) => <span className="tabular">{formatTime(getValue() as string | null)}</span> },
    { accessorKey: "clockOut", header: "Clock out", cell: ({ getValue }) => <span className="tabular">{formatTime(getValue() as string | null)}</span> },
    { id: "hours", header: "Worked", accessorFn: (r) => workedMinutes(r.clockIn, r.clockOut), cell: ({ getValue }) => <span className="tabular">{(getValue() as number) ? minutesToHours(getValue() as number) : "—"}</span>, meta: { className: "hidden sm:table-cell" } },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusBadge status={getValue() as string} /> },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[
          { label: "Present", value: count("Present"), tone: "text-success" },
          { label: "Late", value: count("Late"), tone: "text-warning" },
          { label: "Absent", value: count("Absent"), tone: "text-destructive" },
          { label: "On leave", value: count("On Leave") + count("Half Day"), tone: "text-info" },
          { label: "Avg. hours / day", value: avg ? minutesToHours(avg) : "—", tone: "text-foreground" },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`mt-1 text-xl font-semibold tabular ${s.tone}`}>{s.value}</p>
          </Card>
        ))}
      </div>
      <Card>
        <DataTable label="Attendance history" columns={columns} data={sorted} emptyTitle="No attendance records" emptyDescription="Attendance will appear here once the employee clocks in." />
      </Card>
    </div>
  );
}

function LeaveTab({ balances, requests, typeName }: { balances: ReturnType<typeof leaveBalances>; requests: LeaveRequest[]; typeName: (id: string) => string }) {
  const columns: ColumnDef<LeaveRequest, unknown>[] = [
    { accessorKey: "id", header: "Request", cell: ({ getValue }) => <span className="font-mono text-xs">{getValue() as string}</span> },
    { id: "type", header: "Type", accessorFn: (r) => typeName(r.typeId) },
    { id: "dates", header: "Dates", accessorFn: (r) => r.startDate, cell: ({ row }) => <span className="tabular">{row.original.startDate === row.original.endDate ? formatDate(row.original.startDate) : `${formatDate(row.original.startDate, "d MMM")} – ${formatDate(row.original.endDate)}`}</span> },
    { accessorKey: "days", header: "Days", meta: { align: "right" } },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusBadge status={getValue() as string} /> },
  ];
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {balances.map((b) => (
          <Card key={b.type.id} className="p-4">
            <p className="text-xs text-muted-foreground">{b.type.name}</p>
            <p className="mt-1 text-xl font-semibold tabular">{b.available === Infinity ? "No limit" : `${b.available} days`}</p>
            {b.allocation > 0 && <Progress value={((b.used + b.pending) / b.allocation) * 100} className="mt-3" />}
            <p className="mt-2 text-xs text-muted-foreground tabular">
              {b.used} used · {b.pending} pending{b.allocation ? ` · ${b.allocation} allocated` : ""}
            </p>
          </Card>
        ))}
      </div>
      <Card>
        <DataTable label="Leave history" columns={columns} data={[...requests].sort((a, b) => b.startDate.localeCompare(a.startDate))} emptyTitle="No leave requests" emptyDescription="Leave applications will appear here." />
      </Card>
    </div>
  );
}

function PayrollTab({ employeeId }: { employeeId: string }) {
  const salary = useHRStore((s) => s.data.salaries.find((x) => x.employeeId === employeeId));
  const runs = useHRStore((s) => s.data.payrollRuns);
  const slips = runs
    .filter((r) => r.status === "Processed")
    .map((r) => ({ run: r, item: r.items.find((i) => i.employeeId === employeeId) }))
    .filter((x) => x.item)
    .sort((a, b) => b.run.period.localeCompare(a.run.period));
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <SectionCard title="Salary structure" description="Current monthly components" className="lg:col-span-1">
        {salary ? (
          <dl className="space-y-2.5 text-sm">
            {[
              ["Basic salary", salary.basic],
              ["Transport allowance", salary.transportAllowance],
              ["Meal allowance", salary.mealAllowance],
              ["Other allowances", salary.otherAllowance],
              ["Loan deduction", -salary.loanDeduction],
              ["Other deductions", -salary.otherDeduction],
            ].map(([label, v]) => (
              <div key={label as string} className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className={`tabular ${(v as number) < 0 ? "text-destructive" : ""}`}>{formatMoney(v as number, salary.currency)}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-4 border-t border-border pt-2.5 font-medium">
              <dt>Fixed gross</dt>
              <dd className="tabular">{formatMoney(salary.basic + salary.transportAllowance + salary.mealAllowance + salary.otherAllowance, salary.currency)}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">No salary structure assigned.</p>
        )}
      </SectionCard>
      <SectionCard title="Payslips" description="Generated from processed payroll runs" className="lg:col-span-2" bodyClassName="px-0 pb-0">
        {slips.length ? (
          <ul className="divide-y divide-border border-t border-border">
            {slips.map(({ run, item }) => (
              <li key={run.id}>
                <Link href={`/payroll/payslips/PS-${run.period}-${employeeId}`} className="flex items-center gap-4 px-5 py-3 hover:bg-subtle">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
                    <Receipt className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{periodLabel(run.period)}</span>
                    <span className="block text-xs text-muted-foreground">Paid {formatDate(run.payDate)}</span>
                  </span>
                  <span className="text-right">
                    <span className="block text-sm font-semibold tabular">{formatMoney(item!.net)}</span>
                    <span className="block text-xs text-muted-foreground">Net pay</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={Receipt} title="No payslips yet" description="Payslips appear after a payroll run is processed." />
        )}
      </SectionCard>
    </div>
  );
}

function PerformanceTab({ employeeId }: { employeeId: string }) {
  const allEvaluations = useHRStore((s) => s.data.evaluations);
  const allGoals = useHRStore((s) => s.data.goals);
  const evaluations = React.useMemo(() => allEvaluations.filter((e) => e.employeeId === employeeId), [allEvaluations, employeeId]);
  const goals = React.useMemo(() => allGoals.filter((g) => g.employeeId === employeeId), [allGoals, employeeId]);
  const lookups = useLookups();
  const sorted = [...evaluations].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <SectionCard title="Evaluations" className="lg:col-span-2" bodyClassName="px-0 pb-0">
        {sorted.length ? (
          <ul className="divide-y divide-border border-t border-border">
            {sorted.map((ev) => (
              <li key={ev.id}>
                <Link href={`/performance/${ev.id}`} className="flex flex-wrap items-center gap-4 px-5 py-3 hover:bg-subtle">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-warning-soft text-warning-soft-foreground">
                    <Star className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">
                      {ev.period} · {ev.type}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Reviewer: {lookups.name(ev.reviewerId)} · {formatDate(ev.submittedAt ?? ev.createdAt)}
                    </span>
                  </span>
                  <RatingStars value={ev.overall} />
                  <StatusBadge status={ev.status} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={Star} title="No evaluations yet" description="Performance reviews will be listed here." />
        )}
      </SectionCard>
      <SectionCard title="Goals">
        {goals.length ? (
          <ul className="space-y-4">
            {goals.map((g) => (
              <li key={g.id}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{g.title}</p>
                  <span className="text-xs text-muted-foreground tabular">{g.progress}%</span>
                </div>
                <Progress value={g.progress} className="mt-2" indicatorClassName={g.progress === 100 ? "bg-success" : undefined} />
                <p className="mt-1.5 text-xs text-muted-foreground">Due {formatDate(g.dueDate)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No goals set.</p>
        )}
      </SectionCard>
    </div>
  );
}

