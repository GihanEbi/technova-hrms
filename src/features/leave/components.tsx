"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import type { LeaveType } from "@/types";
import type { LeaveBalance } from "@/lib/leave";
import { cn } from "@/lib/utils";
import { Badge, Card, Progress } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { formatDays, leaveColor } from "./lib";

export function LeaveTypeLabel({ type, className }: { type: LeaveType | undefined; className?: string }) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <span className="size-2 shrink-0 rounded-full" style={{ background: leaveColor(type) }} aria-hidden />
      <span className="truncate">{type?.name ?? "Leave"}</span>
    </span>
  );
}

function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function BalanceCard({ balance, applyHref }: { balance: LeaveBalance; applyHref?: string }) {
  const { type, allocation, used, pending, available } = balance;
  const unlimited = allocation === 0;
  const usedPct = unlimited ? 0 : (used / allocation) * 100;
  const pendingPct = unlimited ? 0 : (pending / allocation) * 100;
  return (
    <Card className="flex flex-col p-4 sm:p-5" data-testid={`balance-${type.id}`}>
      <div className="flex items-start justify-between gap-2">
        <LeaveTypeLabel type={type} className="text-[13px] font-medium text-muted-foreground" />
        <Badge variant={type.paid ? "success" : "secondary"}>{type.paid ? "Paid" : "Unpaid"}</Badge>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight tabular">
        {unlimited ? (
          "No limit"
        ) : (
          <>
            {fmt(available)}
            <span className="text-base font-medium text-muted-foreground"> / {allocation} days</span>
          </>
        )}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{unlimited ? `${formatDays(used)} taken this year` : "available this year"}</p>
      {!unlimited && (
        <div className="relative mt-3 h-2 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={`${fmt(used)} used, ${fmt(pending)} pending of ${allocation} days`}>
          <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(100, usedPct)}%`, background: leaveColor(type) }} />
          <div
            className="absolute inset-y-0 rounded-full opacity-40"
            style={{ left: `${Math.min(100, usedPct)}%`, width: `${Math.min(100 - usedPct, pendingPct)}%`, background: leaveColor(type) }}
          />
        </div>
      )}
      {unlimited && <Progress value={0} className="mt-3" aria-label="Unpaid leave has no limit" />}
      <div className="mt-3 flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">
          Used <span className="font-medium text-foreground tabular">{fmt(used)}</span> · Pending <span className="font-medium text-foreground tabular">{fmt(pending)}</span>
        </span>
        {applyHref && (
          <Button asChild variant="ghost" size="sm" className="-mr-2 h-7 px-2">
            <Link href={applyHref} aria-label={`Request ${type.name}`}>
              <Plus /> Request
            </Link>
          </Button>
        )}
      </div>
    </Card>
  );
}
