"use client";

import { useSession } from "@/hooks/use-hr";
import { can } from "@/lib/permissions";
import { AccessDenied, FadeIn, PageHeader } from "@/components/shared/common";
import { EmployeeForm } from "@/features/employees/employee-form";

export default function NewEmployeePage() {
  const { role } = useSession();
  if (!can(role ?? undefined, "employees.manage")) return <AccessDenied />;
  return (
    <FadeIn className="mx-auto max-w-5xl">
      <PageHeader title="Add employee" description="Create a new employee record. Fields marked * are required." />
      <EmployeeForm showSalary={can(role ?? undefined, "salary.view")} />
    </FadeIn>
  );
}
