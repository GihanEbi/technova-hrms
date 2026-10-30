"use client";

import * as React from "react";
import { toast } from "sonner";
import { useHRStore } from "@/store/hr-store";
import { useLookups } from "@/hooks/use-hr";
import { payslipId } from "@/lib/payroll";
import { formatDate, periodLabel } from "@/lib/dates";
import { generatePayslipPdf } from "@/lib/pdf";
import type { PayrollItem, PayrollRun } from "@/types";
import { amountInWords } from "./payroll-utils";

export interface PayslipRow {
  id: string;
  run: PayrollRun;
  item: PayrollItem;
  employeeId: string;
  period: string;
  payDate: string;
}

/** All payslips (one per item of every processed run), newest period first. */
export function usePayslips(): PayslipRow[] {
  const runs = useHRStore((s) => s.data.payrollRuns);
  return React.useMemo(
    () =>
      runs
        .filter((r) => r.status === "Processed")
        .sort((a, b) => b.period.localeCompare(a.period))
        .flatMap((run) => run.items.map((item) => ({ id: payslipId(run, item.employeeId), run, item, employeeId: item.employeeId, period: run.period, payDate: run.payDate }))),
    [runs],
  );
}

/** Returns a function that builds and downloads the payslip PDF for a row. */
export function usePayslipPdf() {
  const company = useHRStore((s) => s.data.company);
  const settings = useHRStore((s) => s.data.payrollSettings);
  const lookups = useLookups();
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const download = React.useCallback(
    async (row: PayslipRow) => {
      const e = lookups.employee(row.employeeId);
      const filename = `payslip-${row.employeeId}-${row.period}.pdf`;
      setBusyId(row.id);
      try {
        await generatePayslipPdf({
          company,
          payslipId: row.id,
          periodLabel: periodLabel(row.period),
          payDate: formatDate(row.payDate),
          employee: {
            id: row.employeeId,
            name: lookups.name(row.employeeId),
            designation: lookups.desName(e?.designationId),
            department: lookups.deptName(e?.departmentId),
            joinDate: formatDate(e?.joinDate),
            email: e?.email ?? "",
          },
          item: row.item,
          amountInWords: amountInWords(row.item.net, "Rupees"),
          rates: { epfEmployee: settings.epfEmployeeRate, epfEmployer: settings.epfEmployerRate, etf: settings.etfRate },
          filename,
        });
        toast.success("Payslip downloaded", { description: filename });
      } catch {
        toast.error("Couldn't create the PDF", { description: "Please try again." });
      } finally {
        setBusyId(null);
      }
    },
    [company, settings, lookups],
  );
  return { download, busyId };
}
