"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Briefcase, Building2 } from "lucide-react";
import { useAuth } from "@/hooks/use-hr";
import { useHRStore } from "@/store/hr-store";
import { can } from "@/lib/permissions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/overlays";
import { AccessDenied, FadeIn, PageHeader, PageSkeleton } from "@/components/shared/common";
import { DepartmentsManager } from "@/features/organization/departments-manager";
import { DesignationsManager } from "@/features/organization/designations-manager";

function DepartmentsContent() {
  const { role } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab = params.get("tab") === "designations" ? "designations" : "departments";
  const departments = useHRStore((s) => s.data.departments);
  const designations = useHRStore((s) => s.data.designations);

  if (!can(role, "departments.manage")) return <AccessDenied />;

  return (
    <FadeIn>
      <PageHeader
        title="Departments & Designations"
        description={`${departments.filter((d) => !d.archived).length} active departments and ${designations.filter((d) => !d.archived).length} designations shape your organization.`}
      />
      <Tabs value={tab} onValueChange={(v) => router.replace(v === "departments" ? pathname : `${pathname}?tab=${v}`, { scroll: false })}>
        <TabsList aria-label="Organization structure">
          <TabsTrigger value="departments">
            <Building2 /> Departments
          </TabsTrigger>
          <TabsTrigger value="designations">
            <Briefcase /> Designations
          </TabsTrigger>
        </TabsList>
        <TabsContent value="departments" className="mt-6">
          <DepartmentsManager />
        </TabsContent>
        <TabsContent value="designations" className="mt-6">
          <DesignationsManager />
        </TabsContent>
      </Tabs>
    </FadeIn>
  );
}

export default function DepartmentsPage() {
  return (
    <React.Suspense fallback={<PageSkeleton />}>
      <DepartmentsContent />
    </React.Suspense>
  );
}
