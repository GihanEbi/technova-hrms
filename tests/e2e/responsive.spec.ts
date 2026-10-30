import { expect, expectNoHorizontalOverflow, login, test } from "../support/fixtures";

// Runs in the "mobile" project (390 × 844).
test.describe("Responsive layout (mobile)", () => {
  test("navigation drawer opens and navigates", async ({ page }) => {
    await login(page, "Admin");
    await expect(page.getByTestId("app-sidebar")).toBeHidden();
    await page.getByTestId("mobile-nav-trigger").click();
    const drawer = page.getByTestId("mobile-sidebar");
    await expect(drawer).toBeVisible();
    await drawer.getByRole("link", { name: "Employees" }).click();
    await page.waitForURL("**/employees");
    await expect(drawer).toBeHidden();
  });

  const pages = [
    "/dashboard", "/employees", "/employees/EMP-0005", "/employees/new", "/departments", "/attendance", "/attendance/my",
    "/attendance/calendar", "/attendance/corrections", "/leave", "/leave/my", "/leave/apply", "/leave/requests", "/leave/calendar",
    "/payroll", "/payroll/process", "/payroll/salary-structures", "/payroll/payslips", "/payroll/payslips/PS-2026-09-EMP-0005",
    "/performance", "/performance/new", "/performance/my", "/performance/EV-0001", "/reports", "/reports/employees", "/reports/attendance",
    "/reports/leave", "/reports/payroll", "/payroll/history", "/payroll/settings", "/leave/policies", "/profile", "/ai-assistant", "/notifications", "/settings",
  ];
  test("no page scrolls horizontally on a phone", async ({ page }) => {
    test.setTimeout(180_000);
    await login(page, "Admin");
    const overflowing: string[] = [];
    for (const p of pages) {
      await page.goto(p);
      await page.waitForLoadState("networkidle");
      await expect(page.locator("main")).toBeVisible();
      const px = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (px > 1) overflowing.push(`${p} (+${px}px)`);
    }
    expect(overflowing, "pages that scroll horizontally").toEqual([]);
  });

  test("forms and dialogs fit the screen", async ({ page }) => {
    await login(page, "Employee");
    await page.goto("/attendance/my");
    await page.getByRole("button", { name: "Request correction" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box!.width).toBeLessThanOrEqual(390);
    await expectNoHorizontalOverflow(page);
  });
});
