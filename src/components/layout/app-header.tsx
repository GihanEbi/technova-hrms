"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  Bell,
  CalendarDays,
  ChevronRight,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Receipt,
  Search,
  Settings,
  Sun,
  User,
  CheckCheck,
  Clock,
  Wallet,
  Star,
  Users,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useHRStore } from "@/store/hr-store";
import { useLookups, useMyNotifications, useSession } from "@/hooks/use-hr";
import { relativeTime } from "@/lib/dates";
import { roleLabels } from "@/lib/permissions";
import { Avatar, Kbd } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/overlays";
import type { AppNotification, NotificationType } from "@/types";
import { segmentLabels } from "./nav-config";

// ---------------- Breadcrumbs ----------------
export function Breadcrumbs() {
  const pathname = usePathname();
  const lookups = useLookups();
  const evaluations = useHRStore((s) => s.data.evaluations);
  const segments = pathname.split("/").filter(Boolean);
  const crumbs = segments.map((seg, i) => {
    const href = "/" + segments.slice(0, i + 1).join("/");
    let label = segmentLabels[seg] ?? seg;
    if (/^EMP-\d+$/.test(seg)) label = lookups.name(seg);
    if (/^PS-/.test(seg)) label = seg.replace(/^PS-(\d{4}-\d{2})-.*/, "Payslip $1");
    if (/^EV-\d+$/.test(seg)) label = evaluations.find((e) => e.id === seg) ? `Evaluation ${seg}` : seg;
    if (seg === "my" && segments[i + 1] === undefined) label = `My ${segmentLabels[segments[i - 1]] ?? ""}`.trim();
    return { href, label };
  });
  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 sm:block">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        <li className="shrink-0">
          <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
            Home
          </Link>
        </li>
        {crumbs.map((c, i) => (
          <li key={c.href} className="flex min-w-0 items-center gap-1.5">
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" />
            {i === crumbs.length - 1 ? (
              <span className="truncate font-medium" aria-current="page">
                {c.label}
              </span>
            ) : (
              <Link href={c.href} className="truncate text-muted-foreground hover:text-foreground">
                {c.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

// ---------------- Search trigger ----------------
export function SearchBar({ onOpen }: { onOpen: () => void }) {
  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        className="hidden h-9 w-56 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm text-muted-foreground shadow-xs transition-colors hover:bg-accent lg:flex xl:w-72 dark:bg-subtle"
        aria-label="Search"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Search people, pages…</span>
        <Kbd>Ctrl K</Kbd>
      </button>
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpen} aria-label="Search">
        <Search />
      </Button>
    </>
  );
}

// ---------------- Theme switcher ----------------
export function ThemeSwitcher() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Change theme" data-testid="theme-switcher">
          {resolvedTheme === "dark" ? <Moon /> : <Sun />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light">
            <Sun /> Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon /> Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor /> System
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------- Notifications ----------------
export const notificationIcons: Record<NotificationType, typeof Bell> = {
  leave: CalendarDays,
  payroll: Wallet,
  attendance: Clock,
  performance: Star,
  employee: Users,
  system: Info,
};
export const notificationTones: Record<NotificationType, string> = {
  leave: "bg-info-soft text-info-soft-foreground",
  payroll: "bg-success-soft text-success-soft-foreground",
  attendance: "bg-warning-soft text-warning-soft-foreground",
  performance: "bg-primary-soft text-primary-soft-foreground",
  employee: "bg-primary-soft text-primary-soft-foreground",
  system: "bg-muted text-muted-foreground",
};

export function NotificationRow({ n, onClick, compact }: { n: AppNotification; onClick?: () => void; compact?: boolean }) {
  const Icon = notificationIcons[n.type];
  return (
    <div className={cn("flex gap-3", compact ? "px-3 py-2.5" : "px-5 py-4")} onClick={onClick}>
      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", notificationTones[n.type])}>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p className={cn("flex-1 text-sm leading-snug", !n.read && "font-semibold")}>{n.title}</p>
          {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
        </div>
        <p className={cn("mt-0.5 text-[13px] text-muted-foreground", compact && "line-clamp-2")}>{n.message}</p>
        <p className="mt-1 text-xs text-muted-foreground/80">{relativeTime(n.createdAt)}</p>
      </div>
    </div>
  );
}

export function NotificationDropdown() {
  const list = useMyNotifications();
  const unread = list.filter((n) => !n.read).length;
  const markRead = useHRStore((s) => s.markNotificationRead);
  const markAll = useHRStore((s) => s.markAllNotificationsRead);
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} data-testid="notifications-trigger">
          <Bell />
          {unread > 0 && (
            <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white tabular" data-testid="unread-count">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(92vw,380px)] p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <p className="text-sm font-semibold">Notifications</p>
          <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={!unread} onClick={() => markAll()}>
            <CheckCheck className="size-3.5" /> Mark all as read
          </Button>
        </div>
        <div className="scrollbar-thin max-h-[380px] overflow-y-auto">
          {list.length === 0 ? (
            <p className="px-3 py-10 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
          ) : (
            list.slice(0, 7).map((n) => (
              <DropdownMenuItem
                key={n.id}
                className="block rounded-none p-0 data-[highlighted]:bg-subtle"
                onSelect={() => {
                  markRead(n.id);
                  router.push(n.link);
                }}
              >
                <NotificationRow n={n} compact />
              </DropdownMenuItem>
            ))
          )}
        </div>
        <div className="border-t border-border p-1">
          <DropdownMenuItem className="justify-center text-sm font-medium text-primary" onSelect={() => router.push("/notifications")}>
            View all notifications
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------- User profile menu ----------------
export function UserProfileDropdown() {
  const { user, employee } = useSession();
  const demoUsers = useHRStore((s) => s.data.demoUsers);
  const employees = useHRStore((s) => s.data.employees);
  const login = useHRStore((s) => s.login);
  const logout = useHRStore((s) => s.logout);
  const router = useRouter();
  if (!user || !employee) return null;
  const name = `${employee.firstName} ${employee.lastName}`;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2.5 rounded-full p-0.5 outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/40 sm:rounded-lg sm:py-1 sm:pr-2.5 sm:pl-1"
          aria-label="Open user menu"
          data-testid="user-menu"
        >
          <Avatar name={name} src={employee.avatar} seed={employee.id} className="size-8 text-xs" />
          <span className="hidden min-w-0 text-left leading-tight sm:block">
            <span className="block max-w-36 truncate text-sm font-medium">{name}</span>
            <span className="block text-xs text-muted-foreground">{roleLabels[user.role]}</span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <div className="px-2 py-2">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{employee.email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/profile")}>
          <User /> My profile
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push("/leave/my")}>
          <CalendarDays /> My leave
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push("/payroll/payslips")}>
          <Receipt /> My payslips
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push("/settings")}>
          <Settings /> Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Switch demo role</DropdownMenuLabel>
        {demoUsers.map((u) => {
          const e = employees.find((x) => x.id === u.employeeId);
          const current = u.id === user.id;
          return (
            <DropdownMenuItem
              key={u.id}
              disabled={current}
              aria-label={`Switch to ${u.roleLabel}`}
              onSelect={() => {
                login(u.id);
                router.push("/dashboard");
                toast.success(`Switched to ${u.roleLabel}`, { description: `You're now viewing as ${e?.firstName} ${e?.lastName}.` });
              }}
            >
              <Avatar name={`${e?.firstName} ${e?.lastName}`} seed={e?.id} className="size-6 text-[10px]" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm">{u.roleLabel}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {e?.firstName} {e?.lastName}
                </span>
              </span>
              {current && <span className="text-[10px] font-medium text-primary uppercase">Current</span>}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            logout();
            router.replace("/login");
          }}
        >
          <LogOut /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------- Header ----------------
export function AppHeader({ onOpenMobileNav, onOpenSearch }: { onOpenMobileNav: () => void; onOpenSearch: () => void }) {
  return (
    <header className="no-print sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md sm:px-6 lg:px-8">
      <Button variant="ghost" size="icon" className="-ml-1 md:hidden" onClick={onOpenMobileNav} aria-label="Open navigation" data-testid="mobile-nav-trigger">
        <Menu />
      </Button>
      <div className="min-w-0 flex-1">
        <Breadcrumbs />
      </div>
      <div className="flex items-center gap-1 sm:gap-1.5">
        <SearchBar onOpen={onOpenSearch} />
        <NotificationDropdown />
        <ThemeSwitcher />
        <div className="mx-1 hidden h-6 w-px bg-border sm:block" />
        <UserProfileDropdown />
      </div>
    </header>
  );
}
