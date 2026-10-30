"use client";

import { CalendarCheck, Clock, Info, Paperclip, Timer } from "lucide-react";
import { useHRStore } from "@/store/hr-store";
import { useAuth } from "@/hooks/use-hr";
import { format, formatDate, now, todayKey } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle, Badge, Card } from "@/components/ui/primitives";
import { FadeIn, ModuleTabs, PageHeader, SectionCard } from "@/components/shared/common";
import { leaveColor, leaveTabs } from "@/features/leave/lib";

const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function to12h(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return format(new Date(2000, 0, 1, h, m), "hh:mm a");
}

export default function LeavePoliciesPage() {
  const { role } = useAuth();
  const leaveTypes = useHRStore((s) => s.data.leaveTypes);
  const settings = useHRStore((s) => s.data.leaveSettings);
  const holidays = useHRStore((s) => s.data.holidays);
  const tabs = leaveTabs(role);
  const year = now().getFullYear();
  const today = todayKey();
  const yearHolidays = holidays.filter((h) => h.date.startsWith(String(year))).sort((a, b) => a.date.localeCompare(b.date));
  const remaining = yearHolidays.filter((h) => h.date >= today).length;

  const workingDays = [1, 2, 3, 4, 5, 6, 0].filter((d) => settings.workingDays.includes(d)).map((d) => weekdayNames[d]);
  const workingLabel =
    workingDays.length === 5 && workingDays[0] === "Monday" && workingDays[4] === "Friday" ? "Monday – Friday" : workingDays.join(", ");

  return (
    <FadeIn>
      <PageHeader title="Leave policies" description="Leave entitlements, working-day rules and the public holiday calendar." />
      {tabs.length > 1 && <ModuleTabs tabs={tabs} />}

      <Alert variant="info" className="mb-6">
        <Info />
        <div>
          <AlertTitle>Illustrative company policy</AlertTitle>
          <AlertDescription>These values are sample policy for the TechNova demo. They drive balance, validation and payroll calculations throughout the app.</AlertDescription>
        </div>
      </Alert>

      <h2 className="mb-3 text-[15px] font-semibold tracking-tight">Leave types</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {leaveTypes.map((t) => (
          <Card key={t.id} className="flex flex-col p-5" data-testid={`policy-${t.id}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="size-3 shrink-0 rounded-full" style={{ background: leaveColor(t) }} aria-hidden />
                <h3 className="truncate text-[15px] font-semibold tracking-tight">{t.name}</h3>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <Badge variant={t.paid ? "success" : "secondary"}>{t.paid ? "Paid" : "Unpaid"}</Badge>
                {!t.active && <Badge variant="outline">Inactive</Badge>}
              </div>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{t.description}</p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div className="rounded-lg bg-subtle px-3 py-2">
                <dt className="text-xs text-muted-foreground">Allocation</dt>
                <dd className="mt-0.5 font-semibold tabular">{t.allocation === 0 ? "No limit" : `${t.allocation} days`}</dd>
              </div>
              <div className="rounded-lg bg-subtle px-3 py-2">
                <dt className="text-xs text-muted-foreground">Notice</dt>
                <dd className="mt-0.5 font-semibold tabular">{t.noticeDays ? `${t.noticeDays} days` : "None"}</dd>
              </div>
              <div className="rounded-lg bg-subtle px-3 py-2">
                <dt className="text-xs text-muted-foreground">Max consecutive</dt>
                <dd className="mt-0.5 font-semibold tabular">{t.maxConsecutive} days</dd>
              </div>
              <div className="rounded-lg bg-subtle px-3 py-2">
                <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Paperclip className="size-3" /> Attachment
                </dt>
                <dd className="mt-0.5 font-semibold">{t.requiresAttachmentAfter ? `> ${t.requiresAttachmentAfter} days` : "Not needed"}</dd>
              </div>
            </dl>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SectionCard title="Working-day rules" description="Used for leave day counts and attendance status." className="min-w-0">
          <ul className="space-y-4 text-sm">
            <li className="flex gap-3">
              <CalendarCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="font-medium">Working weekdays</p>
                <p className="text-muted-foreground">{workingLabel}</p>
              </div>
            </li>
            <li className="flex gap-3">
              <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="font-medium">Workday hours</p>
                <p className="text-muted-foreground tabular">
                  {to12h(settings.workdayStart)} – {to12h(settings.workdayEnd)}
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <Timer className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="font-medium">Late grace period</p>
                <p className="text-muted-foreground">
                  {settings.graceMinutes} minutes — clock-ins after {to12h(settings.workdayStart)} + {settings.graceMinutes} min are marked late.
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="font-medium">Half day</p>
                <p className="text-muted-foreground">{settings.halfDayHours} hours · counts as 0.5 leave days</p>
              </div>
            </li>
            <li className="flex gap-3">
              <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="font-medium">Day counting</p>
                <p className="text-muted-foreground">Weekends and public holidays inside a leave period are not deducted from balances.</p>
              </div>
            </li>
          </ul>
        </SectionCard>

        <SectionCard title={`Public holidays ${year}`} description={`${yearHolidays.length} holidays · ${remaining} remaining`} className="min-w-0 lg:col-span-2">
          <ul className="divide-y divide-border" data-testid="holiday-list">
            {yearHolidays.map((h) => {
              const past = h.date < today;
              return (
                <li key={h.date} className={cn("flex items-center justify-between gap-3 py-2.5 text-sm", past && "text-muted-foreground")}>
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="w-24 shrink-0 tabular sm:w-28">{formatDate(h.date, "EEE, d MMM")}</span>
                    <span className={cn("truncate", !past && "font-medium")}>{h.name}</span>
                  </div>
                  {past ? (
                    <Badge variant="secondary">Past</Badge>
                  ) : h.date === today ? (
                    <Badge variant="info">Today</Badge>
                  ) : (
                    <Badge variant="default">Upcoming</Badge>
                  )}
                </li>
              );
            })}
          </ul>
        </SectionCard>
      </div>
    </FadeIn>
  );
}
