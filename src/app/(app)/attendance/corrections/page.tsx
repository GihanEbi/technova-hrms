"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Check, CheckCircle2, ClipboardCheck, Clock, PencilLine, Search, X, XCircle } from "lucide-react";
import { useHRStore } from "@/store/hr-store";
import { useAuth, useLookups } from "@/hooks/use-hr";
import { can } from "@/lib/permissions";
import { formatDate, formatTime, relativeTime } from "@/lib/dates";
import type { AttendanceCorrection } from "@/types";
import { Card, Input } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/overlays";
import { DataTable } from "@/components/tables/data-table";
import { AccessDenied, FadeIn, KpiCard, ModuleTabs, PageHeader, PersonCell, StatusBadge } from "@/components/shared/common";
import { CorrectionDialog } from "@/features/attendance/correction-dialog";
import { ReviewCorrectionDialog, to12h } from "@/features/attendance/review-correction-dialog";
import { attendanceScope, attendanceTabs, isAttendanceManager } from "@/features/attendance/lib";

type Filter = "Pending" | "Approved" | "Rejected" | "All";

export default function AttendanceCorrectionsPage() {
  const { role, employee: me } = useAuth();
  const employees = useHRStore((s) => s.data.employees);
  const corrections = useHRStore((s) => s.data.corrections);
  const attendance = useHRStore((s) => s.data.attendance);
  const lookups = useLookups();
  const canApprove = can(role, "attendance.approve");

  const [filter, setFilter] = React.useState<Filter>("Pending");
  const [query, setQuery] = React.useState("");
  const [review, setReviewState] = React.useState<AttendanceCorrection | null>(null);
  const [decision, setDecision] = React.useState<"Approved" | "Rejected">("Approved");
  const setReview = (r: { correction: AttendanceCorrection; decision: "Approved" | "Rejected" } | null) => {
    if (r) setDecision(r.decision);
    setReviewState(r?.correction ?? null);
  };
  const [requestOpen, setRequestOpen] = React.useState(false);
  // Rows decided in this session stay visible on the Pending tab so the status change is obvious
  const [justDecided, setJustDecided] = React.useState<string[]>([]);

  const scopeIds = React.useMemo(() => new Set(attendanceScope(role, me, employees).map((e) => e.id)), [role, me, employees]);
  const scoped = React.useMemo(() => corrections.filter((c) => scopeIds.has(c.employeeId)), [corrections, scopeIds]);

  const counts = {
    Pending: scoped.filter((c) => c.status === "Pending").length,
    Approved: scoped.filter((c) => c.status === "Approved").length,
    Rejected: scoped.filter((c) => c.status === "Rejected").length,
    All: scoped.length,
  };

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return scoped
      .filter((c) => filter === "All" || c.status === filter || (filter === "Pending" && justDecided.includes(c.id)))
      .filter((c) => !q || [lookups.name(c.employeeId), c.id, c.employeeId, c.reason].some((v) => v.toLowerCase().includes(q)));
  }, [scoped, filter, query, lookups, justDecided]);

  if (!isAttendanceManager(role)) return <AccessDenied />;

  const recordOf = (c: AttendanceCorrection) => attendance.find((a) => a.employeeId === c.employeeId && a.date === c.date);
  const myPending = corrections.filter((c) => c.employeeId === me.id && c.status === "Pending").length;

  const columns: ColumnDef<AttendanceCorrection, unknown>[] = [
    {
      id: "employee",
      header: "Employee",
      accessorFn: (c) => lookups.name(c.employeeId),
      cell: ({ row }) => {
        const e = lookups.employee(row.original.employeeId);
        return (
          <div className="max-w-28 min-w-0 sm:max-w-none">
            <PersonCell name={lookups.name(row.original.employeeId)} sub={`${row.original.id} · ${lookups.deptName(e?.departmentId)}`} src={e?.avatar} seed={row.original.employeeId} />
            <div className="mt-1.5 flex flex-wrap items-center gap-2 pl-12 text-xs text-muted-foreground sm:hidden">
              <span className="tabular">{formatDate(row.original.date, "d MMM")} · {row.original.clockIn}–{row.original.clockOut}</span>
            </div>
          </div>
        );
      },
    },
    { accessorKey: "date", header: "Date", cell: ({ getValue }) => <span className="tabular whitespace-nowrap">{formatDate(getValue() as string, "EEE, d MMM")}</span>, meta: { className: "hidden sm:table-cell" } },
    {
      id: "requested",
      header: "Requested in / out",
      accessorFn: (c) => c.clockIn,
      cell: ({ row }) => (
        <span className="tabular whitespace-nowrap font-medium">
          {to12h(row.original.clockIn)} – {to12h(row.original.clockOut)}
        </span>
      ),
      meta: { className: "hidden sm:table-cell" },
    },
    {
      id: "original",
      header: "Original in / out",
      enableSorting: false,
      cell: ({ row }) => {
        const r = recordOf(row.original);
        return (
          <span className="tabular whitespace-nowrap text-muted-foreground">
            {r ? `${formatTime(r.clockIn)} – ${formatTime(r.clockOut)}` : "No record"}
          </span>
        );
      },
      meta: { className: "hidden xl:table-cell" },
    },
    {
      accessorKey: "reason",
      header: "Reason",
      cell: ({ row }) => (
        <div className="max-w-48">
          <p className="truncate" title={row.original.reason}>
            {row.original.reason}
          </p>
          {row.original.reviewerComment && (
            <p className="truncate text-xs text-muted-foreground" title={row.original.reviewerComment}>
              {lookups.name(row.original.reviewerId)}: {row.original.reviewerComment}
            </p>
          )}
        </div>
      ),
      meta: { className: "hidden lg:table-cell" },
    },
    { accessorKey: "createdAt", header: "Submitted", cell: ({ getValue }) => <span className="tabular whitespace-nowrap text-muted-foreground">{relativeTime(getValue() as string)}</span>, meta: { className: "hidden 2xl:table-cell" } },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusBadge status={getValue() as string} /> },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      meta: { align: "right" },
      cell: ({ row }) => {
        const c = row.original;
        if (c.status !== "Pending" || !canApprove) return null;
        if (c.employeeId === me.id) return <span className="text-xs text-muted-foreground">Your request</span>;
        return (
          <div className="flex justify-end gap-1 sm:gap-1.5">
            <Button size="sm" variant="outline" className="px-2.5 sm:px-3" aria-label={`Reject ${c.id}`} onClick={() => setReview({ correction: c, decision: "Rejected" })}>
              <X className="text-destructive" />
              <span className="hidden sm:inline">Reject</span>
            </Button>
            <Button size="sm" className="px-2.5 sm:px-3" aria-label={`Approve ${c.id}`} onClick={() => setReview({ correction: c, decision: "Approved" })}>
              <Check />
              <span className="hidden sm:inline">Approve</span>
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <FadeIn>
      <PageHeader
        title="Attendance corrections"
        description={role === "team_lead" ? "Review correction requests from your direct reports." : "Review correction requests from across the company."}
        actions={
          <Button variant="outline" onClick={() => setRequestOpen(true)}>
            <PencilLine /> Request correction
            {myPending > 0 && <span className="rounded-full bg-warning-soft px-1.5 text-xs text-warning-soft-foreground tabular">{myPending}</span>}
          </Button>
        }
      />
      <ModuleTabs tabs={attendanceTabs(role)} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <KpiCard label="Awaiting review" value={counts.Pending} icon={Clock} tone="warning" hint="Pending corrections" />
        <KpiCard label="Approved" value={counts.Approved} icon={CheckCircle2} tone="success" hint="Records updated" />
        <KpiCard label="Rejected" value={counts.Rejected} icon={XCircle} tone="danger" hint="Original record kept" />
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <Tabs
            value={filter}
            onValueChange={(v) => {
              setFilter(v as Filter);
              setJustDecided([]);
            }}
          >
            <TabsList aria-label="Filter corrections by status">
              {(["Pending", "Approved", "Rejected", "All"] as Filter[]).map((f) => (
                <TabsTrigger key={f} value={f}>
                  {f}
                  <span className="rounded-full bg-muted px-1.5 text-[11px] text-muted-foreground tabular data-[state=active]:bg-primary-soft">{counts[f]}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="relative lg:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, ID or reason…" className="pl-9" aria-label="Search corrections" />
          </div>
        </div>
        <DataTable
          label="Attendance corrections"
          columns={columns}
          data={filtered}
          getRowId={(c) => c.id}
          rowTestId={(c) => `correction-row-${c.id}`}
          initialSorting={[{ id: "createdAt", desc: true }]}
          emptyTitle={filter === "Pending" ? "No pending corrections" : "No corrections found"}
          emptyDescription={filter === "Pending" ? "You're all caught up — new requests will appear here." : "Try another status or search term."}
          emptyAction={
            filter !== "All" ? (
              <Button variant="outline" size="sm" onClick={() => setFilter("All")}>
                <ClipboardCheck /> View all requests
              </Button>
            ) : undefined
          }
        />
      </Card>

      <ReviewCorrectionDialog
        correction={review}
        decision={decision}
        onOpenChange={(o) => !o && setReview(null)}
        onDone={(id) => setJustDecided((ids) => [...ids, id])}
      />
      <CorrectionDialog open={requestOpen} onOpenChange={setRequestOpen} employeeId={me.id} />
    </FadeIn>
  );
}
