"use client";

import { Suspense } from "react";
import { PageSkeleton } from "@/components/shared/common";
import { EvaluationFormPage } from "@/features/performance/evaluation-form";

export default function NewEvaluationPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <EvaluationFormPage />
    </Suspense>
  );
}
