"use client";

import * as React from "react";
import { toast } from "sonner";
import { BarChart3, CalendarDays, Clock, Download, FileDown, Printer, RotateCcw, Search, Users, Wallet } from "lucide-react";
import { useAuth, useLookups } from "@/hooks/use-hr";
import { useHRStore } from "@/store/hr-store";
import { can, type Permission } from "@/lib/permissions";
import { formatDate, formatDateTime, now } from "@/lib/dates";
import { downloadBlob, toCsv } from "@/lib/utils";
import { createReportPdf } from "@/lib/pdf";
import { Input } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/overlays";
import { DateRangePicker, SearchableSelect } from "@/components/forms/fields";
import { AccessDenied, FadeIn, ModuleTabs, PageHeader } from "@/components/shared/common";
import { PrintLightTheme } from "@/features/payroll/print-theme";

export type DateRange = { from: string; to: string } | null;

export function ReportTabs() {
  const { role } = useAuth();
  const hr = can(role, "reports.hr");
  const pay = can(role, "reports.payroll");
  return (
    <div className="no-print">
      <ModuleTabs
        tabs={[
          { href: "/reports", label: "Overview", icon: BarChart3, exact: true },
          { href: "/reports/employees", label: "Employees", icon: Users, hidden: !hr },
          { href: "/reports/attendance", label: "Attendance", icon: Clock, hidden: !hr },
          { href: "/reports/leave", label: "Leave", icon: CalendarDays, hidden: !hr },
          { href: "/reports/payroll", label: "Payroll", icon: Wallet, hidden: !pay },
        ]}
      />
    </div>
  );
}

export interface ExportSpec {
  title: string;
  filenameBase: string;
  columns: string[];
  rows: (string | number)[][];
  numericColumns?: number[];
  moneyColumns?: number[];
  filters: { label: string; value: string }[];
  summary?: { label: string; value: string }[];
  orientation?: "portrait" | "landscape";
}

/** Page frame for a report: permission guard, header with CSV / PDF / Print actions, printable area. */
export function ReportFrame({
  permission,
  title,
  description,
  exportSpec,
  children,
}: {
  permission: Permission;
  title: string;
  description: string;
  exportSpec: ExportSpec;
  children: React.ReactNode;
}) {
  const { role, employee } = useAuth();
  const companyName = useHRStore((s) => s.data.company.name);
  const [pdfBusy, setPdfBusy] = React.useState(false);
  const allowed = can(role, permission);
  const stamp = formatDate(now(), "yyyy-MM-dd");

  const csv = () => {
    downloadBlob(toCsv(exportSpec.columns, exportSpec.rows), `${exportSpec.filenameBase}-${stamp}.csv`, "text/csv");
    toast.success("CSV downloaded", { description: `${exportSpec.rows.length} rows exported from the ${exportSpec.title.toLowerCase()}.` });
  };
  const pdf = async () => {
    setPdfBusy(true);
    try {
      await createReportPdf({
        title: exportSpec.title,
        subtitle: description,
        companyName,
        filters: exportSpec.filters,
        summary: exportSpec.summary,
        columns: exportSpec.columns,
        rows: exportSpec.rows,
        numericColumns: exportSpec.numericColumns,
        moneyColumns: exportSpec.moneyColumns,
        filename: `${exportSpec.filenameBase}-${stamp}.pdf`,
        generatedBy: `${employee.firstName} ${employee.lastName}`,
        orientation: exportSpec.orientation,
      });
      toast.success("PDF exported", { description: `${exportSpec.filenameBase}-${stamp}.pdf` });
    } catch {
      toast.error("Couldn't create the PDF", { description: "Please try again." });
    } finally {
      setPdfBusy(false);
    }
  };

  if (!allowed) {
    return (
      <FadeIn>
        <PageHeader title={title} />
        <AccessDenied />
      </FadeIn>
    );
  }

  return (
    <FadeIn className="print-area">
      <PrintLightTheme />
      <PageHeader
        title={title}
        description={description}
        actions={
          <div className="no-print flex flex-wrap gap-2">
            <Button variant="outline" onClick={csv}>
              <Download /> Download CSV
            </Button>
            <Button variant="outline" onClick={pdf} loading={pdfBusy}>
              {!pdfBusy && <FileDown />} Export PDF
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer /> Print
            </Button>
          </div>
        }
      />
      <p className="print-only mb-4 text-xs text-muted-foreground">
        {companyName} · generated {formatDateTime(now().toISOString())} · {exportSpec.filters.map((f) => `${f.label}: ${f.value}`).join(" · ")}
      </p>
      <ReportTabs />
      <div className="space-y-6">{children}</div>
    </FadeIn>
  );
}

