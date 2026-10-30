// Documentation screenshot capture. Run with `npm run docs:screenshots`.
// Every test uses a fresh context, freshly seeded demo data and a frozen clock
// (Fri 30 Oct 2026, 10:30 Asia/Colombo), so output is repeatable.
import { expect, test } from "@playwright/test";
import { freezeClock } from "../support/fixtures";
import { login, newDocsContext, settle, shot, switchRole } from "./helpers";

test.describe.configure({ mode: "serial" });

test("general: login, dashboards, sidebar and themes", async ({ browser }) => {
  const { context, page } = await newDocsContext(browser);
  await page.goto("/login");
  await settle(page);
  await shot(page, "desktop/01-login.png");
  await page.getByRole("button", { name: /^Use Admin demo account/ }).click();
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard");
  await settle(page, 900);
  await shot(page, "desktop/02-dashboard-admin.png");
  await shot(page, "desktop/02-dashboard-admin-full.png", { fullPage: true });
  await shot(page, "desktop/03-sidebar-expanded.png", { locator: page.getByTestId("app-sidebar") });
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await settle(page, 400);
  await shot(page, "desktop/04-sidebar-collapsed.png");
  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await page.getByTestId("notifications-trigger").click();
  await settle(page, 300);
  await shot(page, "desktop/05-notifications-dropdown.png");
  await page.keyboard.press("Escape");
  await page.getByTestId("user-menu").click();
  await settle(page, 300);
  await shot(page, "desktop/06-user-menu-role-switcher.png");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+k");
  await settle(page, 300);
  await page.getByRole("combobox", { name: "Search pages, employees or actions" }).fill("Tharushi");
  await settle(page, 300);
  await shot(page, "desktop/07-command-search.png");
  await page.keyboard.press("Escape");
  await page.goto("/notifications");
  await settle(page);
  await shot(page, "desktop/08-notifications-page.png");

  for (const [role, file] of [
    ["HR Manager", "09-dashboard-hr-manager.png"],
    ["Payroll Manager", "10-dashboard-payroll-manager.png"],
    ["Team Lead", "11-dashboard-team-lead.png"],
    ["Employee", "12-dashboard-employee.png"],
  ] as const) {
    await switchRole(page, role);
    await settle(page, 900);
    await shot(page, `desktop/${file}`);
  }
  await context.close();
});

test("employees and departments", async ({ browser }) => {
  const { context, page } = await newDocsContext(browser);
  await login(page, "HR Manager");
  await page.goto("/employees");
  await settle(page);
  await shot(page, "desktop/20-employee-directory.png");
  await page.getByRole("combobox", { name: "Filter by department" }).click();
  await page.getByRole("option", { name: "Software Engineering" }).click();
  await page.getByLabel("Search employees").fill("engineer");
  await settle(page, 300);
  await shot(page, "workflows/employee-search-and-filter.png");
  await page.goto("/employees/new");
  await settle(page);
  await shot(page, "desktop/21-add-employee-form.png");
  await page.getByRole("button", { name: "Add employee" }).click();
  await page.waitForTimeout(400);
  await shot(page, "workflows/employee-form-validation.png");
  await page.goto("/employees/EMP-0005");
  await settle(page);
  await shot(page, "desktop/22-employee-profile.png");
  await page.getByRole("tab", { name: "Leave" }).click();
  await settle(page, 300);
  await shot(page, "workflows/employee-profile-leave-tab.png");
  await page.getByRole("tab", { name: "Payroll" }).click();
  await settle(page, 300);
  await shot(page, "workflows/employee-profile-payroll-tab.png");
  await page.goto("/employees/EMP-0005/edit");
  await settle(page);
  await shot(page, "desktop/23-edit-employee-form.png");
  await page.goto("/employees");
  await page.getByLabel("Search employees").fill("Pradeep");
  await page.getByRole("button", { name: "Actions for Pradeep Wijeratne" }).click();
  await page.getByRole("menuitem", { name: "Archive" }).click();
  await settle(page, 300);
  await shot(page, "workflows/employee-archive-confirmation.png");
  await page.keyboard.press("Escape");
  await page.goto("/departments");
  await settle(page, 700);
  await shot(page, "desktop/24-departments.png");
  await page.getByRole("button", { name: "Add department" }).click();
  await settle(page, 300);
  await shot(page, "workflows/department-add-dialog.png");
  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: "Designations" }).click();
  await settle(page, 300);
  await shot(page, "desktop/25-designations.png");
  await context.close();
});

