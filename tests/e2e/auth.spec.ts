import { expect, login, switchRole, test } from "../support/fixtures";

test.describe("Authentication & roles", () => {
  test("shows demo accounts and validates the sign-in form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in to your workspace" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Demo accounts" }).getByRole("button")).toHaveCount(5);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Enter your work email.")).toBeVisible();
    await page.getByLabel("Work email").fill("someone@technova-demo.lk");
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "don't match a demo account" })).toBeVisible();
  });

  test("admin signs in, sees the dashboard, switches role and logs out", async ({ page }) => {
    await login(page, "Admin");
    await expect(page.getByRole("heading", { name: /Good morning, Ruwan/ })).toBeVisible();
    await expect(page.getByTestId("kpi-total-employees")).toContainText("40");
    await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Process Payroll" })).toBeVisible();

    await switchRole(page, "HR Manager");
    await expect(page.getByRole("heading", { name: /Nadeesha/ })).toBeVisible();
    // HR managers don't see payroll
    await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Process Payroll" })).toHaveCount(0);

    await page.getByTestId("user-menu").click();
    await page.getByRole("menuitem", { name: "Log out" }).click();
    await page.waitForURL(/\/login/);
    await page.goto("/employees");
    await page.waitForURL(/\/login\?next=/);
  });

  test("each role gets its own dashboard and navigation", async ({ page }) => {
    await login(page, "Employee");
    const nav = page.getByRole("navigation", { name: "Main navigation" });
    await expect(nav.getByRole("link", { name: "My Dashboard" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "My Payslips" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Employees" })).toHaveCount(0);
    await expect(page.getByTestId("clock-card")).toBeVisible();
    await expect(page.getByTestId("leave-balance")).toBeVisible();

    await switchRole(page, "Team Lead");
    await expect(page.getByTestId("kpi-team-size")).toBeVisible();
    await expect(nav.getByRole("link", { name: "My Team" })).toBeVisible();

    await switchRole(page, "Payroll Manager");
    await expect(page.getByTestId("kpi-monthly-payroll")).toBeVisible();
    await expect(page.getByTestId("kpi-total-employees")).toHaveCount(0);
  });

  test("blocks routes the role is not allowed to open", async ({ page }) => {
    await login(page, "Employee");
    await page.goto("/payroll/process");
    await expect(page.getByText("You don't have access to this page")).toBeVisible();
  });
});
