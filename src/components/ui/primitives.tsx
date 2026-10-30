"use client";

// Small form and display primitives shared across every module.
import * as React from "react";
import { Avatar as AvatarPrimitive, Checkbox as CheckboxPrimitive, Label as LabelPrimitive, Progress as ProgressPrimitive, RadioGroup as RadioGroupPrimitive, Separator as SeparatorPrimitive, Switch as SwitchPrimitive, Tooltip as TooltipPrimitive } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------- Input / Textarea / Label ----------------
const fieldBase =
  "w-full min-w-0 rounded-md border border-input bg-surface px-3 text-sm text-foreground shadow-xs transition-[color,box-shadow,border-color] outline-none placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-subtle";

export function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return <input type={type} data-slot="input" className={cn(fieldBase, "h-9 py-1 file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" className={cn(fieldBase, "min-h-20 py-2 leading-relaxed", className)} {...props} />;
}

export function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return <LabelPrimitive.Root className={cn("text-sm font-medium leading-none text-foreground select-none peer-disabled:opacity-60", className)} {...props} />;
}

// ---------------- Card ----------------
export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card" className={cn("rounded-xl border border-border bg-card text-card-foreground shadow-sm", className)} {...props} />;
}
export function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-3", className)} {...props} />;
}
export function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return <h3 className={cn("text-[15px] font-semibold leading-tight tracking-tight", className)} {...props} />;
}
export function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("mt-1 text-[13px] text-muted-foreground", className)} {...props} />;
}
export function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("px-5 pb-5", className)} {...props} />;
}
export function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex items-center gap-2 border-t border-border px-5 py-3", className)} {...props} />;
}

// ---------------- Badge ----------------
export const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap [&_svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary-soft text-primary-soft-foreground",
        secondary: "border-transparent bg-muted text-muted-foreground",
        outline: "border-border text-foreground",
        success: "border-transparent bg-success-soft text-success-soft-foreground",
        warning: "border-transparent bg-warning-soft text-warning-soft-foreground",
        destructive: "border-transparent bg-destructive-soft text-destructive-soft-foreground",
        info: "border-transparent bg-info-soft text-info-soft-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);
export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;
export function Badge({ className, variant, dot, children, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { dot?: boolean }) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

// ---------------- Separator ----------------
export function Separator({ className, orientation = "horizontal", ...props }: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      orientation={orientation}
      className={cn("shrink-0 bg-border", orientation === "horizontal" ? "h-px w-full" : "h-full w-px", className)}
      {...props}
    />
  );
}

// ---------------- Avatar ----------------
const avatarColors = ["bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200", "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200", "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200", "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200", "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200", "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200"];
export function Avatar({ name, src, className, seed }: { name: string; src?: string | null; className?: string; seed?: string }) {
  const parts = name.trim().split(/\s+/);
  const text = `${parts[0]?.[0] ?? ""}${parts.length > 1 ? parts[parts.length - 1][0] : ""}`.toUpperCase();
  const key = (seed ?? name).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return (
    <AvatarPrimitive.Root className={cn("relative flex size-9 shrink-0 overflow-hidden rounded-full", className)}>
      {src && <AvatarPrimitive.Image src={src} alt={name} className="aspect-square size-full object-cover" />}
      <AvatarPrimitive.Fallback className={cn("flex size-full items-center justify-center text-[0.8em] font-semibold", avatarColors[key % avatarColors.length])} aria-label={name}>
        {text}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

// ---------------- Progress ----------------
export function Progress({ value, className, indicatorClassName, ...props }: React.ComponentProps<typeof ProgressPrimitive.Root> & { indicatorClassName?: string }) {
  return (
    <ProgressPrimitive.Root className={cn("relative h-2 w-full overflow-hidden rounded-full bg-muted", className)} value={value} {...props}>
      <ProgressPrimitive.Indicator className={cn("h-full rounded-full bg-primary transition-[width] duration-500", indicatorClassName)} style={{ width: `${Math.min(100, Math.max(0, value ?? 0))}%` }} />
    </ProgressPrimitive.Root>
  );
}

// ---------------- Skeleton ----------------
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />;
}

// ---------------- Checkbox ----------------
export function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn("peer size-4 shrink-0 rounded-[4px] border border-input bg-surface shadow-xs outline-none transition-shadow focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:bg-subtle", className)}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
        <Check className="size-3.5" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

// ---------------- Radio group ----------------
export function RadioGroup({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return <RadioGroupPrimitive.Root className={cn("grid gap-2", className)} {...props} />;
}
export function RadioGroupItem({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      className={cn("aspect-square size-4 shrink-0 rounded-full border border-input bg-surface shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:opacity-50 data-[state=checked]:border-primary dark:bg-subtle", className)}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
        <Circle className="size-2 fill-primary text-primary" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );
}

// ---------------- Switch ----------------
export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn("peer inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent shadow-xs outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input", className)}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-4 rounded-full bg-white shadow-sm ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0.5" />
    </SwitchPrimitive.Root>
  );
}

// ---------------- Tooltip ----------------
export function TooltipProvider(props: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return <TooltipPrimitive.Provider delayDuration={200} {...props} />;
}
export function Tooltip({ content, children, side = "top", disabled }: { content: React.ReactNode; children: React.ReactNode; side?: "top" | "right" | "bottom" | "left"; disabled?: boolean }) {
  if (disabled) return <>{children}</>;
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content side={side} sideOffset={6} className="z-50 rounded-md bg-foreground px-2.5 py-1.5 text-xs font-medium text-background shadow-md animate-in fade-in-0 zoom-in-95">
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

// ---------------- Alert ----------------
const alertVariants = cva("relative flex gap-3 rounded-lg border px-4 py-3 text-sm [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0", {
  variants: {
    variant: {
      default: "border-border bg-surface text-foreground",
      info: "border-info/25 bg-info-soft text-info-soft-foreground",
      success: "border-success/25 bg-success-soft text-success-soft-foreground",
      warning: "border-warning/30 bg-warning-soft text-warning-soft-foreground",
      destructive: "border-destructive/25 bg-destructive-soft text-destructive-soft-foreground",
    },
  },
  defaultVariants: { variant: "default" },
});
export function Alert({ className, variant, ...props }: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return <div role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}
export function AlertTitle({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("font-medium leading-tight", className)} {...props} />;
}
export function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("mt-1 text-[13px] opacity-90", className)} {...props} />;
}

// ---------------- Kbd ----------------
export function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return <kbd className={cn("pointer-events-none inline-flex h-5 items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground", className)} {...props} />;
}
