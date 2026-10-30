"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useHydrated, useSession } from "@/hooks/use-hr";
import { LoadingState } from "@/components/shared/common";

export default function Home() {
  const hydrated = useHydrated();
  const { user } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (hydrated) router.replace(user ? "/dashboard" : "/login");
  }, [hydrated, user, router]);
  return <LoadingState fullScreen label="Opening TechNova HR…" />;
}
