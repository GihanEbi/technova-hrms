import { expect, freezeClock, login, test } from "../support/fixtures";

test.describe("Attendance", () => {
  test("employee clocks in late and clocks out with worked hours", async ({ page }) => {
    await login(page, "Employee");
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "My Attendance" }).click();
    await page.waitForURL("**/attendance/my");
    const status = page.getByTestId("today-status");
    await expect(status).toHaveText("Not clocked in");
    await expect(page.getByRole("button", { name: "Clock out" })).toBeDisabled();

    await page.getByRole("button", { name: "Clock in" }).click();
    await expect(page.getByText("Clocked in", { exact: true })).toBeVisible();
    await expect(status).toContainText("Working since 10:30 AM");
    await expect(page.getByRole("button", { name: "Clock in" })).toBeDisabled();

    // Move the clock to the end of the day
    await freezeClock(page, new Date("2026-10-30T18:05:00+05:30"));
    await page.getByRole("button", { name: "Clock out" }).click();
    await expect(page.getByText("You worked 7h 35m today.")).toBeVisible();
    await expect(status).toContainText("Completed — 7h 35m");

    // Today's record shows up in history as Late (after 09:15)
    await expect(page.getByTestId("history-row-2026-10-30")).toContainText("Late");

    // The dashboard reflects it too
    await page.goto("/dashboard");
    await expect(page.getByTestId("today-status")).toContainText("Completed");
  });

  test("employee submits an attendance correction and the team lead approves it", async ({ page }) => {
    await login(page, "Employee");
    await page.goto("/attendance/my");
    await page.getByRole("button", { name: "Request correction" }).click();
    const dialog = page.getByRole("dialog", { name: "Request attendance correction" });
    await dialog.getByRole("button", { name: "Submit request" }).click();
    await expect(dialog.getByRole("alert").first()).toBeVisible();

    await dialog.getByLabel("Date").click();
    await page.getByRole("button", { name: /October 28th, 2026/ }).click();
    await dialog.getByLabel("Corrected clock in").fill("08:55");
    await dialog.getByLabel("Corrected clock out").fill("17:40");
    await dialog.getByLabel("Reason").fill("Fingerprint scanner was offline in the morning.");
    await dialog.getByRole("button", { name: "Submit request" }).click();
    await expect(page.getByText("Correction request submitted")).toBeVisible();
    await expect(page.getByTestId("my-correction-COR-0005")).toContainText("Pending");

    // Team lead approves
    await page.getByTestId("user-menu").click();
    await page.getByRole("menuitem", { name: "Switch to Team Lead" }).click();
    await page.waitForURL("**/dashboard");
    await page.goto("/attendance/corrections");
    await page.getByRole("button", { name: "Approve COR-0005" }).click();
    const review = page.getByRole("dialog", { name: "Approve correction" });
    await review.getByLabel("Comment").fill("Confirmed with security.");
    await review.getByRole("button", { name: "Approve correction" }).click();
    await expect(page.getByText("Correction approved")).toBeVisible();
  });

  test("manager views daily attendance, filters by date and opens the calendar", async ({ page }) => {
    await login(page, "HR Manager");
    await page.goto("/attendance");
    await expect(page.getByTestId("kpi-present")).toBeVisible();
    await expect(page.getByTestId("attendance-row-EMP-0006")).toBeVisible();

    await page.getByRole("button", { name: "Date" }).click();
    await page.getByRole("button", { name: /October 24th, 2026/ }).click(); // a Saturday
    await expect(page.getByText(/No working day/).first()).toBeVisible();

    await page.getByRole("link", { name: "Calendar" }).click();
    await page.waitForURL("**/attendance/calendar");
    const calendar = page.getByTestId("attendance-calendar");
    await expect(calendar).toBeVisible();
    await expect(page.getByTestId("calendar-month")).toContainText("October 2026");
    await page.getByRole("button", { name: "Previous month" }).click();
    await expect(page.getByTestId("calendar-month")).toContainText("September 2026");
  });
});
