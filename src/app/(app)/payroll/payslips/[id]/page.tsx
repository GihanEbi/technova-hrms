"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, FileDown, Printer, Receipt } from "lucide-react";
import { useAuth, useLookups } from "@/hooks/use-hr";
import { can } from "@/lib/permissions";
import { parsePayslipId } from "@/lib/payroll";
import { periodLabel } from "@/lib/dates";
import { Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { AccessDenied, EmptyState, FadeIn, PageHeader } from "@/components/shared/common";
import { usePayslipPdf, usePayslips } from "@/features/payroll/payslip-data";
import { PayslipDocument } from "@/features/payroll/payslip-document";
import { PrintLightTheme } from "@/features/payroll/print-theme";

export default function PayslipDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = decodeURIComponent(String(params.id ?? ""));
  const { role, employee } = useAuth();
  const lookups = useLookups();
  const payslips = usePayslips();
  const { download, busyId } = usePayslipPdf();

  const parsed = parsePayslipId(id);
  const row = parsed ? payslips.find((p) => p.period === parsed.period && p.employeeId === parsed.employeeId) : undefined;
  const isOwner = parsed?.employeeId === employee.id;
  const allowed = isOwner || can(role, "payroll.view");

  const back = () => {
    if (window.history.length > 1) router.back();
    else router.push("/payroll/payslips");
  };

  if (parsed && !allowed) {
    return (
      <FadeIn>
        <PageHeader title="Payslip" />
        <AccessDenied />
      </FadeIn>
    );
  }

  if (!row) {
    return (
      <FadeIn>
        <PageHeader title="Payslip" />
        <Card>
          <EmptyState
            icon={Receipt}
            title="Payslip not found"
            description={parsed ? `There is no processed payslip for ${parsed.employeeId} in ${periodLabel(parsed.period)}.` : "This payslip ID isn't valid. Payslip IDs look like PS-2026-09-EMP-0005."}
            action={
              <Button asChild variant="outline">
                <Link href="/payroll/payslips">Back to payslips</Link>
              </Button>
            }
          />
        </Card>
      </FadeIn>
    );
  }

  return (
    <FadeIn>
      <PrintLightTheme />
      <div className="no-print">
        <PageHeader
          title={`Payslip · ${periodLabel(row.period)}`}
          description={`${lookups.name(row.employeeId)} · ${row.id}`}
          actions={
            <>
              <Button variant="outline" onClick={back}>
                <ArrowLeft /> Back
              </Button>
              <Button variant="outline" onClick={() => window.print()}>
                <Printer /> Print
              </Button>
              <Button onClick={() => download(row)} loading={busyId === row.id}>
                {busyId !== row.id && <FileDown />} Download PDF
              </Button>
            </>
          }
        />
      </div>
      <PayslipDocument row={row} />
    </FadeIn>
  );
}
