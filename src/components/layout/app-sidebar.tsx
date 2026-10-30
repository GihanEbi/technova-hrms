"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHRStore } from "@/store/hr-store";
import { useSession } from "@/hooks/use-hr";
import { Tooltip } from "@/components/ui/primitives";
import { Sheet, SheetContent } from "@/components/ui/overlays";
import { isNavActive, navFor } from "./nav-config";
import { BrandMark } from "./brand";

function NavList({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { role } = useSession();
  if (!role) return null;
  const sections = navFor(role);
  return (
    <nav aria-label="Main navigation" className="scrollbar-thin flex-1 overflow-y-auto px-3 py-3">
      {sections.map((section) => (
        <div key={section.label} className="mb-3 last:mb-0">
          {collapsed ? (
            <div className="mx-auto mb-2 h-px w-6 bg-border" aria-hidden />
          ) : (
            <p className="mb-1 px-2.5 text-[11px] font-semibold tracking-wider text-sidebar-muted uppercase">{section.label}</p>
          )}
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active = isNavActive(item, pathname);
              const Icon = item.icon;
              const link = (
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  aria-label={collapsed ? item.label : undefined}
                  className={cn(
                    "group flex h-8.5 items-center gap-3 rounded-md px-2.5 text-sm font-medium text-sidebar-foreground transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/40",
                    active && "bg-sidebar-active text-sidebar-active-foreground hover:bg-sidebar-active",
                    collapsed && "justify-center px-0",
                  )}
                >
                  <Icon className={cn("size-[18px] shrink-0", active ? "text-sidebar-active-foreground" : "text-sidebar-muted group-hover:text-sidebar-foreground")} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
              return (
                <li key={item.href + item.label}>
                  {collapsed ? (
                    <Tooltip content={item.label} side="right">
                      {link}
                    </Tooltip>
                  ) : (
                    link
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function DemoBadge({ collapsed }: { collapsed: boolean }) {
  if (collapsed) return null;
  return (
    <div className="mx-3 mb-3 rounded-lg border border-border bg-subtle p-3">
      <div className="flex items-center gap-2 text-xs font-semibold">
        <Sparkles className="size-3.5 text-primary" />
        Demo workspace
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Sample data only. Reset it any time from Settings → Demo.</p>
    </div>
  );
}

/** Desktop & tablet sidebar. Tablet (md) always shows the compact icon rail. */
export function AppSidebar() {
  const collapsedPref = useHRStore((s) => s.sidebarCollapsed);
  const toggle = useHRStore((s) => s.toggleSidebar);
  return (
    <div className="no-print hidden shrink-0 border-r border-border bg-sidebar md:block">
    <aside
      data-collapsed={collapsedPref}
      className={cn(
        "sticky top-0 flex h-dvh flex-col transition-[width] duration-200",
        "w-[68px]",
        collapsedPref ? "lg:w-[68px]" : "lg:w-64",
      )}
      aria-label="Sidebar"
      data-testid="app-sidebar"
    >
      {/* Compact rail on tablet */}
      <div className="flex h-full flex-col lg:hidden">
        <div className="flex h-16 items-center justify-center border-b border-border">
          <BrandMark compact />
        </div>
        <NavList collapsed />
      </div>
      {/* Full sidebar on desktop */}
      <div className="hidden h-full flex-col lg:flex">
        <div className={cn("flex h-16 items-center border-b border-border", collapsedPref ? "justify-center" : "justify-between px-4")}>
          <BrandMark compact={collapsedPref} />
          {!collapsedPref && (
            <button type="button" onClick={toggle} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Collapse sidebar">
              <PanelLeftClose className="size-4" />
            </button>
          )}
        </div>
        <NavList collapsed={collapsedPref} />
        {collapsedPref && (
          <div className="flex justify-center border-t border-border py-3">
            <Tooltip content="Expand sidebar" side="right">
              <button type="button" onClick={toggle} className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Expand sidebar">
                <PanelLeftOpen className="size-4" />
              </button>
            </Tooltip>
          </div>
        )}
      </div>
    </aside>
    </div>
  );
}

export function MobileSidebar({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title="Navigation" side="left" data-testid="mobile-sidebar">
        <div className="flex h-16 items-center border-b border-border px-4">
          <BrandMark />
        </div>
        <NavList collapsed={false} onNavigate={() => onOpenChange(false)} />
        <DemoBadge collapsed={false} />
      </SheetContent>
    </Sheet>
  );
}
