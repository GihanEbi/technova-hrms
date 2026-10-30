"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { ArrowRight, Download, Eye, FileDown, Receipt, Search, Sparkles, Wallet, Landmark, TrendingUp } from "lucide-react";
import { useAuth, useLookups } from "@/hooks/use-hr";
import { can } from "@/lib/permissions";
import { runTotals } from "@/lib/payroll";
import { formatDate, now, periodLabel, todayKey } from "@/lib/dates";
import { downloadBlob, formatCompactMoney, formatMoney, round2, toCsv } from "@/lib/utils";
import { Badge, Card, Input } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/overlays";
import { Field } from "@/components/forms/fields";
import { DataTable } from "@/components/tables/data-table";
import { EmptyState, FadeIn, KpiCard, LoadingState, PageHeader, PersonCell, StatusBadge } from "@/components/shared/common";
import { PayrollPageFrame } from "@/features/payroll/payroll-shell";
import { type PayslipRow, usePayslipPdf, usePayslips } from "@/features/payroll/payslip-data";

export default function PayslipsPage() {
  return (
    <React.Suspense fallback={<LoadingState />}>
      <PayslipsRouter />
    </React.Suspense>
  );
}

function PayslipsRouter() {
  const { role } = useAuth();
  return can(role, "payroll.view") ? <AllPayslips /> : <MyPayslips />;
}

function viewLink(row: PayslipRow) {
  return (
    <Button asChild variant="ghost" size="sm">
      <Link href={`/payroll/payslips/${row.id}`} aria-label={`View payslip ${row.id}`}>
        <Eye /> <span className="hidden sm:inline">View</span>
      </Link>
    </Button>
  );
}