test("attendance", async ({ browser }) => {
  const { context, page } = await newDocsContext(browser);
  await login(page, "HR Manager");
  await page.goto("/attendance");
  await settle(page, 700);
  await shot(page, "desktop/30-attendance-overview.png");
  await page.goto("/attendance/calendar");
  await settle(page);
  await shot(page, "desktop/31-attendance-calendar.png");
  await page.goto("/attendance/corrections");
  await settle(page);
  await shot(page, "desktop/32-attendance-corrections.png");
  await switchRole(page, "Employee");
  await page.goto("/attendance/my");
  await settle(page);
  await shot(page, "desktop/33-my-attendance.png");
  await page.getByRole("button", { name: "Clock in" }).click();
  await expect(page.getByTestId("today-status")).toContainText("Working since");
  await settle(page, 300);
  await shot(page, "workflows/attendance-clocked-in.png", { keepToasts: true });
  await freezeClock(page, new Date("2026-10-30T18:05:00+05:30"));
  await page.getByRole("button", { name: "Clock out" }).click();
  await expect(page.getByTestId("today-status")).toContainText("Completed");
  await settle(page, 300);
  await shot(page, "workflows/attendance-clocked-out.png", { keepToasts: true });
  await page.getByTestId("history-row-2026-10-30").scrollIntoViewIfNeeded();
  await shot(page, "desktop/34-attendance-history.png");
  await page.getByRole("button", { name: "Request correction" }).click();
  const dialog = page.getByRole("dialog", { name: "Request attendance correction" });
  await dialog.getByLabel("Date").click();
  await page.getByRole("button", { name: /October 28th, 2026/ }).click();
  await dialog.getByLabel("Reason").fill("Fingerprint scanner was offline in the morning.");
  await settle(page, 300);
  await shot(page, "workflows/attendance-correction-form.png");
  await context.close();
});

test("leave", async ({ browser }) => {
  const { context, page } = await newDocsContext(browser);
  await login(page, "Employee");
  await page.goto("/leave/my");
  await settle(page);
  await shot(page, "desktop/40-my-leave.png");
  await page.goto("/leave/apply");
  await settle(page);
  await page.getByLabel("Leave type").click();
  await page.getByRole("option", { name: /Annual Leave/ }).click();
  await page.getByLabel("Start date").click();
  await page.getByRole("button", { name: /Go to the Next Month/i }).click();
  await page.getByRole("button", { name: /November 3rd, 2026/ }).click();
  await page.getByLabel("End date").click();
  await settle(page, 300);
  await shot(page, "workflows/leave-date-picker.png");
  await page.getByRole("button", { name: /November 5th, 2026/ }).click();
  await page.getByLabel("Reason").fill("Family wedding in Kandy");
  await settle(page, 300);
  await shot(page, "desktop/41-apply-leave-form.png");
  await page.getByRole("button", { name: "Submit request" }).click();
  await page.waitForURL("**/leave/my");
  await settle(page, 300);
  await shot(page, "workflows/leave-request-submitted.png", { keepToasts: true });
  await page.goto("/leave/calendar");
  await settle(page);
  await shot(page, "desktop/42-leave-calendar.png");
  await page.goto("/leave/policies");
  await settle(page);
  await shot(page, "desktop/43-leave-policies.png");

  await switchRole(page, "Team Lead");
  await page.goto("/leave/requests");
  await settle(page);
  await shot(page, "desktop/44-leave-pending-requests.png");
  await page.getByRole("button", { name: "Approve LV-0033" }).click();
  await page.getByRole("dialog", { name: "Approve leave request" }).getByLabel("Comment").fill("Enjoy the wedding!");
  await settle(page, 300);
  await shot(page, "workflows/leave-approval-confirmation.png");
  await page.getByRole("button", { name: "Approve request" }).click();
  await expect(page.getByTestId("leave-request-LV-0033")).toContainText("Approved");
  await settle(page, 300);
  await shot(page, "workflows/leave-approved-state.png", { keepToasts: true });
  await switchRole(page, "HR Manager");
  await page.goto("/leave");
  await settle(page, 700);
  await shot(page, "desktop/45-leave-overview.png");
  await context.close();
});

