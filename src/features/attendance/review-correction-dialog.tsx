"use client";

import * as React from "react";
import { toast } from "sonner";
import { CheckCircle2, XCircle } from "lucide-react";
import { useHRStore } from "@/store/hr-store";
import { useLookups } from "@/hooks/use-hr";
import { simulate } from "@/services/mock-api";
import { formatDate, formatDateTime, formatTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { AttendanceCorrection } from "@/types";
import { Textarea } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { Field } from "@/components/forms/fields";
import { InfoGrid, PersonCell, StatusBadge } from "@/components/shared/common";

function to12h(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${String(hh).padStart(2, "0")}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function ReviewCorrectionDialog({
  correction: active,
  decision,
  onOpenChange,
  onDone,
}: {
  correction: AttendanceCorrection | null;
  decision: "Approved" | "Rejected";
  onOpenChange: (open: boolean) => void;
  onDone?: (id: string) => void;
}) {
  const lookups = useLookups();
  // Keep showing the last correction while the dialog animates closed
  const [correction, setCorrection] = React.useState<AttendanceCorrection | null>(active);
  React.useEffect(() => {
    if (active) setCorrection(active);
  }, [active]);
  const reviewCorrection = useHRStore((s) => s.reviewCorrection);
  const record = useHRStore((s) => (correction ? s.data.attendance.find((a) => a.employeeId === correction.employeeId && a.date === correction.date) : undefined));
  const [comment, setComment] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const approve = decision === "Approved";

  React.useEffect(() => {
    if (active) {
      setComment("");
      setError(null);
    }
  }, [active]);

  const emp = correction ? lookups.employee(correction.employeeId) : undefined;
  const name = correction ? lookups.name(correction.employeeId) : "";

  const confirm = async () => {
    if (!correction) return;
    if (!approve && comment.trim().length < 3) {
      setError("Add a comment explaining why the request is rejected.");
      return;
    }
    setBusy(true);
    try {
      await simulate(() => reviewCorrection(correction.id, decision, comment.trim()));
      toast.success(approve ? "Correction approved" : "Correction rejected", {
        description: approve
          ? `${name}'s attendance for ${formatDate(correction.date, "d MMM")} was updated to ${to12h(correction.clockIn)} – ${to12h(correction.clockOut)}.`
          : `${name} has been notified that ${correction.id} was rejected.`,
      });
      onDone?.(correction.id);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!active} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{approve ? "Approve correction" : "Reject correction"}</DialogTitle>
          <DialogDescription>
            {approve
              ? "Approving replaces the recorded clock-in and clock-out with the requested times."
              : "The employee will be notified and their original attendance record stays unchanged."}
          </DialogDescription>
        </DialogHeader>
        {correction && (
          <DialogBody className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <PersonCell name={name} sub={`${correction.id} · ${lookups.deptName(emp?.departmentId)}`} src={emp?.avatar} seed={correction.employeeId} />
              <StatusBadge status={correction.status} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border bg-subtle p-3">
                <p className="text-xs font-medium text-muted-foreground">Recorded</p>
                <p className="mt-1 text-sm font-medium tabular">
                  {formatTime(record?.clockIn)} – {formatTime(record?.clockOut)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{record ? record.status : "No record"}</p>
              </div>
              <div className={cn("rounded-lg border p-3", approve ? "border-success/30 bg-success-soft" : "border-border bg-subtle")}>
                <p className="text-xs font-medium text-muted-foreground">Requested</p>
                <p className="mt-1 text-sm font-medium tabular">
                  {to12h(correction.clockIn)} – {to12h(correction.clockOut)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">Source: correction</p>
              </div>
            </div>
            <InfoGrid
              items={[
                { label: "Date", value: <span className="tabular">{formatDate(correction.date, "EEEE, d MMM yyyy")}</span> },
                { label: "Submitted", value: <span className="tabular">{formatDateTime(correction.createdAt)}</span> },
                { label: "Reason", value: correction.reason },
              ]}
            />
            <Field label="Comment" htmlFor="correction-review-comment" required={!approve} error={error ?? undefined} hint={approve ? "Optional — shared with the employee." : "Required — explain the rejection."}>
              <Textarea
                id="correction-review-comment"
                rows={3}
                value={comment}
                aria-invalid={!!error}
                onChange={(e) => {
                  setComment(e.target.value);
                  if (error) setError(null);
                }}
                placeholder={approve ? "e.g. Confirmed with the access log." : "e.g. Access logs show a later arrival."}
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
            {approve ? "Approve correction" : "Reject correction"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { to12h };
