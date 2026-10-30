"use client";

import { useAuth } from "@/hooks/use-hr";
import { OrgDashboard } from "@/features/dashboard/org-dashboard";
import { EmployeeDashboard, TeamDashboard } from "@/features/dashboard/personal-dashboards";

export default function DashboardPage() {
  const { role } = useAuth();
  if (role === "employee") return <EmployeeDashboard />;
  if (role === "team_lead") return <TeamDashboard />;
  return <OrgDashboard />;
}
