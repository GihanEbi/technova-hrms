import { expect, login, test } from "../support/fixtures";

test.describe("Payroll", () => {
  test("payroll manager reviews salaries, processes October payroll and downloads a payslip", async ({ page }) => {
    await login(page, "Payroll Manager");
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Payroll Overview" }).click();
    await expect(page.getByTestId("kpi-total-payroll")).toBeVisible();
    await expect(page.getByTestId("current-period-card")).toContainText("Start payroll");

    // Salary structures
    await page.goto("/payroll/salary-structures");
    await page.getByRole("button", { name: "Edit salary for EMP-0005" }).click();
    const dialog = page.getByRole("dialog", { name: "Edit salary structure" });
    await expect(dialog.getByTestId("salary-preview")).toBeVisible();
    await dialog.getByLabel("Bonus").fill("15000");
    await expect(dialog.getByTestId("salary-preview-net")).not.toHaveText("");
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Salary structure updated")).toBeVisible();

    // Process payroll
    await page.goto("/payroll/process");
    await expect(page.getByLabel("Payroll period")).toContainText("October 2026");
    await page.getByRole("button", { name: "Generate payroll" }).click();
    await expect(page.getByTestId("payroll-status")).toHaveText("Draft");
    await expect(page.getByTestId("payroll-warnings")).toContainText("Yasiru Pathirana");
    await expect(page.getByTestId("payroll-totals")).toBeVisible();
    await page.getByTestId("payroll-row-EMP-0005").click();
    await expect(page.getByRole("dialog", { name: /Payroll breakdown/ })).toContainText("15,000");
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Submit for approval" }).click();
    await expect(page.getByTestId("payroll-status")).toHaveText("Pending Approval");
    await page.getByRole("button", { name: "Approve payroll" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Approve payroll" }).click();
    await expect(page.getByTestId("payroll-status")).toHaveText("Approved");
    await page.getByRole("button", { name: "Process payroll" }).click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toContainText("Process payroll for October 2026?");
    await confirm.getByRole("button", { name: "Process payroll" }).click();
    await expect(page.getByTestId("payroll-success")).toBeVisible();
    await expect(page.getByTestId("payroll-status")).toHaveText("Processed");

    // Double processing is impossible
    await page.reload();
    await expect(page.getByTestId("payroll-processed-alert")).toBeVisible();
    await expect(page.getByRole("button", { name: "Process payroll" })).toHaveCount(0);

    // Payslip
    await page.goto("/payroll/payslips?period=2026-10");
    await page.getByRole("link", { name: "View payslip PS-2026-10-EMP-0005" }).click();
    await expect(page.getByTestId("payslip-document")).toContainText("Tharushi Perera");
    await expect(page.getByTestId("payslip-document")).toContainText("October 2026");
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download PDF" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("payslip-EMP-0005-2026-10.pdf");
  });

  test("employees only see their own payslips", async ({ page }) => {
    await login(page, "Employee");
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "My Payslips" }).click();
    await expect(page.getByRole("heading", { name: "My Payslips" })).toBeVisible();
    await expect(page.getByTestId("latest-payslip")).toContainText("September 2026");
    await page.goto("/payroll/payslips/PS-2026-09-EMP-0006");
    await expect(page.getByText("You don't have access to this page")).toBeVisible();
  });

  test("reports export real CSV files", async ({ page }) => {
    await login(page, "Payroll Manager");
    await page.goto("/reports/payroll");
    await expect(page.getByTestId("report-totals")).toBeVisible();
    const csv = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download CSV" }).click();
    expect((await csv).suggestedFilename()).toMatch(/payroll-report-.*\.csv$/);
    const pdf = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export PDF" }).click();
    expect((await pdf).suggestedFilename()).toMatch(/\.pdf$/);
  });
});
