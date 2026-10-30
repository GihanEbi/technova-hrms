"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useHRStore } from "@/store/hr-store";
import { useLookups } from "@/hooks/use-hr";
import { simulate } from "@/services/mock-api";
import type { Department } from "@/types";
import { Input, Textarea } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/overlays";
import { Field, SearchableSelect } from "@/components/forms/fields";

export const departmentColors = [
  { value: "chart-1", label: "Indigo" },
  { value: "chart-2", label: "Emerald" },
  { value: "chart-3", label: "Amber" },
  { value: "chart-4", label: "Rose" },
  { value: "chart-5", label: "Sky" },
  { value: "chart-6", label: "Violet" },
];

export function ColorDot({ color, className = "size-2.5" }: { color: string; className?: string }) {
  return <span className={`inline-block shrink-0 rounded-full ${className}`} style={{ background: `var(--${color})` }} aria-hidden />;
}

const schema = z.object({
  name: z.string().trim().min(2, "Department name is required."),
  code: z
    .string()
    .trim()
    .regex(/^[A-Z]{2,5}$/, "Use 2–5 uppercase letters, e.g. FIN."),
  description: z.string().trim().max(240, "Keep the description under 240 characters."),
  headId: z.string(),
  color: z.string().min(1),
});
type Values = z.infer<typeof schema>;

export function DepartmentDialog({
  open,
  onOpenChange,
  department,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department?: Department | null;
}) {
  const departments = useHRStore((s) => s.data.departments);
  const employees = useHRStore((s) => s.data.employees);
  const addDepartment = useHRStore((s) => s.addDepartment);
  const updateDepartment = useHRStore((s) => s.updateDepartment);
  const lookups = useLookups();
  const isEdit = !!department;

  const nextColor = departmentColors[departments.length % departmentColors.length].value;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", code: "", description: "", headId: "", color: nextColor },
  });
  const { register, control, handleSubmit, formState, reset, setError } = form;
  const errors = formState.errors;

  React.useEffect(() => {
    if (!open) return;
    reset({
      name: department?.name ?? "",
      code: department?.code ?? "",
      description: department?.description ?? "",
      headId: department?.headId ?? "",
      color: department?.color ?? nextColor,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, department]);

  const headOptions = employees
    .filter((e) => !e.archived)
    .map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName}`, description: `${lookups.desName(e.designationId)} · ${e.id}` }));

  const onSubmit = handleSubmit(async (v) => {
    const others = departments.filter((d) => d.id !== department?.id);
    const codeClash = others.find((d) => d.code.toUpperCase() === v.code.toUpperCase());
    if (codeClash) {
      setError("code", { message: `This code is already used by ${codeClash.name}.` });
      return;
    }
    const nameClash = others.find((d) => d.name.trim().toLowerCase() === v.name.trim().toLowerCase());
    if (nameClash) {
      setError("name", { message: "A department with this name already exists." });
      return;
    }
    const payload = { name: v.name.trim(), code: v.code.trim(), description: v.description.trim(), headId: v.headId || null, color: v.color };
    if (isEdit && department) {
      await simulate(() => updateDepartment(department.id, payload));
      toast.success("Department updated", { description: `${payload.name} was saved.` });
    } else {
      await simulate(() => addDepartment(payload));
      toast.success("Department added", { description: `${payload.name} (${payload.code}) is ready for employees and designations.` });
    }
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !formState.isSubmitting && onOpenChange(o)}>
      <DialogContent>
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>{isEdit ? `Edit ${department?.name}` : "Add department"}</DialogTitle>
            <DialogDescription>
              {isEdit ? "Update the department details. Changes apply everywhere the department is shown." : "Create a new department to group employees and designations."}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
              <Field label="Name" htmlFor="dept-name" required error={errors.name?.message}>
                <Input id="dept-name" placeholder="e.g. Customer Success" aria-invalid={!!errors.name} {...register("name")} />
              </Field>
              <Field label="Code" htmlFor="dept-code" required error={errors.code?.message} hint="2–5 uppercase letters">
                <Input id="dept-code" placeholder="e.g. CS" className="font-mono"maxLength={5} aria-invalid={!!errors.code} {...register("code")} />
              </Field>
            </div>
            <Field label="Description" htmlFor="dept-description" error={errors.description?.message}>
              <Textarea id="dept-description" rows={3} placeholder="What does this department do?" {...register("description")} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Department head" htmlFor="dept-head">
                <Controller
                  control={control}
                  name="headId"
                  render={({ field }) => (
                    <SearchableSelect id="dept-head" value={field.value} onChange={field.onChange} options={headOptions} placeholder="Select a person" searchPlaceholder="Search employees…" allowClear />
                  )}
                />
              </Field>
              <Field label="Colour" htmlFor="dept-color">
                <Controller
                  control={control}
                  name="color"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="dept-color">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {departmentColors.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            <span className="flex items-center gap-2">
                              <ColorDot color={c.value} />
                              {c.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={formState.isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" loading={formState.isSubmitting}>
              {isEdit ? "Save changes" : "Add department"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
