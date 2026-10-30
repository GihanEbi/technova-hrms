"use client";

import * as React from "react";
import { toast } from "sonner";
import { CheckCircle2, Paperclip, Users, XCircle } from "lucide-react";
import { useHRStore } from "@/store/hr-store";
import { useLookups } from "@/hooks/use-hr";
import { simulate } from "@/services/mock-api";
import { balanceFor, leaveBalances } from "@/lib/leave";
import { formatDateTime, rangesOverlap } from "@/lib/dates";
import type { LeaveRequest } from "@/types";
import { Textarea } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { Field } from "@/components/forms/fields";
import { InfoGrid, PersonCell, StatusBadge } from "@/components/shared/common";
import { LeaveTypeLabel } from "./components";
import { formatDays, formatRange } from "./lib";

function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function ReviewLeaveDialog({
  request: active,
  decision,
  onOpenChange,
  onDone,
}: {
  request: LeaveRequest | null;
  decision: "Approved" | "Rejected";
  onOpenChange: (open: boolean) => void;
  onDone?: (id: string) => void;
}) {
  const lookups = useLookups();
  const employees = useHRStore((s) => s.data.employees);
  const leaveTypes = useHRStore((s) => s.data.leaveTypes);
  const leaveRequests = useHRStore((s) => s.data.leaveRequests);
  const decideLeave = useHRStore((s) => s.decideLeave);
  // Keep showing the last request while the dialog animates closed
  const [request, setRequest] = React.useState<LeaveRequest | null>(active);
  const [comment, setComment] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (active) {
      setRequest(active);
      setComment("");
      setError(null);
    }
  }, [active]);
  const approve = decision === "Approved";

  const emp = request ? lookups.employee(request.employeeId) : undefined;
  const type = request ? leaveTypes.find((t) => t.id === request.typeId) : undefined;
  const balance = request ? balanceFor(leaveBalances(request.employeeId, leaveTypes, leaveRequests, Number(request.startDate.slice(0, 4))), request.typeId) : undefined;
  const unlimited = !balance || balance.available === Infinity;

  const overlapping = React.useMemo(() => {
    if (!request || !emp) return [];
    const teammates = new Set(
      employees.filter((e) => !e.archived && e.id !== emp.id && (emp.managerId ? e.managerId === emp.managerId || e.id === emp.managerId : e.departmentId === emp.departmentId)).map((e) => e.id),
    );
    return leaveRequests.filter(
      (r) => teammates.has(r.employeeId) && (r.status === "Approved" || r.status === "Pending") && rangesOverlap(r.startDate, r.endDate, request.startDate, request.endDate),
    );
  }, [request, emp, employees, leaveRequests]);

  const name = request ? lookups.name(request.employeeId) : "";

  const confirm = async () => {
    if (!request) return;
    if (!approve && comment.trim().length < 3) {
      setError("Add a comment explaining why the request is rejected.");
      return;
    }
    setBusy(true);
    try {
      await simulate(() => decideLeave(request.id, decision, comment.trim()));
      toast.success(approve ? "Leave request approved" : "Leave request rejected", {
        description: `${name}'s ${type?.name.toLowerCase() ?? "leave"} (${formatRange(request.startDate, request.endDate)}) was ${approve ? "approved" : "rejected"}.`,
      });
      onDone?.(request.id);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!active} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{approve ? "Approve leave request" : "Reject leave request"}</DialogTitle>
          <DialogDescription>
            {request ? `${request.id} · ` : ""}
            {approve ? "The employee is notified and the days are deducted from their balance." : "The employee is notified and the days are returned to their balance."}
          </DialogDescription>
        </DialogHeader>
        {request && (
          <DialogBody className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <PersonCell name={name} sub={`${lookups.desName(emp?.designationId)} · ${lookups.deptName(emp?.departmentId)}`} src={emp?.avatar} seed={request.employeeId} />
              <StatusBadge status={request.status} />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-subtle p-3">
                <p className="text-xs text-muted-foreground">Requested</p>
                <p className="mt-1 text-lg font-semibold tabular">{formatDays(request.days)}</p>
                <p className="text-xs text-muted-foreground tabular">{formatRange(request.startDate, request.endDate)}</p>
              </div>
              <div className="rounded-lg border border-border bg-subtle p-3">
                <p className="text-xs text-muted-foreground">Balance now</p>
                <p className="mt-1 text-lg font-semibold tabular" data-testid="review-balance">
                  {unlimited ? "No limit" : `${fmt(balance!.available + request.days)} days`}
                </p>
                <p className="text-xs text-muted-foreground tabular">{unlimited ? "Unpaid leave" : `of ${balance!.allocation} · ${fmt(balance!.used)} used`}</p>
              </div>
              <div className={approve ? "rounded-lg border border-success/30 bg-success-soft p-3" : "rounded-lg border border-border bg-subtle p-3"}>
                <p className="text-xs text-muted-foreground">Remaining after approval</p>
                <p className="mt-1 text-lg font-semibold tabular">{unlimited ? "No limit" : `${fmt(balance!.available)} days`}</p>
                <p className="text-xs text-muted-foreground">{type?.paid ? "Paid leave" : "Deducted in payroll"}</p>
              </div>
            </div>

            <InfoGrid
              items={[
                { label: "Leave type", value: <LeaveTypeLabel type={type} /> },
                { label: "Session", value: request.halfDay ? `Half day · ${request.halfDaySession}` : "Full day(s)" },
                { label: "Reason", value: request.reason },
                { label: "Submitted", value: <span className="tabular">{formatDateTime(request.createdAt)}</span> },
                ...(request.attachmentName
                  ? [{ label: "Attachment", value: <span className="inline-flex items-center gap-1.5"><Paperclip className="size-3.5 text-muted-foreground" />{request.attachmentName}</span> }]
                  : []),
              ]}
            />

            <div>
              <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                <Users className="size-4 text-muted-foreground" /> Overlapping team leave
              </p>
              {overlapping.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-3 py-2.5 text-[13px] text-muted-foreground">Nobody else in the team is off during these dates.</p>
              ) : (
                <ul className="divide-y divide-border rounded-lg border border-border" data-testid="review-overlaps">
                  {overlapping.map((o) => {
                    const e = lookups.employee(o.employeeId);
                    return (
                      <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                        <PersonCell size="sm" name={lookups.name(o.employeeId)} sub={`${leaveTypes.find((t) => t.id === o.typeId)?.name} · ${formatRange(o.startDate, o.endDate)}`} src={e?.avatar} seed={o.employeeId} />
                        <StatusBadge status={o.status} />
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <Field label="Comment" htmlFor="leave-decision-comment" required={!approve} error={error ?? undefined} hint={approve ? "Optional — shared with the employee." : "Required — explain the rejection."}>
              <Textarea
                id="leave-decision-comment"
                rows={3}
                value={comment}
                aria-invalid={!!error}
                onChange={(e) => {
                  setComment(e.target.value);
                  if (error) setError(null);
                }}
                placeholder={approve ? "e.g. Approved — enjoy your time off." : "e.g. The team is at minimum capacity that week."}
              />
            </Field>
          </DialogBody>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant={approve ? "success" : "destructive"} onClick={confirm} loading={busy}>
            {!busy && (approve ? <CheckCircle2 /> : <XCircle />)}
            {approve ? "Approve request" : "Reject request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
