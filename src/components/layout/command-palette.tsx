"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useHRStore } from "@/store/hr-store";
import { useLookups, useSession } from "@/hooks/use-hr";
import { can } from "@/lib/permissions";
import { Avatar } from "@/components/ui/primitives";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { navFor } from "./nav-config";
import { CalendarPlus, Bot, UserPlus } from "lucide-react";

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const { role } = useSession();
  const employees = useHRStore((s) => s.data.employees);
  const lookups = useLookups();

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (!role) return null;
  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };
  const pages = navFor(role).flatMap((s) => s.items);
  const canSeePeople = can(role, "employees.view");
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed top-[12vh] left-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-popover shadow-lg outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]">
          <DialogPrimitive.Title className="sr-only">Search</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Search pages, people and actions</DialogPrimitive.Description>
          <Command>
            <CommandInput placeholder="Search pages, employees or actions…" aria-label="Search pages, employees or actions" />
            <CommandList className="max-h-[60vh]">
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup heading="Pages">
                {pages.map((p) => {
                  const Icon = p.icon;
                  return (
                    <CommandItem key={p.href + p.label} value={`page ${p.label}`} onSelect={() => go(p.href)}>
                      <Icon /> {p.label}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup heading="Actions">
                <CommandItem value="action apply leave" onSelect={() => go("/leave/apply")}>
                  <CalendarPlus /> Apply for leave
                </CommandItem>
                <CommandItem value="action ask ai assistant" onSelect={() => go("/ai-assistant")}>
                  <Bot /> Ask the AI assistant
                </CommandItem>
                {can(role, "employees.manage") && (
                  <CommandItem value="action add employee" onSelect={() => go("/employees/new")}>
                    <UserPlus /> Add employee
                  </CommandItem>
                )}
              </CommandGroup>
              {canSeePeople && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Employees">
                    {employees
                      .filter((e) => !e.archived)
                      .map((e) => (
                        <CommandItem key={e.id} value={`employee ${e.firstName} ${e.lastName} ${e.id} ${lookups.desName(e.designationId)}`} onSelect={() => go(`/employees/${e.id}`)}>
                          <Avatar name={`${e.firstName} ${e.lastName}`} src={e.avatar} seed={e.id} className="size-6 text-[10px]" />
                          <span className="flex-1 truncate">
                            {e.firstName} {e.lastName}
                          </span>
                          <span className="text-xs text-muted-foreground">{lookups.desName(e.designationId)}</span>
                        </CommandItem>
                      ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
