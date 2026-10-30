import { expect, login, test } from "../support/fixtures";

test.describe("AI HR Assistant", () => {
  test("answers from live data and applies for leave after confirmation", async ({ page }) => {
    await login(page, "Employee");
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "AI Assistant" }).click();
    await expect(page.getByText("Demo AI simulation")).toBeVisible();

    await page.getByRole("button", { name: "How many leave days do I have?" }).first().click();
    const answer = page.getByTestId("chat-assistant").last();
    await expect(answer).toContainText("You have 11 annual leave day(s) available");
    await expect(answer.getByTestId("ai-result-card")).toContainText("11 of 14 days");

    await page.getByLabel("Message the AI assistant").fill("Apply for annual leave next Monday for 2 days");
    await page.getByRole("button", { name: "Send message" }).click();
    const proposal = page.getByTestId("ai-leave-proposal");
    await expect(proposal).toContainText("Mon, 2 Nov 2026");
    await expect(proposal).toContainText("Tue, 3 Nov 2026");
    await expect(proposal).toContainText("9 day(s)");
    await proposal.getByRole("button", { name: "Confirm and submit" }).click();
    await expect(proposal).toContainText("Submitted LV-0033");
    await expect(page.getByTestId("chat-assistant").last()).toContainText("pending approval from Kasun Bandara");

    await page.getByRole("link", { name: "View my leave" }).click();
    await expect(page.getByTestId("leave-row-LV-0033")).toContainText("Pending");
  });

  test("respects role permissions", async ({ page }) => {
    await login(page, "Employee");
    await page.goto("/ai-assistant");
    await page.getByLabel("Message the AI assistant").fill("Show pending leave requests.");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("chat-assistant").last()).toContainText("can't share");
  });

  test("HR manager asks organisation questions and clears the chat", async ({ page }) => {
    await login(page, "HR Manager");
    await page.goto("/ai-assistant?q=How%20many%20employees%20work%20in%20IT%3F");
    await expect(page.getByTestId("chat-assistant").last()).toContainText("20 employees work in Software Engineering");
    await page.getByRole("button", { name: "Show pending leave requests." }).first().click();
    await expect(page.getByTestId("chat-assistant").last()).toContainText("5 pending leave requests");
    await page.getByRole("button", { name: "Clear conversation" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Clear conversation" }).click();
    await expect(page.getByTestId("chat-assistant")).toHaveCount(0);
  });
});
