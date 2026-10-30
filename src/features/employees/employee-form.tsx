"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Briefcase, NotebookPen, Plus, User, Wallet, X } from "lucide-react";
import { useHRStore } from "@/store/hr-store";
import { useLookups } from "@/hooks/use-hr";
import { simulate } from "@/services/mock-api";
import { nextId } from "@/lib/utils";
import { todayKey } from "@/lib/dates";
import type { Employee, SalaryStructure } from "@/types";
import { Avatar, Badge, Input, Textarea } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/overlays";
import { CurrencyInput, DatePicker, Field, FileUpload, SearchableSelect, readImageAsDataUrl } from "@/components/forms/fields";
import { ConfirmDialog, SectionCard } from "@/components/shared/common";

const phoneRe = /^\+?[0-9 ()-]{9,17}$/;

const schema = z
  .object({
    firstName: z.string().trim().min(2, "First name is required."),
    lastName: z.string().trim().min(2, "Last name is required."),
    email: z.string().trim().min(1, "Email is required.").email("Enter a valid email address."),
    phone: z.string().trim().regex(phoneRe, "Enter a valid phone number, e.g. +94 77 123 4567."),
    dateOfBirth: z.string().min(1, "Date of birth is required."),
    gender: z.enum(["Female", "Male"]),
    address: z.string().trim().min(5, "Address is required."),
    ecName: z.string().trim().min(2, "Emergency contact name is required."),
    ecRelationship: z.string().trim().min(2, "Relationship is required."),
    ecPhone: z.string().trim().regex(phoneRe, "Enter a valid phone number."),
    id: z.string().trim().regex(/^EMP-\d{4}$/, "Use the format EMP-0000."),
    departmentId: z.string().min(1, "Select a department."),
    designationId: z.string().min(1, "Select a designation."),
    managerId: z.string(),
    joinDate: z.string().min(1, "Joining date is required."),
    employmentType: z.enum(["Full-time", "Part-time", "Contract", "Intern"]),
    status: z.enum(["Active", "Probation", "Notice Period"]),
    basic: z.number().min(0, "Must be zero or more."),
    transportAllowance: z.number().min(0),
    mealAllowance: z.number().min(0),
    otherAllowance: z.number().min(0),
    currency: z.enum(["LKR", "USD"]),
    frequency: z.literal("Monthly"),
    skills: z.array(z.string()),
    notes: z.string().max(1000, "Keep notes under 1000 characters."),
    avatar: z.string().nullable(),
  })
  .refine((v) => v.dateOfBirth < v.joinDate, { message: "Date of birth must be before the joining date.", path: ["dateOfBirth"] });

type FormValues = z.infer<typeof schema>;

