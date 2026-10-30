"use client";

import { Suspense } from "react";
import { LoadingState } from "@/components/shared/common";
import { AssistantChat } from "@/features/ai-assistant/assistant-chat";

export default function AiAssistantPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <AssistantChat />
    </Suspense>
  );
}
