"use client";

import { useParams } from "next/navigation";
import { useHRStore } from "@/store/hr-store";
import { useSession } from "@/hooks/use-hr";
import { can } from "@/lib/permissions";
import { AccessDenied, FadeIn, PageHeader } from "@/components/shared/common";
import { EmployeeForm } from "@/features/employees/employee-form";
import { EmployeeNotFound } from "@/features/employees/employee-profile";

export default function EditEmployeePage() {
  const { id } = useParams<{ id: string }>();
  const { role } = useSession();
  const employee = useHRStore((s) => s.data.employees.find((e) => e.id === id));
  if (!can(role ?? undefined, "employees.manage")) return <AccessDenied />;
  if (!employee) return <EmployeeNotFound />;
  return (
    <FadeIn className="mx-auto max-w-5xl">
      <PageHeader title={`Edit ${employee.firstName} ${employee.lastName}`} description={`${employee.id} · Update personal, employment and salary details.`} />
      <EmployeeForm employee={employee} showSalary={can(role ?? undefined, "salary.view")} />
    </FadeIn>
  );
}
