"use client";

import * as React from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { toast } from "sonner";
import { Bell, Check, Mail, Monitor, Moon, Sun, UserRound } from "lucide-react";
import { defaultNotificationPrefs, useHRStore } from "@/store/hr-store";
import { useAuth, useLookups } from "@/hooks/use-hr";
import { roleLabels } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { NotificationPreferences } from "@/types";
import { Avatar, Badge, Label, Switch } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/shared/common";

const themeOptions = [
  { value: "light", label: "Light", description: "Bright and crisp", icon: Sun },
  { value: "dark", label: "Dark", description: "Easy on the eyes", icon: Moon },
  { value: "system", label: "System", description: "Match your device", icon: Monitor },
] as const;

const prefItems: { key: keyof NotificationPreferences; label: string; description: string }[] = [
  { key: "leave", label: "Leave", description: "Requests, approvals and cancellations" },
  { key: "payroll", label: "Payroll", description: "Payroll runs and payslips" },
  { key: "attendance", label: "Attendance", description: "Corrections and attendance alerts" },
  { key: "performance", label: "Performance", description: "Reviews and evaluations" },
  { key: "employee", label: "Employee updates", description: "New joiners and profile changes" },
  { key: "system", label: "System", description: "Workspace announcements" },
];

export function PreferencesSettings() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const { user, employee } = useAuth();
  const lookups = useLookups();
  const stored = useHRStore((s) => (s.currentUserId ? s.notificationPrefs[s.currentUserId] : undefined));
  const setNotificationPrefs = useHRStore((s) => s.setNotificationPrefs);
  const prefs = stored ?? defaultNotificationPrefs;
  const current = mounted ? (theme ?? "system") : undefined;

  const toggle = (key: keyof NotificationPreferences, value: boolean, label: string) => {
    setNotificationPrefs({ ...prefs, [key]: value });
    toast.success("Notification preferences saved", { description: `${label} notifications ${value ? "turned on" : "turned off"}.` });
  };

  return (
    <div className="space-y-6">
      <SectionCard title="Appearance" description="Choose how TechNova HRMS looks on this device.">
        <RadioGroupPrimitive.Root
          aria-label="Theme"
          value={current}
          onValueChange={(v) => {
            setTheme(v);
            toast.success("Theme updated", { description: `${themeOptions.find((o) => o.value === v)?.label} theme applied.` });
          }}
          className="grid gap-3 sm:grid-cols-3"
        >
          {themeOptions.map((o) => {
            const selected = current === o.value;
            return (
              <RadioGroupPrimitive.Item
                key={o.value}
                value={o.value}
                aria-label={o.label}
                data-testid={`theme-option-${o.value}`}
                className={cn(
                  "group relative flex flex-col overflow-hidden rounded-xl border text-left outline-none transition-[border-color,box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring/30",
                  selected ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/40",
                )}
              >
                <ThemePreview variant={o.value} />
                <span className="flex items-center gap-3 border-t border-border bg-surface px-4 py-3">
                  <o.icon className="size-4 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{o.label}</span>
                    <span className="block text-xs text-muted-foreground">{o.description}</span>
                  </span>
                  <span className={cn("flex size-5 items-center justify-center rounded-full border", selected ? "border-primary bg-primary text-primary-foreground" : "border-input")}>
                    {selected && <Check className="size-3" strokeWidth={3} />}
                  </span>
                </span>
              </RadioGroupPrimitive.Item>
            );
          })}
        </RadioGroupPrimitive.Root>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="Your profile" description="Signed in to the demo workspace" className="min-w-0" action={<UserRound className="size-4 text-muted-foreground" />}>
          <div className="flex items-center gap-3">
            <Avatar name={`${employee.firstName} ${employee.lastName}`} src={employee.avatar} seed={employee.id} className="size-12" />
            <div className="min-w-0">
              <p className="truncate font-medium">
                {employee.firstName} {employee.lastName}
              </p>
              <p className="truncate text-sm text-muted-foreground">{employee.email}</p>
            </div>
          </div>
          <dl className="mt-4 space-y-2.5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Role</dt>
              <dd>
                <Badge>{roleLabels[user.role]}</Badge>
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Designation</dt>
              <dd className="truncate text-right">{lookups.desName(employee.designationId)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Employee ID</dt>
              <dd className="font-mono text-xs">{employee.id}</dd>
            </div>
          </dl>
          <Button asChild variant="outline" className="mt-5 w-full">
            <Link href="/profile">View profile</Link>
          </Button>
        </SectionCard>

        <SectionCard title="Notifications" description="Choose which in-app notifications you receive. Changes save automatically." className="min-w-0 lg:col-span-2" action={<Bell className="size-4 text-muted-foreground" />}>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {prefItems.map((p) => (
              <li key={p.key} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <Label htmlFor={`pref-${p.key}`}>{p.label}</Label>
                  <p className="mt-1 text-xs text-muted-foreground">{p.description}</p>
                </div>
                <Switch id={`pref-${p.key}`} checked={prefs[p.key]} onCheckedChange={(v) => toggle(p.key, v, p.label)} />
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-border bg-subtle px-4 py-3">
            <div className="flex min-w-0 items-start gap-3">
              <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <Label htmlFor="pref-emailDigest">Email digest</Label>
                <p className="mt-1 text-xs break-words text-muted-foreground">A daily summary of unread notifications sent to {employee.email}.</p>
              </div>
            </div>
            <Switch id="pref-emailDigest" checked={prefs.emailDigest} onCheckedChange={(v) => toggle("emailDigest", v, "Email digest")} />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function ThemePreview({ variant }: { variant: "light" | "dark" | "system" }) {
  const pane = (dark: boolean) => (
    <span className={cn("flex h-full flex-1 gap-1.5 p-2.5", dark ? "bg-slate-900" : "bg-slate-100")}>
      <span className={cn("w-6 rounded", dark ? "bg-slate-800" : "bg-white")} />
      <span className="flex flex-1 flex-col gap-1.5">
        <span className={cn("h-2 w-2/3 rounded", dark ? "bg-slate-700" : "bg-slate-300")} />
        <span className={cn("flex-1 rounded", dark ? "bg-slate-800" : "bg-white")}>
          <span className="m-1.5 block h-1.5 w-1/2 rounded bg-primary/70" />
        </span>
      </span>
    </span>
  );
  return (
    <span className="flex h-24 w-full" aria-hidden>
      {variant === "system" ? (
        <>
          {pane(false)}
          {pane(true)}
        </>
      ) : (
        pane(variant === "dark")
      )}
    </span>
  );
}
