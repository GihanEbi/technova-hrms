"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useHydrated, useSession } from "@/hooks/use-hr";
import { canAccessRoute } from "@/lib/permissions";
import { AccessDenied, LoadingState } from "@/components/shared/common";
import { AppSidebar, MobileSidebar } from "./app-sidebar";
import { AppHeader } from "./app-header";
import { CommandPalette } from "./command-palette";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const { user, role } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);

  React.useEffect(() => {
    if (hydrated && !user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [hydrated, user, router, pathname]);

  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  if (!hydrated || !user || !role) return <LoadingState fullScreen label="Loading workspace…" />;

  const allowed = canAccessRoute(role, pathname);
  return (
    <div className="flex min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground">
        Skip to content
      </a>
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader onOpenMobileNav={() => setMobileOpen(true)} onOpenSearch={() => setSearchOpen(true)} />
        <main id="main" className="mx-auto w-full max-w-[1440px] min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {allowed ? children : <AccessDenied />}
        </main>
      </div>
      <MobileSidebar open={mobileOpen} onOpenChange={setMobileOpen} />
      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
