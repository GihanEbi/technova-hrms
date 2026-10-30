"use client";

import { useParams } from "next/navigation";
import { EvaluationDetails } from "@/features/performance/evaluation-details";

export default function EvaluationDetailsPage() {
  const params = useParams<{ id: string }>();
  return <EvaluationDetails id={decodeURIComponent(params.id)} />;
}
