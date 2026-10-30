"use client";

import { Suspense } from "react";
import { FadeIn, LoadingState, PageHeader } from "@/components/shared/common";
import { ApplyLeaveForm } from "@/features/leave/apply-leave-form";

export default function ApplyLeavePage() {
  return (
    <FadeIn>
      <PageHeader title="Apply leave" description="Submit a leave request for approval by your manager." />
      <Suspense fallback={<LoadingState label="Loading form…" />}>
        <ApplyLeaveForm />
      </Suspense>
    </FadeIn>
  );
}
