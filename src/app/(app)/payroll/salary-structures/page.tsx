"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { AlertTriangle, Download, Pencil, Search, Users, Wallet, Gift, CheckCircle2 } from "lucide-react";
import { useHRStore } from "@/store/hr-store";
import { useLookups } from "@/hooks/use-hr";
import { formatDate, todayKey } from "@/lib/dates";
import { downloadBlob, formatCompactMoney, formatMoney, round2, toCsv } from "@/lib/utils";
import type { Employee, SalaryStructure } from "@/types";
import { Badge, Card, Input } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/overlays";
import { DataTable } from "@/components/tables/data-table";
import { KpiCard, PersonCell } from "@/components/shared/common";
import { PayrollPageFrame } from "@/features/payroll/payroll-shell";
import { SalaryDialog } from "@/features/payroll/salary-dialog";

interface Row {
  employee: Employee;
  salary: SalaryStructure | undefined;
  name: string;
  department: string;
  basic: number;
  allowances: number;
  fixedGross: number;
  deductions: number;
  updatedAt: string;
}

export default function SalaryStructuresPage() {
  const employees = useHRStore((s) => s.data.employees);
  const salaries = useHRStore((s) => s.data.salaries);
  const departments = useHRStore((s) => s.data.departments);
  const lookups = useLookups();
  const [query, setQuery] = React.useState("");
  const [dept, setDept] = React.useState("all");
  const [editing, setEditing] = React.useState<Employee | null>(null);

  const rows = React.useMemo<Row[]>(
    () =>
      employees
        .filter((e) => !e.archived)
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((e) => {
          const s = salaries.find((x) => x.employeeId === e.id);
          const allowances = s ? round2(s.transportAllowance + s.mealAllowance + s.otherAllowance) : 0;
          return {
            employee: e,
            salary: s,
            name: `${e.firstName} ${e.lastName}`,
            department: lookups.deptName(e.departmentId),
            basic: s?.basic ?? 0,
            allowances,
            fixedGross: round2((s?.basic ?? 0) + allowances),
            deductions: s ? round2(s.loanDeduction + s.otherDeduction) : 0,
            updatedAt: s?.updatedAt ?? "",
          };
        }),
    [employees, salaries, lookups],
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (dept !== "all" && r.employee.departmentId !== dept) return false;
      if (!q) return true;
      return [r.name, r.employee.id, r.department, lookups.desName(r.employee.designationId)].some((v) => v.toLowerCase().includes(q));
    });
  }, [rows, query, dept, lookups]);

  const totals = React.useMemo(() => {
    const withSalary = rows.filter((r) => r.salary && r.basic > 0);
    return {
      fixed: round2(rows.reduce((s, r) => s + r.fixedGross, 0)),
      avgBasic: withSalary.length ? withSalary.reduce((s, r) => s + r.basic, 0) / withSalary.length : 0,
      allowances: round2(rows.reduce((s, r) => s + r.allowances, 0)),
      missing: rows.length - withSalary.length,
    };
  }, [rows]);

  const exportCsv = () => {
    const data = filtered.map((r) => [
      r.employee.id,
      r.name,
      r.department,
      r.basic,
      r.salary?.transportAllowance ?? 0,
      r.salary?.mealAllowance ?? 0,
      r.salary?.otherAllowance ?? 0,
      r.fixedGross,
      r.salary?.overtimeHours ?? 0,
      r.salary?.bonus ?? 0,
      r.salary?.loanDeduction ?? 0,
      r.salary?.otherDeduction ?? 0,
      r.updatedAt,
    ]);
    downloadBlob(
      toCsv(["Employee ID", "Name", "Department", "Basic", "Transport", "Meal", "Other allowances", "Fixed gross", "Overtime hours", "Bonus", "Loan deduction", "Other deductions", "Updated"], data),
      `salary-structures-${todayKey()}.csv`,
      "text/csv",
    );
    toast.success("Export ready", { description: `${data.length} salary structures exported to CSV.` });
  };

  const columns: ColumnDef<Row, unknown>[] = [
    {
      id: "employee",
      header: "Employee",
      accessorFn: (r) => r.name,
      cell: ({ row }) => <PersonCell name={row.original.name} sub={row.original.employee.id} src={row.original.employee.avatar} seed={row.original.employee.id} />,
    },
    { id: "department", header: "Department", accessorFn: (r) => r.department, meta: { className: "hidden md:table-cell" } },
    {
      id: "basic",
      header: "Basic",
      accessorFn: (r) => r.basic,
      meta: { align: "right" },
      cell: ({ row }) => (row.original.salary && row.original.basic > 0 ? formatMoney(row.original.basic) : <Badge variant="warning">Not set</Badge>),
    },
    { id: "allowances", header: "Allowances", accessorFn: (r) => r.allowances, meta: { align: "right", className: "hidden lg:table-cell" }, cell: ({ getValue }) => formatMoney(getValue() as number) },
    { id: "fixedGross", header: "Fixed gross", accessorFn: (r) => r.fixedGross, meta: { align: "right" }, cell: ({ getValue }) => <span className="font-medium">{formatMoney(getValue() as number)}</span> },
    {
      id: "deductions",
      header: "Deductions",
      accessorFn: (r) => r.deductions,
      meta: { align: "right", className: "hidden lg:table-cell" },
      cell: ({ getValue }) => ((getValue() as number) > 0 ? formatMoney(getValue() as number) : <span className="text-muted-foreground">—</span>),
    },
    { id: "updated", header: "Updated", accessorFn: (r) => r.updatedAt, meta: { className: "hidden xl:table-cell" }, cell: ({ getValue }) => <span className="text-muted-foreground tabular">{formatDate(getValue() as string)}</span> },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      meta: { align: "right" },
      cell: ({ row }) => (
        <Button variant="ghost" size="icon-sm" aria-label={`Edit salary for ${row.original.employee.id}`} onClick={() => setEditing(row.original.employee)}>
          <Pencil />
        </Button>
      ),
    },
  ];

  return (
    <PayrollPageFrame
      title="Salary Structures"
      description="Fixed monthly pay, recurring allowances and deductions used by every payroll run."
      actions={
        <Button variant="outline" onClick={exportCsv}>
          <Download /> Export CSV
        </Button>
      }
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Fixed monthly gross" icon={Wallet} value={formatCompactMoney(totals.fixed)} hint="Basic + allowances, all staff" />
          <KpiCard label="Average basic" icon={Users} tone="info" value={formatCompactMoney(totals.avgBasic)} hint={`${rows.length} active employees`} />
          <KpiCard label="Monthly allowances" icon={Gift} tone="success" value={formatCompactMoney(totals.allowances)} hint="Transport, meal and other" />
          <KpiCard
            label="Missing structures"
            icon={totals.missing ? AlertTriangle : CheckCircle2}
            tone={totals.missing ? "warning" : "success"}
            value={totals.missing}
            hint={totals.missing ? "Net pay will be zero until set" : "Every employee has a structure"}
          />
        </div>

        <Card>
          <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold tracking-tight">Employee salaries</h2>
              <p className="text-[13px] text-muted-foreground">{filtered.length} of {rows.length} employees</p>
            </div>
            <div className="flex flex-col gap-3 sm:ml-auto sm:flex-row">
              <div className="relative sm:w-72">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, ID or role…" className="pl-9" aria-label="Search salaries" />
              </div>
              <Select value={dept} onValueChange={setDept}>
                <SelectTrigger className="sm:w-48" aria-label="Filter by department">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All departments</SelectItem>
                  {departments.filter((d) => !d.archived).map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DataTable
            label="Employee salaries"
            columns={columns}
            data={filtered}
            getRowId={(r) => r.employee.id}
            onRowClick={(r) => setEditing(r.employee)}
            rowTestId={(r) => `salary-row-${r.employee.id}`}
            emptyTitle="No employees match your filters"
            emptyDescription="Try a different search term or department."
            emptyAction={
              <Button variant="outline" size="sm" onClick={() => { setQuery(""); setDept("all"); }}>
                Clear filters
              </Button>
            }
          />
        </Card>
      </div>

      <SalaryDialog employee={editing} open={!!editing} onOpenChange={(o) => !o && setEditing(null)} />
    </PayrollPageFrame>
  );
}
