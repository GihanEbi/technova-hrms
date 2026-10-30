"use client";

import * as React from "react";
import { Calculator, FileText, History, LayoutDashboard, Receipt, Settings2 } from "lucide-react";
import { useAuth } from "@/hooks/use-hr";
import { can } from "@/lib/permissions";
import { AccessDenied, FadeIn, ModuleTabs, PageHeader } from "@/components/shared/common";
import { payrollTabs } from "./payroll-utils";

const icons = [LayoutDashboard, Calculator, FileText, Receipt, History, Settings2];

export function PayrollTabs() {
  return <div className="no-print"><ModuleTabs tabs={payrollTabs.map((t, i) => ({ ...t, icon: icons[i] }))} /></div>;
}

/** Page frame for payroll-role screens: header, module tabs and a permission guard. */
export function PayrollPageFrame({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { role } = useAuth();
  const allowed = can(role, "payroll.view");
  return (
    <FadeIn>
      <PageHeader title={title} description={description} actions={allowed ? actions : undefined} />
      {allowed ? (
        <>
          <PayrollTabs />
          {children}
        </>
      ) : (
        <AccessDenied />
      )}
    </FadeIn>
  );
}
