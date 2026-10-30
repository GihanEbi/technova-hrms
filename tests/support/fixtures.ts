import { test as base, expect, type Page } from "@playwright/test";

/** Fixed demo clock: Friday 30 October 2026, 10:30 in Colombo. */
export const DEMO_NOW = new Date("2026-10-30T10:30:00+05:30");

export type DemoRole = "Admin" | "HR Manager" | "Payroll Manager" | "Team Lead" | "Employee";

/** Console messages that are expected and harmless. */
const IGNORED_CONSOLE = [/Download the React DevTools/i, /\[Fast Refresh\]/i, /\[HMR\]/i];

export async function freezeClock(page: Page, at: Date = DEMO_NOW) {
  await page.clock.setFixedTime(at);
}

export async function login(page: Page, role: DemoRole) {
  await page.goto("/login");
  await page.getByRole("button", { name: new RegExp(`^Use ${role} demo account`) }).click();
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard");
  await expect(page.locator("main h1").first()).toBeVisible();
}

export async function switchRole(page: Page, role: DemoRole) {
  await page.getByTestId("user-menu").click();
  await page.getByRole("menuitem", { name: `Switch to ${role}` }).click();
  await page.waitForURL("**/dashboard");
  await expect(page.getByTestId("user-menu")).toContainText(role);
}

export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "page should not scroll horizontally").toBeLessThanOrEqual(1);
}

/** Every test starts from a fresh browser context (empty localStorage → freshly seeded demo data)
 *  with a frozen clock, and fails if the page logs unexpected console errors. */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use, testInfo) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && !IGNORED_CONSOLE.some((r) => r.test(msg.text()))) errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(`Uncaught: ${err.message}`));
    await freezeClock(page);
    await use(errors);
    if (!testInfo.annotations.some((a) => a.type === "allow-console-errors")) {
      expect(errors, "unexpected console errors").toEqual([]);
    }
    },
    { auto: true },
  ],
});

export { expect };
