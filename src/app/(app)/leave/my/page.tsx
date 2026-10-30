"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { CalendarPlus, CalendarX2, X } from "lucide-react";
import { useHRStore } from "@/store/hr-store";
import { useAuth, useLookups } from "@/hooks/use-hr";
import { leaveBalances } from "@/lib/leave";
import { formatDate, now, todayKey } from "@/lib/dates";
import { simulate } from "@/services/mock-api";
import type { LeaveRequest, LeaveStatus } from "@/types";
import { Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/overlays";
import { DataTable } from "@/components/tables/data-table";
import { ConfirmDialog, FadeIn, ModuleTabs, PageHeader, StatusBadge } from "@/components/shared/common";
import { BalanceCard, LeaveTypeLabel } from "@/features/leave/components";
import { formatDays, formatRange, leaveTabs } from "@/features/leave/lib";

export default function MyLeavePage() {
  const { role, employee: me } = useAuth();
  const leaveTypes = useHRStore((s) => s.data.leaveTypes);
  const leaveRequests = useHRStore((s) => s.data.leaveRequests);
  const cancelLeave = useHRStore((s) => s.cancelLeave);
  const lookups = useLookups();
  const [status, setStatus] = React.useState<"all" | LeaveStatus>("all");
  const [toCancel, setToCancel] = React.useState<LeaveRequest | null>(null);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const tabs = leaveTabs(role);

  const year = now().getFullYear();
  const today = todayKey();
  const balances = React.useMemo(() => leaveBalances(me.id, leaveTypes, leaveRequests, year), [me.id, leaveTypes, leaveRequests, year]);
  const mine = React.useMemo(() => leaveRequests.filter((r) => r.employeeId === me.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [leaveRequests, me.id]);
  const filtered = status === "all" ? mine : mine.filter((r) => r.status === status);
  const typeOf = (id: string) => leaveTypes.find((t) => t.id === id);
  const canCancel = (r: LeaveRequest) => r.status === "Pending" || (r.status === "Approved" && r.startDate > today);

  const columns: ColumnDef<LeaveRequest, unknown>[] = [
    { accessorKey: "id", header: "Request", cell: ({ getValue }) => <span className="font-mono text-xs text-muted-foreground">{getValue() as string}</span>, meta: { className: "hidden sm:table-cell" } },
    { id: "type", header: "Type", accessorFn: (r) => typeOf(r.typeId)?.name ?? "", cell: ({ row }) => <LeaveTypeLabel type={typeOf(row.original.typeId)} />, meta: { className: "hidden sm:table-cell" } },
    {
      id: "dates",
      header: "Dates",
      accessorFn: (r) => r.startDate,
      cell: ({ row }) => (
        <div className="whitespace-nowrap">
          <p className="tabular">{formatRange(row.original.startDate, row.original.endDate)}</p>
          <p className="text-xs text-muted-foreground sm:hidden">
            {typeOf(row.original.typeId)?.name} · {row.original.days}d · {row.original.id}
          </p>
          {row.original.halfDay && <p className="text-xs text-muted-foreground">Half day · {row.original.halfDaySession}</p>}
        </div>
      ),
    },
    { accessorKey: "days", header: "Days", cell: ({ getValue }) => <span className="tabular">{getValue() as number}</span>, meta: { align: "right", className: "hidden sm:table-cell" } },
    {
      accessorKey: "reason",
      header: "Reason",
      cell: ({ row }) => (
        <div className="max-w-56">
          <p className="truncate" title={row.original.reason}>
            {row.original.reason || "—"}
          </p>
          {row.original.decisionComment && row.original.status !== "Pending" && (
            <p className="truncate text-xs text-muted-foreground" title={row.original.decisionComment}>
              {lookups.name(row.original.approverId)}: {row.original.decisionComment}
            </p>
          )}
        </div>
      ),
      meta: { className: "hidden lg:table-cell" },
    },
    { accessorKey: "createdAt", header: "Submitted", cell: ({ getValue }) => <span className="tabular whitespace-nowrap text-muted-foreground">{formatDate(getValue() as string, "d MMM yyyy")}</span>, meta: { className: "hidden md:table-cell" } },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusBadge status={getValue() as string} /> },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      meta: { align: "right" },
      cell: ({ row }) =>
        canCancel(row.original) ? (
          <Button variant="ghost" size="sm" aria-label={`Cancel ${row.original.id}`} onClick={() => {
              setToCancel(row.original);
              setCancelOpen(true);
            }}>
            <X /> <span className="hidden sm:inline">Cancel</span>
          </Button>
        ) : null,
    },
  ];

  return (
    <FadeIn>
      <PageHeader
        title="My Leave"
        description={`Your ${year} leave balances and requests.`}
        actions={
          <Button asChild>
            <Link href="/leave/apply">
              <CalendarPlus /> Apply leave
            </Link>
          </Button>
        }
      />
      {tabs.length > 1 && <ModuleTabs tabs={tabs} />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {balances.map((b) => (
          <BalanceCard key={b.type.id} balance={b} applyHref={`/leave/apply?type=${b.type.id}`} />
        ))}
      </div>

      <Card className="mt-6">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight">My requests</h2>
            <p className="text-[13px] text-muted-foreground">
              {mine.filter((r) => r.status === "Pending").length} pending · {mine.length} total
            </p>
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="sm:w-44" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Approved">Approved</SelectItem>
              <SelectItem value="Rejected">Rejected</SelectItem>
              <SelectItem value="Cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DataTable
          label="My leave requests"
          columns={columns}
          data={filtered}
          getRowId={(r) => r.id}
          rowTestId={(r) => `leave-row-${r.id}`}
          emptyTitle={status === "all" ? "No leave requests yet" : `No ${status.toLowerCase()} requests`}
          emptyDescription={status === "all" ? "When you apply for leave, your requests and their approval status appear here." : "Try a different status filter."}
        />
      </Card>

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        tone="destructive"
        icon={CalendarX2}
        title={`Cancel leave request ${toCancel?.id ?? ""}?`}
        description={
          toCancel ? (
            <p>
              {typeOf(toCancel.typeId)?.name} · {formatRange(toCancel.startDate, toCancel.endDate)} ({formatDays(toCancel.days)}). The days are returned to your balance
              {toCancel.status === "Approved" ? " and your manager is notified." : "."}
            </p>
          ) : (
            ""
          )
        }
        confirmLabel="Cancel request"
        onConfirm={async () => {
          if (!toCancel) return;
          const r = toCancel;
          await simulate(() => cancelLeave(r.id));
          toast.success("Leave request cancelled", { description: `${r.id} was cancelled and ${formatDays(r.days)} returned to your balance.` });
        }}
      />
    </FadeIn>
  );
}
