"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Building2, ImageIcon, Trash2 } from "lucide-react";
import { useHRStore } from "@/store/hr-store";
import { simulate } from "@/services/mock-api";
import { Input, Textarea } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/overlays";
import { Field, FileUpload, readImageAsDataUrl } from "@/components/forms/fields";
import { SectionCard } from "@/components/shared/common";
import { LogoGlyph } from "@/components/layout/brand";

export const timezones = [
  { value: "Asia/Colombo", label: "Asia/Colombo (GMT+5:30)" },
  { value: "Asia/Kolkata", label: "Asia/Kolkata (GMT+5:30)" },
  { value: "Asia/Dubai", label: "Asia/Dubai (GMT+4)" },
  { value: "Asia/Singapore", label: "Asia/Singapore (GMT+8)" },
  { value: "Australia/Sydney", label: "Australia/Sydney (GMT+10)" },
  { value: "Europe/London", label: "Europe/London (GMT+0)" },
  { value: "America/New_York", label: "America/New_York (GMT-5)" },
  { value: "UTC", label: "UTC" },
];

const schema = z.object({
  name: z.string().trim().min(2, "Company name is required."),
  legalName: z.string().trim().min(2, "Legal name is required."),
  address: z.string().trim().min(5, "Address is required."),
  country: z.string().trim().min(2, "Country is required."),
  currency: z.enum(["LKR", "USD"]),
  timezone: z.string().min(1, "Select a time zone."),
  email: z.string().trim().min(1, "Email is required.").email("Enter a valid email address."),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{9,17}$/, "Enter a valid phone number, e.g. +94 11 245 7800."),
  registrationNo: z.string().trim().min(2, "Registration number is required."),
  website: z
    .string()
    .trim()
    .refine((v) => v === "" || /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(\/\S*)?$/i.test(v), "Enter a valid website, e.g. www.example.com."),
  logo: z.string().nullable(),
});
type Values = z.infer<typeof schema>;

export function OrganizationSettings() {
  const company = useHRStore((s) => s.data.company);
  const updateCompany = useHRStore((s) => s.updateCompany);
  const toValues = React.useCallback(
    (): Values => ({
      name: company.name,
      legalName: company.legalName,
      address: company.address,
      country: company.country,
      currency: company.currency === "USD" ? "USD" : "LKR",
      timezone: company.timezone || "Asia/Colombo",
      email: company.email,
      phone: company.phone,
      registrationNo: company.registrationNo,
      website: company.website,
      logo: company.logo,
    }),
    [company],
  );
  const form = useForm<Values>({ resolver: zodResolver(schema), mode: "onTouched", defaultValues: toValues() });
  const { register, control, handleSubmit, formState, watch, setValue, reset } = form;
  const errors = formState.errors;
  const logo = watch("logo");
  const name = watch("name");

  // Pick up external changes (e.g. demo reset) when the form is pristine.
  React.useEffect(() => {
    if (!formState.isDirty) reset(toValues());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company]);

  const onSubmit = handleSubmit(async (v) => {
    await simulate(() => updateCompany({ ...v, name: v.name.trim(), website: v.website.trim() }));
    reset(v);
    toast.success("Organization settings saved", { description: `${v.name} details were updated across the workspace.` });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6" aria-label="Organization settings">
      <SectionCard title="Company profile" description="Shown in the sidebar, payslips and reports." action={<Building2 className="size-4 text-muted-foreground" />}>
        <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Company name" htmlFor="org-name" required error={errors.name?.message}>
              <Input id="org-name" aria-invalid={!!errors.name} {...register("name")} />
            </Field>
            <Field label="Legal name" htmlFor="org-legal" required error={errors.legalName?.message}>
              <Input id="org-legal" aria-invalid={!!errors.legalName} {...register("legalName")} />
            </Field>
            <Field label="Address" htmlFor="org-address" required error={errors.address?.message} className="sm:col-span-2">
              <Textarea id="org-address" rows={2} aria-invalid={!!errors.address} {...register("address")} />
            </Field>
            <Field label="Country" htmlFor="org-country" required error={errors.country?.message}>
              <Input id="org-country" aria-invalid={!!errors.country} {...register("country")} />
            </Field>
            <Field label="Registration no." htmlFor="org-registration" required error={errors.registrationNo?.message}>
              <Input id="org-registration" aria-invalid={!!errors.registrationNo} {...register("registrationNo")} />
            </Field>
          </div>
          <Field label="Company logo" htmlFor="org-logo">
            <div className="flex items-center gap-4 rounded-lg border border-border bg-subtle p-3">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="Company logo preview" className="size-14 rounded-lg border border-border object-cover" />
              ) : (
                <span className="relative">
                  <LogoGlyph className="size-14" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{name || "Company"}</p>
                <p className="text-xs text-muted-foreground">{logo ? "Custom logo" : "Default logo"}</p>
                {logo && (
                  <Button type="button" variant="ghost" size="sm" className="mt-1 -ml-2 h-7 text-destructive" onClick={() => setValue("logo", null, { shouldDirty: true })}>
                    <Trash2 /> Remove logo
                  </Button>
                )}
              </div>
            </div>
            <FileUpload
              id="org-logo"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              label="Upload logo"
              hint="Square PNG or JPG up to 2 MB"
              onFile={async (file) => {
                try {
                  setValue("logo", await readImageAsDataUrl(file, 128), { shouldDirty: true });
                } catch {
                  toast.error("That image couldn't be read", { description: "Try a PNG or JPG file." });
                }
              }}
            />
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ImageIcon className="size-3.5" /> The logo is resized to 128px and stored in this browser.
            </p>
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Contact & locale" description="Defaults used for payroll, dates and correspondence.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Email" htmlFor="org-email" required error={errors.email?.message}>
            <Input id="org-email" type="email" aria-invalid={!!errors.email} {...register("email")} />
          </Field>
          <Field label="Phone" htmlFor="org-phone" required error={errors.phone?.message}>
            <Input id="org-phone" inputMode="tel" aria-invalid={!!errors.phone} {...register("phone")} />
          </Field>
          <Field label="Website" htmlFor="org-website" error={errors.website?.message}>
            <Input id="org-website" aria-invalid={!!errors.website} placeholder="www.example.com" {...register("website")} />
          </Field>
          <Field label="Currency" htmlFor="org-currency">
            <Controller
              control={control}
              name="currency"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="org-currency">
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
          <Field label="Time zone" htmlFor="org-timezone" error={errors.timezone?.message}>
            <Controller
              control={control}
              name="timezone"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="org-timezone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {timezones.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        </div>
      </SectionCard>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        {Object.keys(errors).length > 0 && <p className="mr-auto text-sm text-destructive">Please fix the highlighted fields.</p>}
        <Button type="button" variant="outline" disabled={!formState.isDirty || formState.isSubmitting} onClick={() => reset(toValues())}>
          Discard changes
        </Button>
        <Button type="submit" loading={formState.isSubmitting}>
          Save changes
        </Button>
      </div>
    </form>
  );
}