test("payroll", async ({ browser }) => {
  const { context, page } = await newDocsContext(browser);
  await login(page, "Payroll Manager");
  await page.goto("/payroll");
  await settle(page, 900);
  await shot(page, "desktop/50-payroll-dashboard.png");
  await page.goto("/payroll/salary-structures");
  await settle(page);
  await shot(page, "desktop/51-salary-structures.png");
  await page.getByRole("button", { name: "Edit salary for EMP-0005" }).click();
  await settle(page, 400);
  await shot(page, "workflows/salary-structure-edit.png");
  await page.keyboard.press("Escape");
  await page.goto("/payroll/process");
  await settle(page);
  await shot(page, "desktop/52-payroll-processing.png");
  await page.getByRole("button", { name: "Generate payroll" }).click();
  await expect(page.getByTestId("payroll-status")).toHaveText("Draft");
  await settle(page, 500);
  await shot(page, "desktop/53-payroll-preview.png");
  await shot(page, "workflows/payroll-preview-full.png", { fullPage: true });
  await page.getByTestId("payroll-warnings").scrollIntoViewIfNeeded();
  await shot(page, "workflows/payroll-warnings.png", { locator: page.getByTestId("payroll-warnings") });
  await page.getByRole("button", { name: "Submit for approval" }).click();
  await page.getByRole("button", { name: "Approve payroll" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Approve payroll" }).click();
  await expect(page.getByTestId("payroll-status")).toHaveText("Approved");
  await page.getByRole("button", { name: "Process payroll" }).click();
  await settle(page, 300);
  await shot(page, "desktop/54-payroll-confirmation.png");
  await page.getByRole("alertdialog").getByRole("button", { name: "Process payroll" }).click();
  await expect(page.getByTestId("payroll-success")).toBeVisible();
  await settle(page, 300);
  await shot(page, "workflows/payroll-processed.png", { keepToasts: true });
  await page.goto("/payroll/payslips?period=2026-10");
  await settle(page);
  await shot(page, "desktop/55-payslips-list.png");
  await page.goto("/payroll/payslips/PS-2026-10-EMP-0005");
  await settle(page);
  await shot(page, "desktop/56-payslip-preview.png");
  await shot(page, "workflows/payslip-document.png", { locator: page.getByTestId("payslip-document") });
  await page.goto("/payroll/history");
  await settle(page);
  await shot(page, "desktop/57-payroll-history.png");
  await page.goto("/payroll/settings");
  await settle(page);
  await shot(page, "desktop/58-payroll-settings.png");
  await context.close();
});

test("performance, AI assistant, reports and settings", async ({ browser }) => {
  const { context, page } = await newDocsContext(browser);
  await login(page, "Team Lead");
  await page.goto("/performance");
  await settle(page, 700);
  await shot(page, "desktop/60-performance-evaluations.png");
  await page.goto("/performance/new?employee=EMP-0005");
  await settle(page);
  const ratings = [5, 4, 5, 4, 4, 5, 4];
  const groups = page.getByRole("radiogroup");
  for (let i = 0; i < 7; i++) await groups.nth(i).getByRole("radio", { name: String(ratings[i]) }).click();
  await page.getByLabel("Strengths").fill("Delivered the leave module ahead of schedule and mentored a new joiner.");
  await page.getByLabel("Areas for improvement").fill("Share knowledge more often through documentation.");
  await settle(page, 300);
  await shot(page, "desktop/61-evaluation-form.png");
  await page.getByRole("button", { name: "Submit evaluation" }).click();
  await page.waitForURL(/\/performance\/EV-\d+$/);
  await settle(page);
  await shot(page, "desktop/62-evaluation-details.png");
  await switchRole(page, "Employee");
  await page.goto("/performance/my");
  await settle(page);
  await shot(page, "desktop/63-my-performance.png");

  await page.goto("/ai-assistant");
  await settle(page);
  await shot(page, "desktop/70-ai-assistant.png");
  const input = page.getByLabel("Message the AI assistant");
  await input.fill("How many leave days do I have?");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("chat-assistant").last()).toContainText("annual leave day");
  await settle(page, 300);
  await shot(page, "desktop/71-ai-leave-query.png");
  await input.fill("Apply for annual leave next Monday for 2 days");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("ai-leave-proposal")).toBeVisible();
  await settle(page, 400);
  await shot(page, "desktop/72-ai-action-confirmation.png");
  await page.getByRole("button", { name: "Confirm and submit" }).click();
  await expect(page.getByTestId("chat-assistant").last()).toContainText("pending approval");
  await settle(page, 400);
  await shot(page, "desktop/73-ai-result-card.png");

  await switchRole(page, "Admin");
  await page.goto("/reports");
  await settle(page);
  await shot(page, "desktop/80-reports-overview.png");
  for (const r of ["employees", "attendance", "leave", "payroll"]) {
    await page.goto(`/reports/${r}`);
    await settle(page, 700);
    await shot(page, `desktop/81-report-${r}.png`);
  }
  await page.goto("/settings?tab=organization");
  await settle(page);
  await shot(page, "desktop/90-settings-organization.png");
  await page.goto("/settings?tab=leave");
  await settle(page);
  await shot(page, "desktop/91-settings-leave-policies.png");
  await page.goto("/settings?tab=preferences");
  await settle(page);
  await shot(page, "desktop/92-settings-theme.png");
  await page.goto("/settings?tab=demo");
  await settle(page);
  await shot(page, "desktop/93-settings-demo.png");
  await context.close();
});

