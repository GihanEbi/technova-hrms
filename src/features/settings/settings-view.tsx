"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Briefcase, Building, Building2, CalendarCog, FlaskConical, SlidersHorizontal, Wallet } from "lucide-react";
import { useAuth } from "@/hooks/use-hr";
import { can } from "@/lib/permissions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/overlays";
import { FadeIn, PageHeader } from "@/components/shared/common";
import { DepartmentsManager } from "@/features/organization/departments-manager";
import { DesignationsManager } from "@/features/organization/designations-manager";
import { PayrollSettingsForm } from "@/features/payroll/payroll-settings-form";
import { OrganizationSettings } from "./organization-settings";
import { LeavePolicySettings } from "./leave-policy-settings";
import { PreferencesSettings } from "./preferences-settings";
import { DemoSettings } from "./demo-settings";

export function SettingsView() {
  const { role } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const tabs = [
    { value: "organization", label: "Organization", icon: Building, show: can(role, "settings.organization"), content: <OrganizationSettings /> },
    { value: "departments", label: "Departments", icon: Building2, show: can(role, "departments.manage"), content: <DepartmentsManager /> },
    { value: "designations", label: "Designations", icon: Briefcase, show: can(role, "departments.manage"), content: <DesignationsManager /> },
    { value: "leave", label: "Leave policies", icon: CalendarCog, show: can(role, "leave.policies"), content: <LeavePolicySettings /> },
    { value: "payroll", label: "Payroll", icon: Wallet, show: can(role, "settings.payroll"), content: <PayrollSettingsForm /> },
    { value: "preferences", label: "Preferences", icon: SlidersHorizontal, show: true, content: <PreferencesSettings /> },
    { value: "demo", label: "Demo", icon: FlaskConical, show: true, content: <DemoSettings /> },
  ].filter((t) => t.show);

  const requested = params.get("tab");
  const active = tabs.find((t) => t.value === requested)?.value ?? tabs[0].value;

  return (
    <FadeIn>
      <PageHeader title="Settings" description="Manage your organization, policies and personal preferences." />
      <Tabs value={active} onValueChange={(v) => router.replace(`${pathname}?tab=${v}`, { scroll: false })}>
        <TabsList aria-label="Settings sections">
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              <t.icon /> {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((t) => (
          <TabsContent key={t.value} value={t.value} className="mt-6">
            {t.content}
          </TabsContent>
        ))}
      </Tabs>
    </FadeIn>
  );
}
