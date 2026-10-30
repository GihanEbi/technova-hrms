"use client";

// Shared page-level building blocks used by every module.
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Inbox, Loader2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, Badge, type BadgeVariant, Card, Skeleton } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/overlays";

// ---------------- Page header ----------------
export function PageHeader({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

// ---------------- Module tabs (route-aware) ----------------
export function ModuleTabs({ tabs }: { tabs: { href: string; label: string; icon?: LucideIcon; exact?: boolean; hidden?: boolean }[] }) {
  const pathname = usePathname();
  const visible = tabs.filter((t) => !t.hidden);
  return (
    <nav aria-label="Section navigation" className="scrollbar-thin mb-6 max-w-full overflow-x-auto border-b border-border">
      <ul className="flex min-w-max gap-1">
        {visible.map((t) => {
          const active = t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(`${t.href}/`);
          const Icon = t.icon;
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative inline-flex h-10 items-center gap-2 px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                  active && "text-foreground after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary",
                )}
              >
                {Icon && <Icon className="size-4" />}
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// ---------------- Page transition ----------------
export function FadeIn({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("animate-in fade-in-0 slide-in-from-bottom-1 duration-300 ease-out fill-mode-both", className)}>{children}</div>;
}

// ---------------- Empty & loading ----------------
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" />
      </div>
      <p className="text-sm font-semibold">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = "Loading…", fullScreen }: { label?: string; fullScreen?: boolean }) {
  return (
    <div className={cn("flex items-center justify-center gap-2 text-sm text-muted-foreground", fullScreen ? "min-h-dvh" : "py-16")} role="status">
      <Loader2 className="size-4 animate-spin" />
      {label}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}

// ---------------- KPI card ----------------
export function KpiCard({
  label,
  value,
  icon: Icon,
  hint,
  trend,
  href,
  tone = "primary",
  testId,
}: {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  hint?: React.ReactNode;
  trend?: { value: string; positive: boolean } | null;
  href?: string;
  tone?: "primary" | "success" | "warning" | "danger" | "info";
  testId?: string;
}) {
  const tones = {
    primary: "bg-primary-soft text-primary-soft-foreground",
    success: "bg-success-soft text-success-soft-foreground",
    warning: "bg-warning-soft text-warning-soft-foreground",
    danger: "bg-destructive-soft text-destructive-soft-foreground",
    info: "bg-info-soft text-info-soft-foreground",
  };
  const body = (
    <Card className={cn("h-full p-4 transition-shadow sm:p-5", href && "hover:border-primary/40 hover:shadow-md")} data-testid={testId}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", tones[tone])}>
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular">{value}</p>
      {(hint || trend) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {trend && (
            <span className={cn("inline-flex items-center gap-0.5 font-medium", trend.positive ? "text-success" : "text-destructive")}>
              {trend.positive ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
              {trend.value}
            </span>
          )}
          {hint}
        </div>
      )}
    </Card>
  );
  return href ? (
    <Link href={href} className="block rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40" aria-label={`${label}: open details`}>
      {body}
    </Link>
  ) : (
    body
  );
}

// ---------------- Status badge ----------------
const statusMap: Record<string, BadgeVariant> = {
  Active: "success",
  Present: "success",
  Approved: "success",
  Processed: "success",
  Submitted: "success",
  Completed: "success",
  Paid: "success",
  Probation: "info",
  "Pending Approval": "warning",
  Pending: "warning",
  Late: "warning",
  "Half Day": "info",
  "In Progress": "info",
  "Notice Period": "warning",
  Draft: "secondary",
  "Not Started": "secondary",
  Cancelled: "secondary",
  Archived: "secondary",
  Weekend: "secondary",
  Holiday: "info",
  "On Leave": "info",
  "Not clocked in": "secondary",
  Rejected: "destructive",
  Absent: "destructive",
};
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge variant={statusMap[status] ?? "secondary"} dot className={className}>
      {status}
    </Badge>
  );
}

// ---------------- Person cell ----------------
export function PersonCell({ name, sub, src, href, seed, size = "md" }: { name: string; sub?: string; src?: string | null; href?: string; seed?: string; size?: "sm" | "md" }) {
  const content = (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar name={name} src={src} seed={seed} className={size === "sm" ? "size-7 text-xs" : "size-9 text-sm"} />
      <div className="min-w-0">
        <p className={cn("truncate font-medium", href && "group-hover:text-primary")}>{name}</p>
        {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="group block min-w-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
      {content}
    </Link>
  ) : (
    content
  );
}

// ---------------- Confirm dialog ----------------
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  tone = "default",
  onConfirm,
  children,
  icon,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  tone?: "default" | "destructive" | "warning";
  onConfirm: () => void | Promise<void>;
  children?: React.ReactNode;
  icon?: LucideIcon;
}) {
  const [busy, setBusy] = React.useState(false);
  const Icon = icon ?? AlertTriangle;
  const toneCls = {
    default: "bg-primary-soft text-primary-soft-foreground",
    destructive: "bg-destructive-soft text-destructive-soft-foreground",
    warning: "bg-warning-soft text-warning-soft-foreground",
  }[tone];
  return (
    <AlertDialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <AlertDialogContent>
        <div className="flex gap-4">
          <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", toneCls)}>
            <Icon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>{description}</div>
            </AlertDialogDescription>
            {children}
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <Button
            variant={tone === "destructive" ? "destructive" : "default"}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                onOpenChange(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ---------------- Section card ----------------
export function SectionCard({ title, description, action, children, className, bodyClassName }: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          {description && <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      <div className={cn("flex-1 px-5 pb-5", bodyClassName)}>{children}</div>
    </Card>
  );
}

// ---------------- Description list ----------------
export function InfoGrid({ items, columns = 2 }: { items: { label: string; value: React.ReactNode }[]; columns?: 2 | 3 }) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-4", columns === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2")}>
      {items.map((i) => (
        <div key={i.label} className="min-w-0">
          <dt className="text-xs font-medium text-muted-foreground">{i.label}</dt>
          <dd className="mt-1 text-sm break-words">{i.value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

// ---------------- Timeline ----------------
export function Timeline({ items }: { items: { id: string; icon: LucideIcon; title: React.ReactNode; meta: string; tone?: "primary" | "success" | "warning" | "danger" | "info" }[] }) {
  const tones = {
    primary: "bg-primary-soft text-primary-soft-foreground",
    success: "bg-success-soft text-success-soft-foreground",
    warning: "bg-warning-soft text-warning-soft-foreground",
    danger: "bg-destructive-soft text-destructive-soft-foreground",
    info: "bg-info-soft text-info-soft-foreground",
  };
  return (
    <ol className="relative space-y-4">
      {items.map((it, idx) => {
        const Icon = it.icon;
        return (
          <li key={it.id} className="relative flex gap-3">
            {idx < items.length - 1 && <span className="absolute top-8 bottom-[-16px] left-[15px] w-px bg-border" aria-hidden />}
            <span className={cn("z-10 flex size-8 shrink-0 items-center justify-center rounded-full", tones[it.tone ?? "primary"])}>
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 pt-1">
              <p className="text-sm leading-snug">{it.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{it.meta}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ---------------- Access denied ----------------
export function AccessDenied() {
  return (
    <Card>
      <EmptyState
        icon={AlertTriangle}
        title="You don't have access to this page"
        description="Your current demo role can't open this module. Switch role from the profile menu to explore it."
        action={
          <Button asChild variant="outline">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        }
      />
    </Card>
  );
}
