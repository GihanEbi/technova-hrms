"use client";

import { useParams } from "next/navigation";
import { EmployeeProfileView } from "@/features/employees/employee-profile";

export default function EmployeeProfilePage() {
  const { id } = useParams<{ id: string }>();
  return <EmployeeProfileView employeeId={id} />;
}
