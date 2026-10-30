"use client";

import * as React from "react";
import { ThemeProvider, useTheme } from "next-themes";
import { Toaster } from "sonner";
import { MotionConfig, MotionGlobalConfig } from "motion/react";
import { TooltipProvider } from "@/components/ui/primitives";

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      theme={(resolvedTheme as "light" | "dark") ?? "light"}
      position="bottom-right"
      closeButton
      toastOptions={{
        classNames: {
          toast: "!bg-surface-elevated !text-foreground !border-border !shadow-lg !rounded-lg",
          description: "!text-muted-foreground",
          closeButton: "!bg-surface-elevated !border-border !text-muted-foreground",
        },
      }}
    />
  );
}

// Under browser automation (Playwright) the clock can be frozen for deterministic
// screenshots; JS-driven animations would then never finish, so skip them there.
if (typeof navigator !== "undefined" && navigator.webdriver) MotionGlobalConfig.skipAnimations = true;

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange storageKey="technova-theme">
      <TooltipProvider>
        {children}
        <ThemedToaster />
      </TooltipProvider>
    </ThemeProvider>
    </MotionConfig>
  );
}