// ---------------- Filters ----------------
export interface ReportFilters {
  range: DateRange;
  dept: string;
  employeeId: string;
  query: string;
}

export function useReportFilters(defaultRange: DateRange) {
  const [filters, setFilters] = React.useState<ReportFilters>({ range: defaultRange, dept: "all", employeeId: "", query: "" });
  const update = React.useCallback((patch: Partial<ReportFilters>) => setFilters((f) => ({ ...f, ...patch })), []);
  const reset = React.useCallback(() => setFilters({ range: defaultRange, dept: "all", employeeId: "", query: "" }), [defaultRange]);
  return { filters, update, reset };
}

export function rangeLabel(range: DateRange) {
  return range ? `${formatDate(range.from)} - ${formatDate(range.to)}` : "All dates";
}

/** Common filter descriptions for exports. */
export function useFilterSummary(filters: ReportFilters, showRange = true) {
  const lookups = useLookups();
  return React.useMemo(() => {
    const list = [] as { label: string; value: string }[];
    if (showRange) list.push({ label: "Date range", value: rangeLabel(filters.range) });
    list.push({ label: "Department", value: filters.dept === "all" ? "All departments" : lookups.deptName(filters.dept) });
    list.push({ label: "Employee", value: filters.employeeId ? `${lookups.name(filters.employeeId)} (${filters.employeeId})` : "All employees" });
    if (filters.query.trim()) list.push({ label: "Search", value: `"${filters.query.trim()}"` });
    return list;
  }, [filters, lookups, showRange]);
}

export function FilterBar({
  filters,
  update,
  reset,
  showRange = true,
  rangePlaceholder,
  children,
}: {
  filters: ReportFilters;
  update: (patch: Partial<ReportFilters>) => void;
  reset: () => void;
  showRange?: boolean;
  rangePlaceholder?: string;
  children?: React.ReactNode;
}) {
  const departments = useHRStore((s) => s.data.departments);
  const employees = useHRStore((s) => s.data.employees);
  const lookups = useLookups();
  const options = React.useMemo(
    () =>
      employees
        .filter((e) => !e.archived && (filters.dept === "all" || e.departmentId === filters.dept))
        .sort((a, b) => a.firstName.localeCompare(b.firstName))
        .map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName}`, description: `${e.id} · ${lookups.deptName(e.departmentId)}` })),
    [employees, filters.dept, lookups],
  );
  return (
    <div className="no-print flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm lg:flex-row lg:flex-wrap lg:items-center" role="search" aria-label="Report filters">
      {showRange && <DateRangePicker value={filters.range} onChange={(range) => update({ range })} placeholder={rangePlaceholder ?? "All dates"} />}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex">
        <Select
          value={filters.dept}
          onValueChange={(dept) => {
            const keep = filters.employeeId && (dept === "all" || lookups.employee(filters.employeeId)?.departmentId === dept);
            update({ dept, employeeId: keep ? filters.employeeId : "" });
          }}
        >
          <SelectTrigger className="lg:w-48" aria-label="Department">
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
        <div className="lg:w-56">
          <SearchableSelect ariaLabel="Employee" value={filters.employeeId} onChange={(employeeId) => update({ employeeId })} options={options} placeholder="All employees" searchPlaceholder="Search employees…" allowClear />
        </div>
        {children}
      </div>
      <div className="relative min-w-0 flex-1 lg:min-w-48">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={filters.query} onChange={(e) => update({ query: e.target.value })} placeholder="Search…" className="pl-9" aria-label="Search records" />
      </div>
      <Button variant="ghost" size="sm" onClick={reset} className="self-start lg:self-auto">
        <RotateCcw /> Reset
      </Button>
    </div>
  );
}

/** Simple select used for extra report-specific filters. */
export function MiniSelect({ label, value, onChange, options, className }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; className?: string }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className ?? "lg:w-44"} aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Text match helper for report searches. */
export function matches(q: string, ...values: (string | undefined | null)[]) {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return values.some((v) => (v ?? "").toLowerCase().includes(s));
}
