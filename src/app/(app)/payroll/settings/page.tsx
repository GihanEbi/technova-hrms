"use client";

import { PayrollPageFrame } from "@/features/payroll/payroll-shell";
import { PayrollSettingsForm } from "@/features/payroll/payroll-settings-form";

export default function PayrollSettingsPage() {
  return (
    <PayrollPageFrame title="Payroll Settings" description="Pay cycle, statutory contribution rates, overtime and the APIT tax table.">
      <PayrollSettingsForm />
    </PayrollPageFrame>
  );
}
