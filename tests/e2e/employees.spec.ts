import { expect, login, test } from "../support/fixtures";

test.describe("Employee management", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "HR Manager");
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Employees" }).click();
    await expect(page.getByRole("heading", { name: "Employees" })).toBeVisible();
  });

  test("searches, filters, sorts and paginates the directory", async ({ page }) => {
    await expect(page.getByText("Showing 1–10 of 40")).toBeVisible();
    await page.getByRole("button", { name: "Next page" }).click();
    await expect(page.getByText("Showing 11–20 of 40")).toBeVisible();

    await page.getByLabel("Search employees").fill("tharushi");
    await expect(page.getByTestId("employee-row-EMP-0005")).toBeVisible();
    await expect(page.getByText("Showing 1–1 of 1")).toBeVisible();

    await page.getByLabel("Search employees").fill("");
    await page.getByRole("combobox", { name: "Filter by department" }).click();
    await page.getByRole("option", { name: "Finance" }).click();
    await expect(page.getByText("Showing 1–6 of 6")).toBeVisible();

    await page.getByRole("button", { name: "Employee" }).click(); // sort by name
    await expect(page.locator("tbody tr").first()).toContainText("Anusha Balasubramaniam");

    await page.getByLabel("Search employees").fill("nobody-matches");
    await expect(page.getByText("No employees match your filters")).toBeVisible();
  });

  test("opens an employee profile with all tabs", async ({ page }) => {
    await page.getByTestId("employee-row-EMP-0005").getByRole("link", { name: /Tharushi Perera/ }).click();
    await expect(page.getByRole("heading", { name: "Tharushi Perera" })).toBeVisible();
    for (const tab of ["Employment", "Attendance", "Leave", "Payroll", "Performance"]) {
      await page.getByRole("tab", { name: tab }).click();
      await expect(page.getByRole("tab", { name: tab })).toHaveAttribute("data-state", "active");
      if (tab === "Payroll") await expect(page.getByText("September 2026").first()).toBeVisible();
    }
  });

  test("validates and adds a new employee", async ({ page }) => {
    await page.getByRole("link", { name: "Add employee" }).click();
    await page.getByRole("button", { name: "Add employee" }).click();
    await expect(page.getByText("First name is required.")).toBeVisible();
    await expect(page.getByText("Please fix the highlighted fields.")).toBeVisible();

    await page.locator("#firstName").fill("Nethmi");
    await page.locator("#lastName").fill("Kariyawasam");
    await page.locator("#email").fill("nethmi.k@technova-demo.lk");
    await page.locator("#phone").fill("+94 77 555 0101");
    await page.locator("#dateOfBirth").click();
    await page.getByRole("combobox", { name: /Choose the Year/i }).selectOption("1998");
    await page.getByRole("combobox", { name: /Choose the Month/i }).selectOption("5");
    await page.getByRole("button", { name: /June 15th, 1998/ }).click();
    await page.locator("#address").fill("No. 12, Lake Drive, Rajagiriya");
    await page.locator("#ecName").fill("Sunil Kariyawasam");
    await page.locator("#ecRelationship").fill("Parent");
    await page.locator("#ecPhone").fill("+94 71 222 3344");
    await page.locator("#departmentId").click();
    await page.getByRole("option", { name: "Marketing" }).click();
    await page.locator("#designationId").click();
    await page.getByRole("option", { name: "Content Specialist" }).click();
    await page.locator("#managerId").click();
    await page.getByPlaceholder("Search employees…").fill("Shanika");
    await page.getByRole("option", { name: /Shanika De Silva/ }).click();
    await page.locator("#basic").fill("185000");
    await page.locator("#skillInput").fill("Copywriting");
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Add employee" }).click();

    await page.waitForURL("**/employees/EMP-0041");
    await expect(page.getByRole("heading", { name: "Nethmi Kariyawasam" })).toBeVisible();
    await expect(page.getByText("Employee added")).toBeVisible();
    await page.goto("/employees");
    await expect(page.getByText("41 active employees")).toBeVisible();
  });

  test("edits an employee and saves changes", async ({ page }) => {
    await page.getByRole("button", { name: "Actions for Tharushi Perera" }).click();
    await page.getByRole("menuitem", { name: "Edit" }).click();
    await page.waitForURL("**/employees/EMP-0005/edit");
    await expect(page.locator("#firstName")).toHaveValue("Tharushi");
    await page.locator("#phone").fill("+94 77 900 1234");
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.waitForURL("**/employees/EMP-0005");
    await expect(page.getByText("+94 77 900 1234").first()).toBeVisible();
    // persists after reload
    await page.reload();
    await expect(page.getByText("+94 77 900 1234").first()).toBeVisible();
  });

  test("archives and restores an employee", async ({ page }) => {
    await page.getByLabel("Search employees").fill("Pradeep");
    await page.getByRole("button", { name: "Actions for Pradeep Wijeratne" }).click();
    await page.getByRole("menuitem", { name: "Archive" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("excluded from future payroll runs");
    await dialog.getByRole("button", { name: "Archive employee" }).click();
    await expect(page.getByText("39 active employees")).toBeVisible();

    await page.getByRole("combobox", { name: "Filter by status" }).click();
    await page.getByRole("option", { name: "Archived" }).click();
    await expect(page.getByTestId("employee-row-EMP-0030")).toContainText("Archived");
    await page.getByRole("button", { name: "Actions for Pradeep Wijeratne" }).click();
    await page.getByRole("menuitem", { name: "Restore" }).click();
    await expect(page.getByText("No archived employees")).toBeVisible();
  });
});

test.describe("Departments & designations", () => {
  test("adds a department and validates its code", async ({ page }) => {
    await login(page, "Admin");
    await page.goto("/departments");
    await page.getByRole("button", { name: "Add department" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("#dept-name").fill("Customer Success");
    await dialog.locator("#dept-code").fill("FIN");
    await dialog.getByRole("button", { name: "Add department" }).click();
    await expect(dialog.getByText("This code is already used by Finance.")).toBeVisible();
    await dialog.locator("#dept-code").fill("CS");
    await dialog.getByRole("button", { name: "Add department" }).click();
    await expect(page.getByTestId("department-card-CS")).toBeVisible();
  });

  test("prevents archiving a department that still has employees", async ({ page }) => {
    await login(page, "Admin");
    await page.goto("/departments");
    await page.getByRole("button", { name: "Actions for Finance" }).click();
    await page.getByRole("menuitem", { name: "Archive" }).click();
    await expect(page.getByRole("heading", { name: "Can't archive Finance" })).toBeVisible();
  });
});
