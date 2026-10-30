"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Check, ClipboardCheck, Paperclip, Search, X } from "lucide-react";
import { useHRStore } from "@/store/hr-store";
import { useAuth, useLookups } from "@/hooks/use-hr";
import { can } from "@/lib/permissions";
import { formatDate, relativeTime } from "@/lib/dates";
import type { LeaveRequest, LeaveStatus } from "@/types";
import { Card, Input } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Tabs, TabsList, TabsTrigger } from "@/components/ui/overlays";
import { DataTable } from "@/components/tables/data-table";
import { AccessDenied, FadeIn, ModuleTabs, PageHeader, PersonCell, StatusBadge } from "@/components/shared/common";
import { LeaveTypeLabel } from "@/features/leave/components";
import { ReviewLeaveDialog } from "@/features/leave/review-leave-dialog";
import { formatRange, isLeaveManager, leaveApprovalScope, leaveTabs } from "@/features/leave/lib";

type Filter = LeaveStatus | "All";
const filters: Filter[] = ["Pending", "Approved", "Rejected", "Cancelled", "All"];

export default function LeaveRequestsPage() {
  const { role, employee: me } = useAuth();
  const employees = useHRStore((s) => s.data.employees);
  const leaveRequests = useHRStore((s) => s.data.leaveRequests);
  const leaveTypes = useHRStore((s) => s.data.leaveTypes);
  const lookups = useLookups();
  const canApprove = can(role, "leave.approve");

  const [filter, setFilter] = React.useState<Filter>("Pending");
  const [query, setQuery] = React.useState("");
  const [type, setType] = React.useState("all");
  const [review, setReview] = React.useState<LeaveRequest | null>(null);
  const [decision, setDecision] = React.useState<"Approved" | "Rejected">("Approved");
  // Requests decided during this visit stay on the Pending tab so the new status is visible
  const [justDecided, setJustDecided] = React.useState<string[]>([]);

  const scopeIds = React.useMemo(() => new Set(leaveApprovalScope(role, me, employees).map((e) => e.id)), [role, me, employees]);
  const scoped = React.useMemo(() => leaveRequests.filter((r) => scopeIds.has(r.employeeId)), [leaveRequests, scopeIds]);
  const counts = Object.fromEntries(filters.map((f) => [f, f === "All" ? scoped.length : scoped.filter((r) => r.status === f).length])) as Record<Filter, number>;

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return scoped
      .filter((r) => filter === "All" || r.status === filter || (filter === "Pending" && justDecided.includes(r.id)))
      .filter((r) => type === "all" || r.typeId === type)
      .filter((r) => !q || [lookups.name(r.employeeId), r.id, r.employeeId, r.reason].some((v) => v.toLowerCase().includes(q)));
  }, [scoped, filter, type, query, lookups, justDecided]);

  if (!isLeaveManager(role)) return <AccessDenied />;

  const typeOf = (id: string) => leaveTypes.find((t) => t.id === id);
  const open = (r: LeaveRequest, d: "Approved" | "Rejected") => {
    setDecision(d);
    setReview(r);
  };

  const columns: ColumnDef<LeaveRequest, unknown>[] = [
    {
      id: "employee",
      header: "Employee",
      accessorFn: (r) => lookups.name(r.employeeId),
      cell: ({ row }) => {
        const e = lookups.employee(row.original.employeeId);
        return (
          <div className="max-w-28 min-w-0 sm:max-w-none">
            <PersonCell name={lookups.name(row.original.employeeId)} sub={`${row.original.id} · ${lookups.deptName(e?.departmentId)}`} src={e?.avatar} seed={row.original.employeeId} />
            <div className="mt-1.5 flex flex-wrap items-center gap-2 pl-12 text-xs text-muted-foreground sm:hidden">
              <span className="tabular">{formatRange(row.original.startDate, row.original.endDate)}</span>
            </div>
          </div>
        );
      },
    },
    { id: "type", header: "Type", accessorFn: (r) => typeOf(r.typeId)?.name ?? "", cell: ({ row }) => <LeaveTypeLabel type={typeOf(row.original.typeId)} className="whitespace-nowrap" />, meta: { className: "hidden sm:table-cell" } },
    {
      id: "dates",
      header: "Dates",
      accessorFn: (r) => r.startDate,
      cell: ({ row }) => (
        <div className="whitespace-nowrap">
          <p className="tabular">{formatRange(row.original.startDate, row.original.endDate)}</p>
          {row.original.halfDay && <p className="text-xs text-muted-foreground">Half day · {row.original.halfDaySession}</p>}
        </div>
      ),
      meta: { className: "hidden sm:table-cell" },
    },
    { accessorKey: "days", header: "Days", cell: ({ getValue }) => <span className="tabular">{getValue() as number}</span>, meta: { align: "right", className: "hidden md:table-cell" } },
    {
      accessorKey: "reason",
      header: "Reason",
      cell: ({ row }) => (
        <div className="flex max-w-44 items-center gap-1.5">
          <p className="truncate" title={row.original.reason}>
            {row.original.reason || "—"}
          </p>
          {row.original.attachmentName && <Paperclip className="size-3.5 shrink-0 text-muted-foreground" aria-label="Has attachment" />}
        </div>
      ),
      meta: { className: "hidden xl:table-cell" },
    },
    { accessorKey: "createdAt", header: "Submitted", cell: ({ getValue }) => <span className="tabular whitespace-nowrap text-muted-foreground" title={formatDate(getValue() as string)}>{relativeTime(getValue() as string)}</span>, meta: { className: "hidden 2xl:table-cell" } },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusBadge status={getValue() as string} /> },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      meta: { align: "right" },
      cell: ({ row }) => {
        const r = row.original;
        if (r.status !== "Pending" || !canApprove) return null;
        if (r.employeeId === me.id) return <span className="text-xs text-muted-foreground">Your request</span>;
        return (
          <div className="flex justify-end gap-1 sm:gap-1.5">
            <Button size="sm" variant="outline" className="px-2.5 sm:px-3" aria-label={`Reject ${r.id}`} onClick={() => open(r, "Rejected")}>
              <X className="text-destructive" />
              <span className="hidden sm:inline">Reject</span>
            </Button>
            <Button size="sm" className="px-2.5 sm:px-3" aria-label={`Approve ${r.id}`} onClick={() => open(r, "Approved")}>
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
        title="Leave requests"
        description={role === "team_lead" ? "Approve or reject leave for the people who report to you." : "Review and decide on leave requests across the company."}
      />
      <ModuleTabs tabs={leaveTabs(role)} />

      <Card>
        <div className="flex flex-col gap-3 border-b border-border p-4 xl:flex-row xl:items-center xl:justify-between">
          <Tabs
            value={filter}
            onValueChange={(v) => {
              setFilter(v as Filter);
              setJustDecided([]);
            }}
          >
            <TabsList aria-label="Filter requests by status">
              {filters.map((f) => (
                <TabsTrigger key={f} value={f}>
                  {f}
                  <span className="rounded-full bg-muted px-1.5 text-[11px] text-muted-foreground tabular">{counts[f]}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative sm:flex-1 xl:w-64">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, ID or reason…" className="pl-9" aria-label="Search leave requests" />
            </div>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="sm:w-44" aria-label="Filter by leave type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All leave types</SelectItem>
                {leaveTypes.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DataTable
          label="Leave requests"
          columns={columns}
          data={filtered}
          getRowId={(r) => r.id}
          rowTestId={(r) => `leave-request-${r.id}`}
          initialSorting={filter === "Pending" ? [{ id: "dates", desc: false }] : [{ id: "createdAt", desc: true }]}
          emptyTitle={filter === "Pending" ? "No pending requests" : "No requests found"}
          emptyDescription={filter === "Pending" ? "You're all caught up — new leave requests will appear here." : "Try another status, type or search term."}
          emptyAction={
            filter !== "All" ? (
              <Button variant="outline" size="sm" onClick={() => setFilter("All")}>
                <ClipboardCheck /> View all requests
              </Button>
            ) : undefined
          }
        />
      </Card>

      <ReviewLeaveDialog request={review} decision={decision} onOpenChange={(o) => !o && setReview(null)} onDone={(id) => setJustDecided((ids) => [...ids, id])} />
    </FadeIn>
  );
}
