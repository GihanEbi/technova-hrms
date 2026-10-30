import { expect, login, switchRole, test } from "../support/fixtures";

test.describe("Leave management", () => {
  test("employee applies for leave and the team lead approves it", async ({ page }) => {
    await login(page, "Employee");
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "My Leave" }).click();
    await page.waitForURL("**/leave/my");
    await expect(page.getByTestId("balance-annual")).toContainText("11");

    await page.getByRole("link", { name: "Apply leave" }).first().click();
    await page.waitForURL("**/leave/apply");
    await page.getByRole("button", { name: "Submit request" }).click();
    await expect(page.getByText(/required|Select/i).first()).toBeVisible();

    await page.getByLabel("Leave type").click();
    await page.getByRole("option", { name: /Annual Leave/ }).click();
    await page.getByLabel("Start date").click();
    await page.getByRole("button", { name: /Go to the Next Month/i }).click();
    await page.getByRole("button", { name: /November 3rd, 2026/ }).click();
    await page.getByLabel("End date").click();
    await page.getByRole("button", { name: /November 5th, 2026/ }).click();
    await expect(page.getByTestId("summary-days")).toContainText("3");
    await expect(page.getByTestId("summary-after")).toContainText("8");
    await page.getByLabel("Reason").fill("Family wedding in Kandy");
    await page.getByRole("button", { name: "Submit request" }).click();

    await page.waitForURL("**/leave/my");
    await expect(page.getByText("Leave request submitted")).toBeVisible();
    await expect(page.getByTestId("leave-row-LV-0033")).toContainText("Pending");

    // Manager sees and approves the request
    await switchRole(page, "Team Lead");
    await expect(page.getByTestId("pending-approvals")).toContainText("Tharushi Perera");
    await page.goto("/leave/requests");
    await expect(page.getByTestId("leave-request-LV-0033")).toBeVisible();
    await page.getByRole("button", { name: "Approve LV-0033" }).click();
    const dialog = page.getByRole("dialog", { name: "Approve leave request" });
    await dialog.getByLabel("Comment").fill("Enjoy the wedding!");
    await dialog.getByRole("button", { name: "Approve request" }).click();
    await expect(page.getByText("Leave request approved")).toBeVisible();
    await expect(page.getByTestId("leave-request-LV-0033")).toContainText("Approved");

    // Employee sees the updated status and a notification
    await switchRole(page, "Employee");
    await page.goto("/leave/my");
    await expect(page.getByTestId("leave-row-LV-0033")).toContainText("Approved");
    await page.getByTestId("notifications-trigger").click();
    await expect(page.getByRole("menuitem", { name: /Leave request approved/ }).first()).toBeVisible();
  });

  test("rejection requires a comment", async ({ page }) => {
    await login(page, "HR Manager");
    await page.goto("/leave/requests");
    await page.getByRole("button", { name: "Reject LV-0028" }).click();
    const dialog = page.getByRole("dialog", { name: "Reject leave request" });
    await dialog.getByRole("button", { name: "Reject request" }).click();
    await expect(dialog.getByRole("alert").or(dialog.getByText(/comment/i)).first()).toBeVisible();
    await dialog.getByLabel("Comment").fill("Overlaps with the quarterly audit.");
    await dialog.getByRole("button", { name: "Reject request" }).click();
    await expect(page.getByText("Leave request rejected")).toBeVisible();
  });

  test("employee cancels a pending request", async ({ page }) => {
    await login(page, "Employee");
    await page.goto("/leave/apply?type=casual&start=2026-11-02&end=2026-11-02");
    await page.getByLabel("Reason").fill("Personal errand");
    await page.getByRole("button", { name: "Submit request" }).click();
    await page.waitForURL("**/leave/my");
    await page.getByRole("button", { name: "Cancel LV-0033" }).click();
    await page.getByRole("button", { name: "Cancel request" }).click();
    await expect(page.getByText("Leave request cancelled")).toBeVisible();
    await expect(page.getByTestId("leave-row-LV-0033")).toContainText("Cancelled");
  });

  test("shows the leave calendar and policies", async ({ page }) => {
    await login(page, "HR Manager");
    await page.goto("/leave/calendar");
    await expect(page.getByTestId("leave-calendar")).toBeVisible();
    await page.getByRole("button", { name: "Next month" }).click();
    await page.goto("/leave/policies");
    await expect(page.getByTestId("policy-annual")).toContainText("14");
    await expect(page.getByTestId("holiday-list")).toContainText("Deepavali");
  });
});
