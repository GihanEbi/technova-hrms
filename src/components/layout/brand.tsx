"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { useHRStore } from "@/store/hr-store";

export function LogoGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="8" fill="var(--primary)" />
      <path d="M9 10.5h14M16 10.5V23" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <circle cx="22.5" cy="21.5" r="2.5" fill="#c7d2fe" />
    </svg>
  );
}

export function BrandMark({ compact }: { compact?: boolean }) {
  const logo = useHRStore((s) => s.data.company.logo);
  const name = useHRStore((s) => s.data.company.name);
  return (
    <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/40" aria-label={`${name} home`}>
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" className="size-8 shrink-0 rounded-lg object-cover" />
      ) : (
        <LogoGlyph className="size-8 shrink-0" />
      )}
      {!compact && (
        <span className="min-w-0 leading-tight">
          <span className={cn("block truncate text-sm font-semibold tracking-tight")}>{name}</span>
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            HR & Payroll
            <span className="rounded bg-primary-soft px-1 py-px text-[9px] font-semibold tracking-wide text-primary-soft-foreground uppercase">Demo</span>
          </span>
        </span>
      )}
    </Link>
  );
}
