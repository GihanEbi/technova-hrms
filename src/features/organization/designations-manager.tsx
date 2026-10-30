"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Archive, ArchiveRestore, Ban, Briefcase, MoreHorizontal, Pencil, Plus, Search, Users } from "lucide-react";
import { useHRStore } from "@/store/hr-store";
import { useLookups } from "@/hooks/use-hr";
import { simulate } from "@/services/mock-api";
import { pluralize } from "@/lib/utils";
import type { Designation } from "@/types";
import { Badge, Card, Input } from "@/components/ui/primitives";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/overlays";
import { Field } from "@/components/forms/fields";
import { DataTable } from "@/components/tables/data-table";
import { ConfirmDialog, StatusBadge } from "@/components/shared/common";
import { ColorDot } from "./department-dialog";

export const designationLevels: Designation["level"][] = ["Junior", "Mid", "Senior", "Lead", "Manager", "Executive"];

interface Row extends Designation {
  employees: number;
}

export function DesignationsManager() {
  const designations = useHRStore((s) => s.data.designations);
  const employees = useHRStore((s) => s.data.employees);
  const departments = useHRStore((s) => s.data.departments);
  const setArchived = useHRStore((s) => s.setDesignationArchived);
  const lookups = useLookups();

  const [query, setQuery] = React.useState("");
  const [dept, setDept] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Designation | null>(null);
  const [pendingArchive, setPendingArchive] = React.useState<Designation | null>(null);
  const [blocked, setBlocked] = React.useState<{ des: Designation; count: number } | null>(null);

  const rows: Row[] = React.useMemo(() => {
    const counts = new Map<string, number>();
    employees.forEach((e) => {
      if (!e.archived) counts.set(e.designationId, (counts.get(e.designationId) ?? 0) + 1);
    });
    return designations.map((d) => ({ ...d, employees: counts.get(d.id) ?? 0 }));
  }, [designations, employees]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (dept !== "all" && r.departmentId !== dept) return false;
      if (status === "active" && r.archived) return false;
      if (status === "archived" && !r.archived) return false;
      if (!q) return true;
      return [r.title, r.level, lookups.deptName(r.departmentId)].some((v) => v.toLowerCase().includes(q));
    });
  }, [rows, query, dept, status, lookups]);

  const openAdd = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const columns: ColumnDef<Row, unknown>[] = [
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Briefcase className="size-4" />
          </span>
          <span className="font-medium">{row.original.title}</span>
        </div>
      ),
    },
    {
      id: "department",
      header: "Department",
      accessorFn: (r) => lookups.deptName(r.departmentId),
      cell: ({ row, getValue }) => (
        <span className="flex items-center gap-2">
          <ColorDot color={lookups.department(row.original.departmentId)?.color ?? "chart-1"} />
          {getValue() as string}
        </span>
      ),
      meta: { className: "hidden md:table-cell" },
    },
    {
      id: "level",
      header: "Level",
      accessorFn: (r) => designationLevels.indexOf(r.level),
      cell: ({ row }) => <Badge variant="outline">{row.original.level}</Badge>,
      meta: { className: "hidden sm:table-cell" },
    },
    { accessorKey: "employees", header: "Employees", meta: { align: "right" } },
    { id: "status", header: "Status", accessorFn: (r) => (r.archived ? "Archived" : "Active"), cell: ({ getValue }) => <StatusBadge status={getValue() as string} /> },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      meta: { align: "right" },
      cell: ({ row }) => {
        const d = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${d.title}`}>
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
                <DropdownMenuItem
                  onSelect={async () => {
                    await simulate(() => setArchived(d.id, false), 250);
                    toast.success("Designation restored", { description: `${d.title} can be assigned again.` });
                  }}
                >
                  <ArchiveRestore /> Restore
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  destructive
                  onSelect={() => {
                    if (d.employees > 0) setBlocked({ des: d, count: d.employees });
                    else setPendingArchive(d);
                  }}
                >
                  <Archive /> Archive
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <>
      <Card>
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search designations…" className="pl-9" aria-label="Search designations" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:flex">
            <Select value={dept} onValueChange={setDept}>
              <SelectTrigger className="sm:w-52" aria-label="Filter by department">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="sm:w-36" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={openAdd} className="col-span-2 sm:col-span-1">
              <Plus /> Add designation
            </Button>
          </div>
        </div>
        <DataTable
          label="Designations"
          columns={columns}
          data={filtered}
          getRowId={(r) => r.id}
          initialSorting={[{ id: "department", desc: false }]}
          rowTestId={(r) => `designation-row-${r.id}`}
          emptyTitle="No designations match your filters"
          emptyDescription="Try a different search term, or add a new designation."
          emptyAction={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setQuery("");
                setDept("all");
                setStatus("all");
              }}
            >
              Clear filters
            </Button>
          }
        />
      </Card>

      <DesignationDialog open={dialogOpen} onOpenChange={setDialogOpen} designation={editing} />

      <ConfirmDialog
        open={!!pendingArchive}
        onOpenChange={(o) => !o && setPendingArchive(null)}
        tone="destructive"
        icon={Archive}
        title={`Archive ${pendingArchive?.title ?? "designation"}?`}
        description="Archived designations can't be assigned to employees. You can restore them at any time."
        confirmLabel="Archive designation"
        onConfirm={async () => {
          if (!pendingArchive) return;
          const d = pendingArchive;
          await simulate(() => setArchived(d.id, true));
          toast.success("Designation archived", { description: `${d.title} was moved to the archive.` });
        }}
      />

      <Dialog open={!!blocked} onOpenChange={(o) => !o && setBlocked(null)}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Can&apos;t archive {blocked?.des.title}</DialogTitle>
            <DialogDescription>This designation is still in use.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="flex gap-3 rounded-lg border border-warning/30 bg-warning-soft p-3 text-sm text-warning-soft-foreground">
              <Ban className="mt-0.5 size-4 shrink-0" />
              <p>
                {pluralize(blocked?.count ?? 0, "active employee")} {blocked?.count === 1 ? "holds" : "hold"} the {blocked?.des.title} designation. Reassign{" "}
                {blocked?.count === 1 ? "them" : "these employees"} before archiving it.
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
    </>
  );
}

const schema = z.object({
  title: z.string().trim().min(2, "Title is required."),
  departmentId: z.string().min(1, "Select a department."),
  level: z.enum(["Junior", "Mid", "Senior", "Lead", "Manager", "Executive"]),
});
type Values = z.infer<typeof schema>;

function DesignationDialog({ open, onOpenChange, designation }: { open: boolean; onOpenChange: (o: boolean) => void; designation: Designation | null }) {
  const departments = useHRStore((s) => s.data.departments);
  const designations = useHRStore((s) => s.data.designations);
  const add = useHRStore((s) => s.addDesignation);
  const update = useHRStore((s) => s.updateDesignation);
  const isEdit = !!designation;
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { title: "", departmentId: "", level: "Mid" } });
  const { register, control, handleSubmit, formState, reset, setError } = form;
  const errors = formState.errors;

  React.useEffect(() => {
    if (open) reset({ title: designation?.title ?? "", departmentId: designation?.departmentId ?? "", level: designation?.level ?? "Mid" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, designation]);

  const deptOptions = departments.filter((d) => !d.archived || d.id === designation?.departmentId);

  const onSubmit = handleSubmit(async (v) => {
    const clash = designations.find((d) => d.id !== designation?.id && d.departmentId === v.departmentId && d.title.trim().toLowerCase() === v.title.trim().toLowerCase());
    if (clash) {
      setError("title", { message: "This department already has a designation with this title." });
      return;
    }
    const payload = { title: v.title.trim(), departmentId: v.departmentId, level: v.level };
    if (isEdit && designation) {
      await simulate(() => update(designation.id, payload));
      toast.success("Designation updated", { description: `${payload.title} was saved.` });
    } else {
      await simulate(() => add(payload));
      toast.success("Designation added", { description: `${payload.title} can now be assigned to employees.` });
    }
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !formState.isSubmitting && onOpenChange(o)}>
      <DialogContent size="sm">
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>{isEdit ? `Edit ${designation?.title}` : "Add designation"}</DialogTitle>
            <DialogDescription>{isEdit ? "Update the job title, department or level." : "Create a job title that can be assigned to employees."}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <Field label="Title" htmlFor="des-title" required error={errors.title?.message}>
              <Input id="des-title" placeholder="e.g. Product Designer" aria-invalid={!!errors.title} {...register("title")} />
            </Field>
            <Field label="Department" htmlFor="des-department" required error={errors.departmentId?.message}>
              <Controller
                control={control}
                name="departmentId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="des-department" aria-invalid={!!errors.departmentId}>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {deptOptions.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="Level" htmlFor="des-level">
              <Controller
                control={control}
                name="level"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="des-level">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {designationLevels.map((l) => (
                        <SelectItem key={l} value={l}>
                          {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={formState.isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" loading={formState.isSubmitting}>
              {isEdit ? "Save changes" : "Add designation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
