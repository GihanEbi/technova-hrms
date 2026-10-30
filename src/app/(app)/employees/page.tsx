"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Archive, ArchiveRestore, Download, Eye, MoreHorizontal, Pencil, Search, UserPlus, Users } from "lucide-react";
import { useHRStore } from "@/store/hr-store";
import { useLookups, useSession } from "@/hooks/use-hr";
import { can } from "@/lib/permissions";
import { formatDate, todayKey } from "@/lib/dates";
import { downloadBlob, toCsv } from "@/lib/utils";
import { simulate } from "@/services/mock-api";
import type { Employee } from "@/types";
import { Card, Input } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import {
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
import { DataTable } from "@/components/tables/data-table";
import { ConfirmDialog, FadeIn, PageHeader, PersonCell, StatusBadge } from "@/components/shared/common";

export default function EmployeesPage() {
  const router = useRouter();
  const { role, employee: me } = useSession();
  const employees = useHRStore((s) => s.data.employees);
  const departments = useHRStore((s) => s.data.departments);
  const archiveEmployee = useHRStore((s) => s.archiveEmployee);
  const restoreEmployee = useHRStore((s) => s.restoreEmployee);
  const lookups = useLookups();
  const canManage = can(role ?? undefined, "employees.manage");
  const isTeamLead = role === "team_lead";

  const [query, setQuery] = React.useState("");
  const [dept, setDept] = React.useState("all");
  const [status, setStatus] = React.useState("current");
  const [pendingArchive, setPendingArchive] = React.useState<Employee | null>(null);

  const scoped = React.useMemo(() => (isTeamLead && me ? employees.filter((e) => e.managerId === me.id) : employees), [employees, isTeamLead, me]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return scoped.filter((e) => {
      if (status === "current" && e.archived) return false;
      if (status === "archived" && !e.archived) return false;
      if (!["current", "archived", "all"].includes(status) && (e.archived || e.status !== status)) return false;
      if (dept !== "all" && e.departmentId !== dept) return false;
      if (!q) return true;
      return [e.firstName, e.lastName, `${e.firstName} ${e.lastName}`, e.email, e.id, lookups.desName(e.designationId)].some((v) => v.toLowerCase().includes(q));
    });
  }, [scoped, query, dept, status, lookups]);

  const exportCsv = () => {
    const rows = filtered.map((e) => [e.id, `${e.firstName} ${e.lastName}`, e.email, e.phone, lookups.deptName(e.departmentId), lookups.desName(e.designationId), e.joinDate, e.employmentType, e.archived ? "Archived" : e.status]);
    downloadBlob(toCsv(["Employee ID", "Name", "Email", "Phone", "Department", "Designation", "Joining date", "Type", "Status"], rows), `employees-${todayKey()}.csv`, "text/csv");
    toast.success("Export ready", { description: `${rows.length} employees exported to CSV.` });
  };

  const columns: ColumnDef<Employee, unknown>[] = [
    {
      id: "name",
      header: "Employee",
      accessorFn: (e) => `${e.firstName} ${e.lastName}`,
      cell: ({ row }) => {
        const e = row.original;
        return <PersonCell name={`${e.firstName} ${e.lastName}`} sub={e.email} src={e.avatar} seed={e.id} href={`/employees/${e.id}`} />;
      },
    },
    { accessorKey: "id", header: "ID", cell: ({ getValue }) => <span className="font-mono text-xs text-muted-foreground">{getValue() as string}</span> },
    { id: "department", header: "Department", accessorFn: (e) => lookups.deptName(e.departmentId), meta: { className: "hidden md:table-cell" } },
    { id: "designation", header: "Designation", accessorFn: (e) => lookups.desName(e.designationId), meta: { className: "hidden lg:table-cell" } },
    { accessorKey: "joinDate", header: "Joining date", cell: ({ getValue }) => <span className="tabular">{formatDate(getValue() as string)}</span>, meta: { className: "hidden xl:table-cell" } },
    { id: "status", header: "Status", accessorFn: (e) => (e.archived ? "Archived" : e.status), cell: ({ getValue }) => <StatusBadge status={getValue() as string} /> },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      meta: { align: "right" },
      cell: ({ row }) => {
        const e = row.original;
        const name = `${e.firstName} ${e.lastName}`;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${name}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => router.push(`/employees/${e.id}`)}>
                <Eye /> View profile
              </DropdownMenuItem>
              {canManage && (
                <>
                  <DropdownMenuItem onSelect={() => router.push(`/employees/${e.id}/edit`)} disabled={e.archived}>
                    <Pencil /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {e.archived ? (
                    <DropdownMenuItem
                      onSelect={async () => {
                        await simulate(() => restoreEmployee(e.id), 200);
                        toast.success("Employee restored", { description: `${name} is active in the directory again.` });
                      }}
                    >
                      <ArchiveRestore /> Restore
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem destructive onSelect={() => setPendingArchive(e)}>
                      <Archive /> Archive
                    </DropdownMenuItem>
                  )}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const activeCount = scoped.filter((e) => !e.archived).length;
  return (
    <FadeIn>
      <PageHeader
        title={isTeamLead ? "My Team" : "Employees"}
        description={isTeamLead ? `${activeCount} people report to you.` : `${activeCount} active employees across ${departments.filter((d) => !d.archived).length} departments.`}
        actions={
          <>
            <Button variant="outline" onClick={exportCsv}>
              <Download /> Export CSV
            </Button>
            {canManage && (
              <Button asChild>
                <Link href="/employees/new">
                  <UserPlus /> Add employee
                </Link>
              </Button>
            )}
          </>
        }
      />
      <Card>
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, email, ID or role…" className="pl-9" aria-label="Search employees" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:flex">
            {!isTeamLead && (
              <Select value={dept} onValueChange={setDept}>
                <SelectTrigger className="sm:w-48" aria-label="Filter by department">
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
            )}
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="sm:w-40" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Current staff</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Probation">Probation</SelectItem>
                <SelectItem value="Notice Period">Notice period</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
                <SelectItem value="all">All statuses</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DataTable
          label="Employee directory"
          columns={columns}
          data={filtered}
          getRowId={(e) => e.id}
          initialSorting={[{ id: "id", desc: false }]}
          onRowClick={(e) => router.push(`/employees/${e.id}`)}
          rowTestId={(e) => `employee-row-${e.id}`}
          emptyTitle={status === "archived" ? "No archived employees" : "No employees match your filters"}
          emptyDescription="Try a different search term or clear the filters."
          emptyAction={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setQuery("");
                setDept("all");
                setStatus("current");
              }}
            >
              <Users /> Clear filters
            </Button>
          }
        />
      </Card>

      <ConfirmDialog
        open={!!pendingArchive}
        onOpenChange={(o) => !o && setPendingArchive(null)}
        tone="destructive"
        icon={Archive}
        title={`Archive ${pendingArchive?.firstName} ${pendingArchive?.lastName}?`}
        description="Archived employees are hidden from the directory, excluded from future payroll runs and can't sign in. Their history is kept and you can restore them at any time."
        confirmLabel="Archive employee"
        onConfirm={async () => {
          if (!pendingArchive) return;
          await simulate(() => archiveEmployee(pendingArchive.id));
          toast.success("Employee archived", { description: `${pendingArchive.firstName} ${pendingArchive.lastName} was moved to the archive.` });
        }}
      />
    </FadeIn>
  );
}