test("dark mode", async ({ browser }) => {
  const { context, page } = await newDocsContext(browser, { theme: "dark" });
  await login(page, "Admin");
  await settle(page, 900);
  await shot(page, "dark-mode/01-dashboard.png");
  const pages: [string, string][] = [
    ["/employees", "02-employees.png"],
    ["/employees/EMP-0005", "03-employee-profile.png"],
    ["/attendance", "04-attendance.png"],
    ["/leave/requests", "05-leave-requests.png"],
    ["/payroll", "06-payroll-dashboard.png"],
    ["/payroll/payslips/PS-2026-09-EMP-0005", "07-payslip.png"],
    ["/performance", "08-performance.png"],
    ["/reports/payroll", "09-reports.png"],
    ["/settings?tab=preferences", "10-settings.png"],
  ];
  for (const [path, file] of pages) {
    await page.goto(path);
    await settle(page, 700);
    await shot(page, `dark-mode/${file}`);
  }
  await page.goto("/leave/apply");
  await settle(page);
  await page.getByLabel("Start date").click();
  await settle(page, 300);
  await shot(page, "dark-mode/11-date-picker.png");
  await page.keyboard.press("Escape");
  await page.goto("/ai-assistant?q=How%20many%20employees%20are%20absent%20today%3F");
  await expect(page.getByTestId("chat-assistant").last()).toBeVisible();
  await settle(page, 400);
  await shot(page, "dark-mode/12-ai-assistant.png");
  await context.close();
});

test("tablet", async ({ browser }) => {
  const { context, page } = await newDocsContext(browser, { viewport: "tablet" });
  await login(page, "Admin");
  await settle(page, 900);
  await shot(page, "tablet/01-dashboard.png");
  for (const [path, file] of [
    ["/employees", "02-employees.png"],
    ["/leave/apply", "03-apply-leave.png"],
    ["/payroll/process", "04-payroll-processing.png"],
    ["/attendance/calendar", "05-attendance-calendar.png"],
  ] as const) {
    await page.goto(path);
    await settle(page, 600);
    await shot(page, `tablet/${file}`);
  }
  await context.close();
});

test("mobile", async ({ browser }) => {
  const { context, page } = await newDocsContext(browser, { viewport: "mobile" });
  await page.goto("/login");
  await settle(page);
  await shot(page, "mobile/01-login.png");
  await login(page, "Employee");
  await settle(page, 900);
  await shot(page, "mobile/02-dashboard.png");
  await page.getByTestId("mobile-nav-trigger").click();
  await settle(page, 400);
  await shot(page, "mobile/03-navigation-drawer.png");
  await page.keyboard.press("Escape");
  await page.goto("/leave/apply");
  await settle(page);
  await shot(page, "mobile/04-apply-leave-form.png");
  await page.getByLabel("Start date").click();
  await settle(page, 300);
  await shot(page, "mobile/05-date-picker.png");
  await page.keyboard.press("Escape");
  await page.goto("/attendance/my");
  await settle(page);
  await shot(page, "mobile/06-my-attendance.png");
  await page.getByRole("button", { name: "Request correction" }).click();
  await settle(page, 400);
  await shot(page, "mobile/07-correction-dialog.png");
  await page.keyboard.press("Escape");
  await page.goto("/payroll/payslips/PS-2026-09-EMP-0005");
  await settle(page);
  await shot(page, "mobile/08-payslip.png");
  await page.goto("/ai-assistant?q=How%20many%20leave%20days%20do%20I%20have%3F");
  await expect(page.getByTestId("chat-assistant").last()).toBeVisible();
  await settle(page, 400);
  await shot(page, "mobile/09-ai-assistant.png");
  await switchRole(page, "HR Manager");
  await page.goto("/employees");
  await settle(page);
  await shot(page, "mobile/10-employee-directory.png");
  await page.goto("/leave/requests");
  await settle(page);
  await page.getByRole("button", { name: "Approve LV-0029" }).click();
  await settle(page, 400);
  await shot(page, "mobile/11-approval-dialog.png");
  await context.close();
});
