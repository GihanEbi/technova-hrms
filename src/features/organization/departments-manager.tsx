"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Archive, ArchiveRestore, ArrowRight, Ban, Briefcase, Building2, MoreHorizontal, Pencil, Plus, UserRound, Users } from "lucide-react";
import { useHRStore } from "@/store/hr-store";
import { useLookups } from "@/hooks/use-hr";
import { simulate } from "@/services/mock-api";
import { pluralize } from "@/lib/utils";
import type { Department } from "@/types";
import { Badge, Card, Label, Switch } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/overlays";
import { ConfirmDialog, EmptyState, PersonCell, SectionCard, StatusBadge } from "@/components/shared/common";
import { axisProps, ChartTooltip, gridProps, tooltipCursor, chartAnimation } from "@/components/charts/chart-kit";
import { ColorDot, DepartmentDialog } from "./department-dialog";

export function DepartmentsManager() {
  const departments = useHRStore((s) => s.data.departments);
  const employees = useHRStore((s) => s.data.employees);
  const designations = useHRStore((s) => s.data.designations);
  const setArchived = useHRStore((s) => s.setDepartmentArchived);
  const lookups = useLookups();

  const [showArchived, setShowArchived] = React.useState(false);
  const [editing, setEditing] = React.useState<Department | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [pendingArchive, setPendingArchive] = React.useState<Department | null>(null);
  const [blocked, setBlocked] = React.useState<{ dept: Department; count: number } | null>(null);

  const headcount = React.useMemo(() => {
    const m = new Map<string, number>();
    employees.forEach((e) => {
      if (!e.archived) m.set(e.departmentId, (m.get(e.departmentId) ?? 0) + 1);
    });
    return m;
  }, [employees]);
  const designationCount = React.useMemo(() => {
    const m = new Map<string, number>();
    designations.forEach((d) => {
      if (!d.archived) m.set(d.departmentId, (m.get(d.departmentId) ?? 0) + 1);
    });
    return m;
  }, [designations]);

  const active = departments.filter((d) => !d.archived);
  const archived = departments.filter((d) => d.archived);
  const visible = showArchived ? [...active, ...archived] : active;
  const chartData = active
    .map((d) => ({ name: d.name, code: d.code, headcount: headcount.get(d.id) ?? 0, fill: `var(--${d.color})` }))
    .sort((a, b) => b.headcount - a.headcount);
  const totalHeadcount = chartData.reduce((a, b) => a + b.headcount, 0);

  const requestArchive = (d: Department) => {
    const count = headcount.get(d.id) ?? 0;
    if (count > 0) setBlocked({ dept: d, count });
    else setPendingArchive(d);
  };

  const restore = async (d: Department) => {
    await simulate(() => setArchived(d.id, false), 250);
    toast.success("Department restored", { description: `${d.name} is active again.` });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="Headcount by department" description="Active employees in each active department" className="lg:col-span-2">
          {chartData.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 0 }} barCategoryGap={10}>
                <CartesianGrid {...gridProps} horizontal={false} vertical />
                <XAxis type="number" allowDecimals={false} {...axisProps} />
                <YAxis type="category" dataKey="code" width={48} {...axisProps} />
                <Tooltip
                  cursor={tooltipCursor}
                  content={<ChartTooltip formatter={(v) => pluralize(v, "employee")} labelFormatter={(code) => chartData.find((c) => c.code === code)?.name ?? code} />}
                />
                <Bar isAnimationActive={chartAnimation} dataKey="headcount" name="Headcount" radius={[0, 4, 4, 0]} maxBarSize={26}>
                  {chartData.map((d) => (
                    <Cell key={d.code} fill={d.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState icon={Building2} title="No active departments" description="Add a department to see the headcount breakdown." />
          )}
        </SectionCard>
        <SectionCard title="Organization summary" description="Structure at a glance">
          <dl className="grid grid-cols-2 gap-3">
            {[
              { label: "Departments", value: active.length, icon: Building2 },
              { label: "Employees", value: totalHeadcount, icon: Users },
              { label: "Designations", value: designations.filter((d) => !d.archived).length, icon: Briefcase },
              { label: "Archived", value: archived.length, icon: Archive },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-border bg-subtle p-3">
                <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <s.icon className="size-3.5" />
                  {s.label}
                </dt>
                <dd className="mt-1 text-xl font-semibold tabular">{s.value}</dd>
              </div>
            ))}
          </dl>
          <ul className="mt-4 space-y-2">
            {chartData.slice(0, 5).map((d) => (
              <li key={d.code} className="flex items-center gap-2 text-sm">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: d.fill }} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{d.name}</span>
                <span className="font-medium tabular">{totalHeadcount ? Math.round((d.headcount / totalHeadcount) * 100) : 0}%</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <Switch id="show-archived-departments" checked={showArchived} onCheckedChange={setShowArchived} />
          <Label htmlFor="show-archived-departments" className="font-normal">
            Show archived
            {archived.length > 0 && <span className="ml-1 text-muted-foreground tabular">({archived.length})</span>}
          </Label>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus /> Add department
        </Button>
      </div>

      {visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={Building2}
            title="No departments yet"
            description="Departments group your employees and designations. Create the first one to get started."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setEditing(null);
                  setDialogOpen(true);
                }}
              >
                <Plus /> Add department
              </Button>
            }
          />
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Departments">
          {visible.map((d) => {
            const head = lookups.employee(d.headId);
            const count = headcount.get(d.id) ?? 0;
            return (
              <li key={d.id} data-testid={`department-card-${d.code}`}>
                <Card className={`flex h-full flex-col ${d.archived ? "opacity-75" : ""}`}>
                  <div className="flex items-start gap-3 px-5 pt-5">
                    <span className="mt-1.5">
                      <ColorDot color={d.color} className="size-3" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-[15px] font-semibold tracking-tight">{d.name}</h3>
                        <Badge variant="outline" className="font-mono">
                          {d.code}
                        </Badge>
                        {d.archived && <StatusBadge status="Archived" />}
                      </div>
                      <p className="mt-1 line-clamp-2 min-h-10 text-[13px] text-muted-foreground">{d.description || "No description provided."}</p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${d.name}`} className="-mt-1 -mr-2">
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() => {
                            setEditing(d);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {d.archived ? (
                          <DropdownMenuItem onSelect={() => restore(d)}>
                            <ArchiveRestore /> Restore
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem destructive onSelect={() => requestArchive(d)}>
                            <Archive /> Archive
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="px-5 pt-4">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Department head</p>
                    {head ? (
                      <PersonCell size="sm" name={`${head.firstName} ${head.lastName}`} sub={lookups.desName(head.designationId)} src={head.avatar} seed={head.id} />
                    ) : (
                      <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <UserRound className="size-4" /> Not assigned
                      </p>
                    )}
                  </div>
                  <div className="mx-5 mt-4 grid grid-cols-2 divide-x divide-border rounded-lg border border-border bg-subtle">
                    <div className="px-3 py-2.5">
                      <p className="text-xs text-muted-foreground">Active headcount</p>
                      <p className="mt-0.5 text-lg font-semibold tabular">{count}</p>
                    </div>
                    <div className="px-3 py-2.5">
                      <p className="text-xs text-muted-foreground">Designations</p>
                      <p className="mt-0.5 text-lg font-semibold tabular">{designationCount.get(d.id) ?? 0}</p>
                    </div>
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-2 px-5 pt-4 pb-4">
                    <span className="text-xs text-muted-foreground">Since {d.createdAt.slice(0, 4)}</span>
                    <Button asChild variant="link" size="sm" className="h-auto">
                      <Link href="/employees" aria-label={`View employees in ${d.name}`}>
                        View employees <ArrowRight className="size-3.5" />
                      </Link>
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <DepartmentDialog open={dialogOpen} onOpenChange={setDialogOpen} department={editing} />

      <ConfirmDialog
        open={!!pendingArchive}
        onOpenChange={(o) => !o && setPendingArchive(null)}
        tone="destructive"
        icon={Archive}
        title={`Archive ${pendingArchive?.name ?? "department"}?`}
        description="Archived departments are hidden from forms and reports. Their history is kept and you can restore them at any time."
        confirmLabel="Archive department"
        onConfirm={async () => {
          if (!pendingArchive) return;
          const d = pendingArchive;
          await simulate(() => setArchived(d.id, true));
          toast.success("Department archived", { description: `${d.name} was moved to the archive.` });
        }}
      />

      <Dialog open={!!blocked} onOpenChange={(o) => !o && setBlocked(null)}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Can&apos;t archive {blocked?.dept.name}</DialogTitle>
            <DialogDescription>This department still has active employees assigned to it.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="flex gap-3 rounded-lg border border-warning/30 bg-warning-soft p-3 text-sm text-warning-soft-foreground">
              <Ban className="mt-0.5 size-4 shrink-0" />
              <p>
                {pluralize(blocked?.count ?? 0, "active employee")} {blocked?.count === 1 ? "is" : "are"} still assigned to {blocked?.dept.name}. Move{" "}
                {blocked?.count === 1 ? "them" : "these employees"} to another department (or archive them) before archiving the department.
              </p>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlocked(null)}>
              Close
            </Button>
            <Button asChild>
              <Link href="/employees">
                <Users /> Review employees
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
