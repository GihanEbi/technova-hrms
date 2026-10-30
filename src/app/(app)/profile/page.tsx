"use client";

import { useAuth } from "@/hooks/use-hr";
import { EmployeeProfileView } from "@/features/employees/employee-profile";

export default function MyProfilePage() {
  const { employee } = useAuth();
  return <EmployeeProfileView employeeId={employee.id} self />;
}
