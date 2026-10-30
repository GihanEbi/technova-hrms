"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BellOff, CheckCheck, Mail, MailOpen } from "lucide-react";
import { useHRStore } from "@/store/hr-store";
import { useMyNotifications } from "@/hooks/use-hr";
import { differenceInCalendarDays, now, parseISO, relativeTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { simulate } from "@/services/mock-api";
import type { AppNotification, NotificationType } from "@/types";
import { Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Tabs, TabsList, TabsTrigger } from "@/components/ui/overlays";
import { EmptyState, FadeIn, PageHeader } from "@/components/shared/common";
import { notificationIcons, notificationTones } from "@/components/layout/app-header";

export const notificationTypeLabels: Record<NotificationType, string> = {
  leave: "Leave",
  payroll: "Payroll",
  attendance: "Attendance",
  performance: "Performance",
  employee: "Employee",
  system: "System",
};

function groupOf(n: AppNotification) {
  const days = differenceInCalendarDays(now(), parseISO(n.createdAt));
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return "Earlier";
}

export function NotificationsCenter() {
  const router = useRouter();
  const list = useMyNotifications();
  const markRead = useHRStore((s) => s.markNotificationRead);
  const markAll = useHRStore((s) => s.markAllNotificationsRead);
  const [tab, setTab] = React.useState<"all" | "unread">("all");
  const [type, setType] = React.useState<"all" | NotificationType>("all");
  const [busy, setBusy] = React.useState(false);

  const unread = list.filter((n) => !n.read).length;
  const filtered = list.filter((n) => (tab === "all" || !n.read) && (type === "all" || n.type === type));
  const groups = (["Today", "Yesterday", "Earlier"] as const)
    .map((label) => ({ label, items: filtered.filter((n) => groupOf(n) === label) }))
    .filter((g) => g.items.length);

  return (
    <FadeIn>
      <PageHeader
        title="Notifications"
        description={unread ? `You have ${unread} unread notification${unread === 1 ? "" : "s"}.` : "You're all caught up."}
        actions={
          <Button
            variant="outline"
            disabled={!unread}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              const count = unread;
              await simulate(() => markAll(), 250);
              setBusy(false);
              toast.success("All notifications marked as read", { description: `${count} notification${count === 1 ? "" : "s"} updated.` });
            }}
          >
            <CheckCheck /> Mark all as read
          </Button>
        }
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "all" | "unread")}>
            <TabsList aria-label="Notification filter">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="unread">
                Unread
                {unread > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground tabular">{unread}</span>}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Select value={type} onValueChange={(v) => setType(v as "all" | NotificationType)}>
            <SelectTrigger className="sm:w-48" aria-label="Filter by type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {(Object.keys(notificationTypeLabels) as NotificationType[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {notificationTypeLabels[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {groups.length === 0 ? (
          <EmptyState
            icon={BellOff}
            title={tab === "unread" ? "No unread notifications" : "No notifications"}
            description={
              type !== "all" ? `There are no ${notificationTypeLabels[type].toLowerCase()} notifications to show.` : tab === "unread" ? "You've read everything. New updates will appear here." : "Updates about leave, payroll, attendance and reviews will appear here."
            }
            action={
              tab !== "all" || type !== "all" ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setTab("all");
                    setType("all");
                  }}
                >
                  Show all notifications
                </Button>
              ) : undefined
            }
          />
        ) : (
          groups.map((g) => (
            <section key={g.label} aria-label={g.label}>
              <h2 className="border-b border-border bg-subtle px-5 py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{g.label}</h2>
              <ul className="divide-y divide-border">
                {g.items.map((n) => (
                  <NotificationItem
                    key={n.id}
                    n={n}
                    onOpen={() => {
                      if (!n.read) markRead(n.id, true);
                      router.push(n.link);
                    }}
                    onToggle={() => {
                      markRead(n.id, !n.read);
                      toast.success(n.read ? "Marked as unread" : "Marked as read", { description: n.title });
                    }}
                  />
                ))}
              </ul>
            </section>
          ))
        )}
      </Card>
    </FadeIn>
  );
}

function NotificationItem({ n, onOpen, onToggle }: { n: AppNotification; onOpen: () => void; onToggle: () => void }) {
  const Icon = notificationIcons[n.type];
  return (
    <li className={cn("group relative flex items-start gap-3 px-5 py-4 transition-colors hover:bg-subtle", !n.read && "bg-primary-soft/30")} data-testid={`notification-${n.id}`}>
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-start gap-3 rounded-md text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30">
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", notificationTones[n.type])}>
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start gap-2">
            <span className={cn("flex-1 text-sm leading-snug", !n.read ? "font-semibold" : "font-medium")}>{n.title}</span>
            <span className="shrink-0 text-xs text-muted-foreground tabular">{relativeTime(n.createdAt)}</span>
          </span>
          <span className="mt-0.5 block text-[13px] text-muted-foreground">{n.message}</span>
          <span className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground/90">
            {notificationTypeLabels[n.type]}
            {!n.read && (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1 font-medium text-primary">
                  <span className="size-1.5 rounded-full bg-primary" aria-hidden /> Unread
                </span>
              </>
            )}
          </span>
        </span>
      </button>
      <Button variant="ghost" size="icon-sm" onClick={onToggle} aria-label={n.read ? "Mark as unread" : "Mark as read"} title={n.read ? "Mark as unread" : "Mark as read"} className="shrink-0">
        {n.read ? <Mail /> : <MailOpen />}
      </Button>
    </li>
  );
}
