"use client";

// Self-contained "today" attendance widget: live status, clock in / clock out and worked time.
// Used on /attendance/my and on the dashboards.
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, CalendarOff, Clock, LogIn, LogOut, Palmtree, Timer } from "lucide-react";
import { useHRStore } from "@/store/hr-store";
import { simulate } from "@/services/mock-api";
import { formatTime, minutesToHours, now, toDateKey, workedMinutes, format } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/common";
import { describeDay } from "./lib";

function useNowTick(intervalMs = 15_000) {
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    const t = window.setInterval(() => setTick((x) => x + 1), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now();
}

export function ClockCard({ employeeId, className }: { employeeId: string; className?: string }) {
  const pathname = usePathname();
  const current = useNowTick();
  const today = toDateKey(current);
  const record = useHRStore((s) => s.data.attendance.find((a) => a.employeeId === employeeId && a.date === today));
  const settings = useHRStore((s) => s.data.leaveSettings);
  const holidays = useHRStore((s) => s.data.holidays);
  const leave = useHRStore((s) =>
    s.data.leaveRequests.find((r) => r.employeeId === employeeId && r.status === "Approved" && r.startDate <= today && r.endDate >= today),
  );
  const clockIn = useHRStore((s) => s.clockIn);
  const clockOut = useHRStore((s) => s.clockOut);
  const [busy, setBusy] = React.useState<"in" | "out" | null>(null);

  const day = describeDay(today, settings, holidays);
  const fullDayLeave = !!leave && !leave.halfDay;
  const recordLeave = record?.status === "On Leave" && !record.clockIn;
  const onLeave = fullDayLeave || recordLeave;
  const clockedIn = !!record?.clockIn;
  const clockedOut = !!record?.clockOut;
  const blockedReason = !day.working
    ? day.kind === "holiday"
      ? `Today is a public holiday (${day.label}). Attendance isn't recorded.`
      : `Today is ${day.label} — not a working day.`
    : onLeave
      ? "You're on approved leave today, so clock-in is disabled."
      : null;

  const minutes = clockedIn ? (clockedOut ? workedMinutes(record!.clockIn, record!.clockOut) : workedMinutes(record!.clockIn, current.toISOString())) : 0;

  let statusText: string;
  if (clockedIn && clockedOut) statusText = `Completed — ${minutesToHours(minutes)}`;
  else if (clockedIn) statusText = `Working since ${formatTime(record!.clockIn)}`;
  else if (!day.working) statusText = day.kind === "holiday" ? `Holiday — ${day.label}` : `No working day — ${day.label}`;
  else if (onLeave) statusText = "On leave today";
  else if (record?.status === "Absent") statusText = "Marked absent";
  else statusText = "Not clocked in";

  const [h, m] = settings.workdayStart.split(":").map(Number);
  const lateAfterMins = h * 60 + m + settings.graceMinutes;
  const lateAfter = format(new Date(2000, 0, 1, Math.floor(lateAfterMins / 60), lateAfterMins % 60), "hh:mm a");

  const doClockIn = async () => {
    setBusy("in");
    try {
      await simulate(() => clockIn(employeeId));
      const rec = useHRStore.getState().data.attendance.find((a) => a.employeeId === employeeId && a.date === today);
      const late = rec?.status === "Late";
      toast.success("Clocked in", {
        description: `You clocked in at ${formatTime(rec?.clockIn ?? now().toISOString())}${late ? ` — marked late (after ${lateAfter})` : ". Have a productive day!"}`,
      });
    } finally {
      setBusy(null);
    }
  };
  const doClockOut = async () => {
    setBusy("out");
    try {
      await simulate(() => clockOut(employeeId));
      const rec = useHRStore.getState().data.attendance.find((a) => a.employeeId === employeeId && a.date === today);
      const worked = rec ? workedMinutes(rec.clockIn, rec.clockOut) : 0;
      toast.success("Clocked out", { description: `You worked ${minutesToHours(worked)} today.` });
    } finally {
      setBusy(null);
    }
  };

  const state: "idle" | "working" | "done" | "blocked" = clockedIn ? (clockedOut ? "done" : "working") : blockedReason ? "blocked" : "idle";
  const iconTone = {
    idle: "bg-muted text-muted-foreground",
    working: "bg-success-soft text-success-soft-foreground",
    done: "bg-primary-soft text-primary-soft-foreground",
    blocked: "bg-info-soft text-info-soft-foreground",
  }[state];
  const StateIcon = state === "working" ? Timer : state === "done" ? Clock : onLeave ? Palmtree : !day.working ? CalendarOff : Clock;
  const showLink = pathname !== "/attendance/my";

  return (
    <Card className={cn("flex flex-col p-5", className)} data-testid="clock-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-muted-foreground">Today · {format(current, "EEEE, d MMM yyyy")}</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight tabular" aria-label={`Current time ${format(current, "hh:mm a")}`}>
            {format(current, "hh:mm")}
            <span className="ml-1 text-base font-medium text-muted-foreground">{format(current, "a")}</span>
          </p>
        </div>
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", iconTone)}>
          <StateIcon className="size-5" />
        </span>
      </div>

      <div className="mt-4 rounded-lg border border-border bg-subtle px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold" data-testid="today-status" aria-live="polite">
            {statusText}
          </p>
          {clockedIn && record && <StatusBadge status={record.status} />}
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div>
            <dt className="text-muted-foreground">Clock in</dt>
            <dd className="mt-0.5 font-medium text-foreground tabular">{formatTime(record?.clockIn)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Clock out</dt>
            <dd className="mt-0.5 font-medium text-foreground tabular">{formatTime(record?.clockOut)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Worked</dt>
            <dd className="mt-0.5 font-medium text-foreground tabular">{clockedIn ? minutesToHours(minutes) : "—"}</dd>
          </div>
        </dl>
      </div>

      {blockedReason && !clockedIn ? (
        <p className="mt-3 text-xs text-muted-foreground">{blockedReason}</p>
      ) : !clockedIn ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Workday starts at {format(new Date(2000, 0, 1, h, m), "hh:mm a")}. Clock-ins after {lateAfter} are marked late.
          {leave?.halfDay ? ` You have approved half-day leave (${leave.halfDaySession?.toLowerCase() ?? "morning"}) today.` : ""}
        </p>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button onClick={doClockIn} disabled={clockedIn || !!blockedReason || busy !== null} loading={busy === "in"}>
          {busy !== "in" && <LogIn />}
          Clock in
        </Button>
        <Button variant="outline" onClick={doClockOut} disabled={!clockedIn || clockedOut || busy !== null} loading={busy === "out"}>
          {busy !== "out" && <LogOut />}
          Clock out
        </Button>
      </div>

      {showLink && (
        <Link href="/attendance/my" className="mt-4 inline-flex items-center gap-1 self-start text-sm font-medium text-primary hover:underline">
          View my attendance <ArrowRight className="size-3.5" />
        </Link>
      )}
    </Card>
  );
}