// ---------------- Payroll roles: every payslip ----------------
function AllPayslips() {
  const params = useSearchParams();
  const router = useRouter();
  const lookups = useLookups();
  const all = usePayslips();
  const periods = React.useMemo(() => [...new Set(all.map((p) => p.period))], [all]);
  const requested = params.get("period");
  const period = requested && (requested === "all" || periods.includes(requested)) ? requested : (periods[0] ?? "all");
  const [query, setQuery] = React.useState("");

  const setPeriod = (p: string) => router.replace(`/payroll/payslips?period=${p}`, { scroll: false });

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((p) => {
      if (period !== "all" && p.period !== period) return false;
      if (!q) return true;
      const e = lookups.employee(p.employeeId);
      return [p.id, p.employeeId, lookups.name(p.employeeId), lookups.deptName(e?.departmentId)].some((v) => v.toLowerCase().includes(q));
    });
  }, [all, period, query, lookups]);

  const totals = runTotals(filtered.map((f) => f.item));

  const exportCsv = () => {
    const rows = filtered.map((p) => [p.id, p.employeeId, lookups.name(p.employeeId), p.period, p.item.gross, p.item.totalDeductions, p.item.net, p.payDate, "Paid"]);
    downloadBlob(toCsv(["Payslip ID", "Employee ID", "Name", "Period", "Gross", "Deductions", "Net", "Pay date", "Status"], rows), `payslips-${period}-${todayKey()}.csv`, "text/csv");
    toast.success("Export ready", { description: `${rows.length} payslips exported to CSV.` });
  };

  const columns: ColumnDef<PayslipRow, unknown>[] = [
    {
      id: "employee",
      header: "Employee",
      accessorFn: (p) => lookups.name(p.employeeId),
      cell: ({ row }) => {
        const e = lookups.employee(row.original.employeeId);
        return <PersonCell size="sm" name={lookups.name(row.original.employeeId)} sub={row.original.employeeId} src={e?.avatar} seed={row.original.employeeId} href={`/payroll/payslips/${row.original.id}`} />;
      },
    },
    { id: "period", header: "Period", accessorKey: "period", cell: ({ getValue }) => periodLabel(getValue() as string) },
    { id: "gross", header: "Gross", accessorFn: (p) => p.item.gross, meta: { align: "right", className: "hidden md:table-cell" }, cell: ({ getValue }) => formatMoney(getValue() as number) },
    { id: "deductions", header: "Deductions", accessorFn: (p) => p.item.totalDeductions, meta: { align: "right", className: "hidden lg:table-cell" }, cell: ({ getValue }) => formatMoney(getValue() as number) },
    { id: "net", header: "Net", accessorFn: (p) => p.item.net, meta: { align: "right" }, cell: ({ getValue }) => <span className="font-medium">{formatMoney(getValue() as number)}</span> },
    { id: "payDate", header: "Pay date", accessorKey: "payDate", meta: { className: "hidden md:table-cell" }, cell: ({ getValue }) => <span className="tabular">{formatDate(getValue() as string)}</span> },
    { id: "status", header: "Status", enableSorting: false, meta: { className: "hidden sm:table-cell" }, cell: () => <StatusBadge status="Paid" /> },
    { id: "actions", header: () => <span className="sr-only">Actions</span>, enableSorting: false, meta: { align: "right" }, cell: ({ row }) => viewLink(row.original) },
  ];

  return (
    <PayrollPageFrame
      title="Payslips"
      description="Payslips generated from processed payroll runs."
      actions={
        <Button variant="outline" onClick={exportCsv} disabled={!filtered.length}>
          <Download /> Export CSV
        </Button>
      }
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Payslips" icon={Receipt} value={filtered.length} hint={period === "all" ? "All processed periods" : periodLabel(period)} />
          <KpiCard label="Gross pay" icon={TrendingUp} tone="info" value={formatCompactMoney(totals.gross)} hint="Before deductions" />
          <KpiCard label="Net paid" icon={Wallet} tone="success" value={formatCompactMoney(totals.net)} hint="Transferred to employees" />
          <KpiCard label="Employer contributions" icon={Landmark} tone="warning" value={formatCompactMoney(round2(totals.epfEmployer + totals.etf))} hint="EPF 12% + ETF 3%" />
        </div>
        <Card>
          <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-end">
            <Field label="Period" htmlFor="payslip-period" className="sm:w-56">
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger id="payslip-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All periods</SelectItem>
                  {periods.map((p) => (
                    <SelectItem key={p} value={p}>
                      {periodLabel(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="relative flex-1 sm:max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, employee or payslip ID…" className="pl-9" aria-label="Search payslips" />
            </div>
          </div>
          <DataTable
            label="Payslips"
            columns={columns}
            data={filtered}
            getRowId={(p) => p.id}
            rowTestId={(p) => `payslip-row-${p.id}`}
            onRowClick={(p) => router.push(`/payroll/payslips/${p.id}`)}
            emptyTitle={all.length ? "No payslips match your filters" : "No payslips yet"}
            emptyDescription={all.length ? "Try another period or search term." : "Payslips are generated when a payroll run is processed."}
            emptyAction={
              all.length ? (
                <Button variant="outline" size="sm" onClick={() => { setQuery(""); setPeriod("all"); }}>
                  Clear filters
                </Button>
              ) : (
                <Button asChild size="sm">
                  <Link href="/payroll/process">Process payroll</Link>
                </Button>
              )
            }
          />
        </Card>
      </div>
    </PayrollPageFrame>
  );
}

// ---------------- Everyone else: own payslips ----------------
function MyPayslips() {
  const { employee } = useAuth();
  const router = useRouter();
  const all = usePayslips();
  const { download, busyId } = usePayslipPdf();
  const mine = React.useMemo(() => all.filter((p) => p.employeeId === employee.id), [all, employee.id]);
  const latest = mine[0];
  const year = String(now().getFullYear());
  const ytd = mine.filter((p) => p.period.startsWith(year));
  const ytdNet = round2(ytd.reduce((s, p) => s + p.item.net, 0));
  const ytdGross = round2(ytd.reduce((s, p) => s + p.item.gross, 0));
  const ytdTax = round2(ytd.reduce((s, p) => s + p.item.apit, 0));
  const ytdEpf = round2(ytd.reduce((s, p) => s + p.item.epfEmployee + p.item.epfEmployer, 0));

  const columns: ColumnDef<PayslipRow, unknown>[] = [
    {
      id: "period",
      header: "Period",
      accessorKey: "period",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{periodLabel(row.original.period)}</span>
          {row.original.id === latest?.id && <Badge variant="default"><Sparkles /> Latest</Badge>}
        </div>
      ),
    },
    { id: "gross", header: "Gross", accessorFn: (p) => p.item.gross, meta: { align: "right", className: "hidden sm:table-cell" }, cell: ({ getValue }) => formatMoney(getValue() as number) },
    { id: "deductions", header: "Deductions", accessorFn: (p) => p.item.totalDeductions, meta: { align: "right", className: "hidden md:table-cell" }, cell: ({ getValue }) => formatMoney(getValue() as number) },
    { id: "net", header: "Net", accessorFn: (p) => p.item.net, meta: { align: "right" }, cell: ({ getValue }) => <span className="font-medium">{formatMoney(getValue() as number)}</span> },
    { id: "payDate", header: "Pay date", accessorKey: "payDate", meta: { className: "hidden md:table-cell" }, cell: ({ getValue }) => <span className="tabular">{formatDate(getValue() as string)}</span> },
    { id: "status", header: "Status", enableSorting: false, meta: { className: "hidden sm:table-cell" }, cell: () => <StatusBadge status="Paid" /> },
    { id: "actions", header: () => <span className="sr-only">Actions</span>, enableSorting: false, meta: { align: "right" }, cell: ({ row }) => viewLink(row.original) },
  ];

  return (
    <FadeIn>
      <PageHeader title="My Payslips" description="Your monthly payslips. Open one to print it or download a PDF copy." />
      {!latest ? (
        <Card>
          <EmptyState icon={Receipt} title="No payslips yet" description="Your payslips appear here after your first payroll run is processed." />
        </Card>
      ) : (
        <div className="space-y-6">
          <Card className="overflow-hidden border-primary/30" data-testid="latest-payslip">
            <div className="grid gap-0 md:grid-cols-[1fr_auto]">
              <div className="p-5 sm:p-6">
                <Badge variant="default"><Sparkles /> Latest payslip</Badge>
                <p className="mt-3 text-sm text-muted-foreground">{periodLabel(latest.period)} · paid {formatDate(latest.payDate)}</p>
                <p className="mt-1 text-3xl font-semibold tracking-tight tabular">{formatMoney(latest.item.net)}</p>
                <p className="mt-1 text-[13px] text-muted-foreground tabular">
                  Gross {formatMoney(latest.item.gross)} · Deductions {formatMoney(latest.item.totalDeductions)}
                </p>
              </div>
              <div className="flex flex-col justify-center gap-2 border-t border-border bg-primary-soft/50 p-5 sm:flex-row md:flex-col md:border-t-0 md:border-l">
                <Button asChild>
                  <Link href={`/payroll/payslips/${latest.id}`}>
                    Open latest payslip <ArrowRight />
                  </Link>
                </Button>
                <Button variant="outline" onClick={() => download(latest)} loading={busyId === latest.id}>
                  {busyId !== latest.id && <FileDown />} Download PDF
                </Button>
              </div>
            </div>
          </Card>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Net pay YTD" icon={Wallet} tone="success" value={formatCompactMoney(ytdNet)} hint={`${ytd.length} payslips in ${year}`} />
            <KpiCard label="Gross pay YTD" icon={TrendingUp} value={formatCompactMoney(ytdGross)} hint="Before deductions" />
            <KpiCard label="APIT YTD" icon={Receipt} tone="warning" value={formatCompactMoney(ytdTax)} hint="Illustrative tax" />
            <KpiCard label="EPF contributions YTD" icon={Landmark} tone="info" value={formatCompactMoney(ytdEpf)} hint="Your 8% + employer 12%" />
          </div>
          <Card>
            <div className="border-b border-border p-4">
              <h2 className="text-[15px] font-semibold tracking-tight">Payslip history</h2>
              <p className="text-[13px] text-muted-foreground">{mine.length} payslips</p>
            </div>
            <DataTable label="My payslips" columns={columns} data={mine} getRowId={(p) => p.id} onRowClick={(p) => router.push(`/payroll/payslips/${p.id}`)} rowTestId={(p) => `payslip-row-${p.id}`} emptyTitle="No payslips yet" />
          </Card>
        </div>
      )}
    </FadeIn>
  );
}
