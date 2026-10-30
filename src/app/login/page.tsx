"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowRight, BadgeCheck, Bot, Check, LockKeyhole, ShieldCheck, Wallet } from "lucide-react";
import { useHRStore } from "@/store/hr-store";
import { useHydrated } from "@/hooks/use-hr";
import { cn } from "@/lib/utils";
import { Avatar, Input, Alert } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/forms/fields";
import { LoadingState } from "@/components/shared/common";
import { LogoGlyph } from "@/components/layout/brand";
import { ThemeSwitcher } from "@/components/layout/app-header";
import { simulate } from "@/services/mock-api";

const DEMO_PASSWORD = "demo1234";

const schema = z.object({
  email: z.string().min(1, "Enter your work email.").email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});
type FormValues = z.infer<typeof schema>;

function LoginForm() {
  const hydrated = useHydrated();
  const router = useRouter();
  const params = useSearchParams();
  const demoUsers = useHRStore((s) => s.data.demoUsers);
  const employees = useHRStore((s) => s.data.employees);
  const login = useHRStore((s) => s.login);
  const [authError, setAuthError] = React.useState<string | null>(null);
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } });
  const email = form.watch("email");

  const choose = (userEmail: string) => {
    form.setValue("email", userEmail, { shouldValidate: true });
    form.setValue("password", DEMO_PASSWORD, { shouldValidate: true });
    setAuthError(null);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    setAuthError(null);
    const user = demoUsers.find((u) => u.email.toLowerCase() === values.email.toLowerCase());
    await simulate(() => null, 500);
    if (!user || values.password !== DEMO_PASSWORD) {
      setAuthError("Those credentials don't match a demo account. Pick an account below — the password is demo1234.");
      return;
    }
    login(user.id);
    const emp = employees.find((e) => e.id === user.employeeId);
    toast.success(`Welcome back, ${emp?.firstName}`, { description: `Signed in as ${user.roleLabel}.` });
    const next = params.get("next");
    router.replace(next && next.startsWith("/") && next !== "/login" ? next : "/dashboard");
  });

  if (!hydrated) return <LoadingState fullScreen />;

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(0,560px)] xl:grid-cols-[1fr_minmax(0,620px)]">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden border-r border-border bg-sidebar lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute -top-40 -left-40 size-[480px] rounded-full bg-primary/10 blur-3xl" aria-hidden />
        <div className="relative flex items-center gap-3">
          <LogoGlyph className="size-9" />
          <div className="leading-tight">
            <p className="font-semibold tracking-tight">TechNova Solutions</p>
            <p className="text-xs text-muted-foreground">HR & Payroll</p>
          </div>
        </div>
        <div className="relative max-w-md">
          <h2 className="text-3xl font-semibold tracking-tight text-balance">People operations, payroll and self-service in one calm workspace.</h2>
          <ul className="mt-8 space-y-4 text-sm">
            {[
              { icon: BadgeCheck, t: "Attendance, leave and approvals that stay in sync" },
              { icon: Wallet, t: "Deterministic LKR payroll with EPF, ETF and APIT examples" },
              { icon: Bot, t: "An AI assistant that answers from your live HR records" },
            ].map(({ icon: Icon, t }) => (
              <li key={t} className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
                  <Icon className="size-4" />
                </span>
                <span className="pt-1.5 text-muted-foreground">{t}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-muted-foreground">Frontend prototype · all data is simulated and stored in your browser.</p>
      </aside>

      {/* Form panel */}
      <main className="flex flex-col px-5 py-8 sm:px-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 lg:invisible">
            <LogoGlyph className="size-8" />
            <span className="text-sm font-semibold">TechNova HR</span>
          </div>
          <ThemeSwitcher />
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-8">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in to your workspace</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Choose a demo account to explore the app with a specific role.</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
            {authError && (
              <Alert variant="destructive">
                <LockKeyhole />
                <p>{authError}</p>
              </Alert>
            )}
            <Field label="Work email" htmlFor="email" error={form.formState.errors.email?.message}>
              <Input id="email" type="email" autoComplete="username" placeholder="name@technova-demo.lk" aria-invalid={!!form.formState.errors.email} {...form.register("email")} />
            </Field>
            <Field label="Password" htmlFor="password" error={form.formState.errors.password?.message}>
              <Input id="password" type="password" autoComplete="current-password" placeholder="••••••••" aria-invalid={!!form.formState.errors.password} {...form.register("password")} />
            </Field>
            <Button type="submit" className="w-full" size="lg" loading={form.formState.isSubmitting}>
              Sign in <ArrowRight />
            </Button>
          </form>

          <div className="mt-8">
            <div className="mb-3 flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs font-medium text-muted-foreground">Demo accounts · password demo1234</span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <ul className="grid gap-2" aria-label="Demo accounts">
              {demoUsers.map((u) => {
                const e = employees.find((x) => x.id === u.employeeId);
                const name = `${e?.firstName} ${e?.lastName}`;
                const selected = email.toLowerCase() === u.email.toLowerCase();
                return (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => choose(u.email)}
                      aria-pressed={selected}
                      aria-label={`Use ${u.roleLabel} demo account (${name})`}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 text-left shadow-xs transition-colors outline-none hover:border-primary/40 hover:bg-subtle focus-visible:ring-[3px] focus-visible:ring-ring/30",
                        selected && "border-primary bg-primary-soft/60 hover:bg-primary-soft/60",
                      )}
                    >
                      <Avatar name={name} seed={e?.id} className="size-9 text-xs" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-sm font-medium">
                          {u.roleLabel}
                          <span className="truncate font-normal text-muted-foreground">· {name}</span>
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">{u.description}</span>
                      </span>
                      {selected ? <Check className="size-4 text-primary" /> : <ShieldCheck className="size-4 text-muted-foreground/50" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingState fullScreen />}>
      <LoginForm />
    </Suspense>
  );
}
