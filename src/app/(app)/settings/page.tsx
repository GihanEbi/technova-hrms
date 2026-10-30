"use client";

import { Suspense } from "react";
import { PageSkeleton } from "@/components/shared/common";
import { SettingsView } from "@/features/settings/settings-view";

export default function SettingsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SettingsView />
    </Suspense>
  );
}
