"use client";

import { LayoutDashboard, PenSquare, Star } from "lucide-react";
import { useAuth } from "@/hooks/use-hr";
import { can } from "@/lib/permissions";
import { ModuleTabs } from "@/components/shared/common";

/** Route tabs for reviewers (roles with performance.manage). Hidden for everyone else. */
export function PerformanceTabs() {
  const { role } = useAuth();
  if (!can(role, "performance.manage")) return null;
  return (
    <ModuleTabs
      tabs={[
        { href: "/performance", label: "Overview", icon: LayoutDashboard, exact: true },
        { href: "/performance/new", label: "New evaluation", icon: PenSquare },
        { href: "/performance/my", label: "My Performance", icon: Star },
      ]}
    />
  );
}