export function EmployeeForm({ employee, showSalary }: { employee?: Employee; showSalary: boolean }) {
  const router = useRouter();
  const data = useHRStore((s) => s.data);
  const addEmployee = useHRStore((s) => s.addEmployee);
  const updateEmployee = useHRStore((s) => s.updateEmployee);
  const lookups = useLookups();
  const salary: SalaryStructure | undefined = employee ? data.salaries.find((s) => s.employeeId === employee.id) : undefined;
  const isEdit = !!employee;
  const [confirmLeave, setConfirmLeave] = React.useState(false);
  const [skillDraft, setSkillDraft] = React.useState("");

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      firstName: employee?.firstName ?? "",
      lastName: employee?.lastName ?? "",
      email: employee?.email ?? "",
      phone: employee?.phone ?? "",
      dateOfBirth: employee?.dateOfBirth ?? "",
      gender: employee?.gender ?? "Female",
      address: employee?.address ?? "",
      ecName: employee?.emergencyContact.name ?? "",
      ecRelationship: employee?.emergencyContact.relationship ?? "",
      ecPhone: employee?.emergencyContact.phone ?? "",
      id: employee?.id ?? nextId("EMP", data.employees.map((e) => e.id)),
      departmentId: employee?.departmentId ?? "",
      designationId: employee?.designationId ?? "",
      managerId: employee?.managerId ?? "",
      joinDate: employee?.joinDate ?? todayKey(),
      employmentType: employee?.employmentType ?? "Full-time",
      status: employee?.status ?? "Probation",
      basic: salary?.basic ?? 0,
      transportAllowance: salary?.transportAllowance ?? 15000,
      mealAllowance: salary?.mealAllowance ?? 10000,
      otherAllowance: salary?.otherAllowance ?? 0,
      currency: (salary?.currency as "LKR" | "USD") ?? "LKR",
      frequency: "Monthly",
      skills: employee?.skills ?? [],
      notes: employee?.notes ?? "",
      avatar: employee?.avatar ?? null,
    },
  });
  const { register, control, formState, watch, setValue, handleSubmit } = form;
  const errors = formState.errors;
  const departmentId = watch("departmentId");
  const skills = watch("skills");
  const avatar = watch("avatar");
  const firstName = watch("firstName");
  const lastName = watch("lastName");

  // Warn before closing the tab with unsaved changes
  React.useEffect(() => {
    if (!formState.isDirty || formState.isSubmitSuccessful) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [formState.isDirty, formState.isSubmitSuccessful]);

  const designations = data.designations.filter((d) => !d.archived && (!departmentId || d.departmentId === departmentId));
  const managers = data.employees
    .filter((e) => !e.archived && e.id !== employee?.id)
    .map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName}`, description: `${lookups.desName(e.designationId)} · ${e.id}` }));

  const onSubmit = handleSubmit(async (v) => {
    if (!isEdit && data.employees.some((e) => e.id === v.id)) {
      form.setError("id", { message: "This employee ID is already in use." });
      return;
    }
    if (data.employees.some((e) => e.email.toLowerCase() === v.email.toLowerCase() && e.id !== employee?.id)) {
      form.setError("email", { message: "Another employee already uses this email." });
      return;
    }
    const payload: Omit<Employee, "archived" | "archivedAt"> = {
      id: v.id,
      firstName: v.firstName,
      lastName: v.lastName,
      email: v.email,
      phone: v.phone,
      dateOfBirth: v.dateOfBirth,
      gender: v.gender,
      address: v.address,
      emergencyContact: { name: v.ecName, relationship: v.ecRelationship, phone: v.ecPhone },
      departmentId: v.departmentId,
      designationId: v.designationId,
      managerId: v.managerId || null,
      joinDate: v.joinDate,
      employmentType: v.employmentType,
      status: v.status,
      skills: v.skills,
      notes: v.notes,
      avatar: v.avatar,
    };
    const salaryInput = showSalary
      ? { basic: v.basic, transportAllowance: v.transportAllowance, mealAllowance: v.mealAllowance, otherAllowance: v.otherAllowance, currency: v.currency, frequency: v.frequency }
      : null;
    if (isEdit) {
      await simulate(() => updateEmployee(employee.id, payload, salaryInput));
      toast.success("Employee updated", { description: `${v.firstName} ${v.lastName}'s details were saved.` });
      router.push(`/employees/${employee.id}`);
    } else {
      const id = await simulate(() => addEmployee(payload, salaryInput ?? { basic: 0, transportAllowance: 0, mealAllowance: 0, otherAllowance: 0, currency: "LKR", frequency: "Monthly" }));
      toast.success("Employee added", { description: `${v.firstName} ${v.lastName} (${id}) was added to the directory.` });
      router.push(`/employees/${id}`);
    }
  });

  const addSkill = () => {
    const s = skillDraft.trim();
    if (s && !skills.includes(s)) setValue("skills", [...skills, s], { shouldDirty: true });
    setSkillDraft("");
  };

  const cancel = () => {
    if (formState.isDirty) setConfirmLeave(true);
    else router.back();
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6" aria-label={isEdit ? "Edit employee" : "Add employee"}>
      <SectionCard title="Personal information" description="Basic identity and contact details." action={<User className="size-4 text-muted-foreground" />}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" htmlFor="firstName" required error={errors.firstName?.message}>
            <Input id="firstName" aria-invalid={!!errors.firstName} {...register("firstName")} />
          </Field>
          <Field label="Last name" htmlFor="lastName" required error={errors.lastName?.message}>
            <Input id="lastName" aria-invalid={!!errors.lastName} {...register("lastName")} />
          </Field>
          <Field label="Work email" htmlFor="email" required error={errors.email?.message}>
            <Input id="email" type="email" aria-invalid={!!errors.email} placeholder="name@technova-demo.lk" {...register("email")} />
          </Field>
          <Field label="Phone" htmlFor="phone" required error={errors.phone?.message}>
            <Input id="phone" inputMode="tel" aria-invalid={!!errors.phone} placeholder="+94 77 123 4567" {...register("phone")} />
          </Field>
          <Field label="Date of birth" htmlFor="dateOfBirth" required error={errors.dateOfBirth?.message}>
            <Controller
              control={control}
              name="dateOfBirth"
              render={({ field }) => (
                <DatePicker id="dateOfBirth" value={field.value} onChange={field.onChange} invalid={!!errors.dateOfBirth} startMonth={new Date(1950, 0)} endMonth={new Date()} disabledDays={{ after: new Date() }} />
              )}
            />
          </Field>
          <Field label="Gender" htmlFor="gender">
            <Controller
              control={control}
              name="gender"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="gender">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Male">Male</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Address" htmlFor="address" required error={errors.address?.message} className="sm:col-span-2">
            <Textarea id="address" rows={2} aria-invalid={!!errors.address} {...register("address")} />
          </Field>
        </div>
        <div className="mt-6 rounded-lg border border-border bg-subtle p-4">
          <p className="mb-3 text-sm font-medium">Emergency contact</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Name" htmlFor="ecName" required error={errors.ecName?.message}>
              <Input id="ecName" aria-invalid={!!errors.ecName} {...register("ecName")} />
            </Field>
            <Field label="Relationship" htmlFor="ecRelationship" required error={errors.ecRelationship?.message}>
              <Input id="ecRelationship" aria-invalid={!!errors.ecRelationship} placeholder="Spouse, parent…" {...register("ecRelationship")} />
            </Field>
            <Field label="Phone" htmlFor="ecPhone" required error={errors.ecPhone?.message}>
              <Input id="ecPhone" inputMode="tel" aria-invalid={!!errors.ecPhone} {...register("ecPhone")} />
            </Field>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Employment information" description="Role, team and contract details." action={<Briefcase className="size-4 text-muted-foreground" />}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Employee ID" htmlFor="id" required error={errors.id?.message} hint={isEdit ? "IDs can't be changed after creation." : "Auto-generated — edit if needed."}>
            <Input id="id" className="font-mono" disabled={isEdit} aria-invalid={!!errors.id} {...register("id")} />
          </Field>
          <Field label="Department" htmlFor="departmentId" required error={errors.departmentId?.message}>
            <Controller
              control={control}
              name="departmentId"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(v) => {
                    field.onChange(v);
                    setValue("designationId", "", { shouldDirty: true });
                  }}
                >
                  <SelectTrigger id="departmentId" aria-invalid={!!errors.departmentId}>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {data.departments.filter((d) => !d.archived).map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Designation" htmlFor="designationId" required error={errors.designationId?.message}>
            <Controller
              control={control}
              name="designationId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={!departmentId}>
                  <SelectTrigger id="designationId" aria-invalid={!!errors.designationId}>
                    <SelectValue placeholder={departmentId ? "Select designation" : "Choose a department first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {designations.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Reporting manager" htmlFor="managerId">
            <Controller
              control={control}
              name="managerId"
              render={({ field }) => (
                <SearchableSelect id="managerId" value={field.value} onChange={field.onChange} options={managers} placeholder="Select manager" searchPlaceholder="Search employees…" allowClear />
              )}
            />
          </Field>
          <Field label="Joining date" htmlFor="joinDate" required error={errors.joinDate?.message}>
            <Controller control={control} name="joinDate" render={({ field }) => <DatePicker id="joinDate" value={field.value} onChange={field.onChange} invalid={!!errors.joinDate} startMonth={new Date(2015, 0)} endMonth={new Date(new Date().getFullYear() + 1, 11)} />} />
          </Field>
          <Field label="Employment type" htmlFor="employmentType">
            <Controller
              control={control}
              name="employmentType"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="employmentType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Full-time", "Part-time", "Contract", "Intern"].map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Employment status" htmlFor="status">
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Active", "Probation", "Notice Period"].map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        </div>
      </SectionCard>

      {showSalary && (
        <SectionCard title="Salary information" description="Fixed monthly components. Overtime, bonuses and deductions are managed in Payroll → Salary Structures." action={<Wallet className="size-4 text-muted-foreground" />}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Basic salary" htmlFor="basic" required error={errors.basic?.message}>
              <Controller control={control} name="basic" render={({ field }) => <CurrencyInput id="basic" value={field.value} onChange={field.onChange} currency={watch("currency")} />} />
            </Field>
            <Field label="Transport allowance" htmlFor="transportAllowance">
              <Controller control={control} name="transportAllowance" render={({ field }) => <CurrencyInput id="transportAllowance" value={field.value} onChange={field.onChange} currency={watch("currency")} />} />
            </Field>
            <Field label="Meal allowance" htmlFor="mealAllowance">
              <Controller control={control} name="mealAllowance" render={({ field }) => <CurrencyInput id="mealAllowance" value={field.value} onChange={field.onChange} currency={watch("currency")} />} />
            </Field>
            <Field label="Other allowances" htmlFor="otherAllowance">
              <Controller control={control} name="otherAllowance" render={({ field }) => <CurrencyInput id="otherAllowance" value={field.value} onChange={field.onChange} currency={watch("currency")} />} />
            </Field>
            <Field label="Currency" htmlFor="currency">
              <Controller
                control={control}
                name="currency"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LKR">LKR — Sri Lankan Rupee</SelectItem>
                      <SelectItem value="USD">USD — US Dollar</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="Payment frequency" htmlFor="frequency">
              <Select value="Monthly" disabled>
                <SelectTrigger id="frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        </SectionCard>
      )}

      <SectionCard title="Additional information" description="Skills, notes and profile photo." action={<NotebookPen className="size-4 text-muted-foreground" />}>
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <div className="space-y-4">
            <Field label="Skills" htmlFor="skillInput" hint="Press Enter to add a skill.">
              <div className="flex gap-2">
                <Input
                  id="skillInput"
                  value={skillDraft}
                  onChange={(e) => setSkillDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addSkill();
                    }
                  }}
                  placeholder="e.g. TypeScript"
                />
                <Button type="button" variant="outline" onClick={addSkill} aria-label="Add skill">
                  <Plus />
                </Button>
              </div>
              {skills.length > 0 && (
                <ul className="mt-1 flex flex-wrap gap-1.5" aria-label="Skills">
                  {skills.map((s) => (
                    <li key={s}>
                      <Badge variant="outline" className="gap-1 py-1 pr-1">
                        {s}
                        <button type="button" className="rounded-full p-0.5 hover:bg-accent" aria-label={`Remove ${s}`} onClick={() => setValue("skills", skills.filter((x) => x !== s), { shouldDirty: true })}>
                          <X className="!size-3" />
                        </button>
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Field>
            <Field label="Notes" htmlFor="notes" error={errors.notes?.message}>
              <Textarea id="notes" rows={4} placeholder="Internal notes visible to HR" {...register("notes")} />
            </Field>
          </div>
          <Field label="Profile image" htmlFor="avatarUpload">
            <div className="flex items-center gap-4">
              <Avatar name={`${firstName || "New"} ${lastName || "Employee"}`} src={avatar} className="size-16 text-lg" />
              {avatar && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setValue("avatar", null, { shouldDirty: true })}>
                  Remove
                </Button>
              )}
            </div>
            <FileUpload
              id="avatarUpload"
              accept="image/png,image/jpeg,image/webp"
              label="Upload photo"
              hint="PNG or JPG up to 2 MB"
              onFile={async (file) => {
                try {
                  setValue("avatar", await readImageAsDataUrl(file), { shouldDirty: true });
                } catch {
                  toast.error("That image couldn't be read. Try a PNG or JPG file.");
                }
              }}
            />
          </Field>
        </div>
      </SectionCard>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-col-reverse gap-2 border-t border-border bg-background/90 px-4 py-3 backdrop-blur sm:mx-0 sm:flex-row sm:justify-end sm:rounded-xl sm:border sm:px-5">
        {Object.keys(errors).length > 0 && <p className="mr-auto self-center text-sm text-destructive">Please fix the highlighted fields.</p>}
        <Button type="button" variant="outline" onClick={cancel}>
          Cancel
        </Button>
        <Button type="submit" loading={formState.isSubmitting}>
          {isEdit ? "Save changes" : "Add employee"}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmLeave}
        onOpenChange={setConfirmLeave}
        tone="warning"
        title="Discard unsaved changes?"
        description="You have changes that haven't been saved. If you leave now they will be lost."
        confirmLabel="Discard changes"
        onConfirm={() => router.back()}
      />
    </form>
  );
}
