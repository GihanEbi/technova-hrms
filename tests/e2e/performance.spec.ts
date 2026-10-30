import { expect, login, test } from "../support/fixtures";

const criteria = ["Attendance & punctuality", "Communication", "Teamwork", "Quality of work", "Technical knowledge", "Problem solving", "Productivity"];

test.describe("Performance", () => {
  test("team lead creates, validates and submits an evaluation", async ({ page }) => {
    await login(page, "Team Lead");
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Evaluations" }).click();
    await expect(page.getByTestId("kpi-average-rating")).toBeVisible();
    await page.getByRole("link", { name: "New evaluation" }).first().click();
    await page.waitForURL("**/performance/new");

    await page.locator("#eval-employee").click();
    await page.getByPlaceholder(/Search/).fill("Tharushi");
    await page.getByRole("option", { name: /Tharushi Perera/ }).click();
    await page.getByRole("button", { name: "Submit evaluation" }).click();
    await expect(page.getByText("Select a rating from 1 to 5.").first()).toBeVisible();

    const ratings = [5, 4, 5, 4, 4, 5, 4];
    for (const [i, c] of criteria.entries()) {
      await page.getByRole("radiogroup", { name: `${c} rating` }).getByRole("radio", { name: String(ratings[i]) }).click();
    }
    await expect(page.getByTestId("overall-rating")).toContainText("4.43");
    await page.getByLabel("Strengths").fill("Delivered the leave module ahead of schedule.");
    await page.getByLabel("Areas for improvement").fill("Share knowledge more often.");
    await page.getByRole("button", { name: "Submit evaluation" }).click();
    await expect(page.getByText("Evaluation submitted")).toBeVisible();
    await page.waitForURL(/\/performance\/EV-\d+$/);
    await expect(page.getByText("Delivered the leave module ahead of schedule.")).toBeVisible();

    // History is visible on the employee's profile
    await page.goto("/employees/EMP-0005");
    await page.getByRole("tab", { name: "Performance" }).click();
    await expect(page.getByText(/Q4 2026 · Manager Review/)).toBeVisible();
  });

  test("employee updates a goal on My Performance", async ({ page }) => {
    await login(page, "Employee");
    await page.goto("/performance/my");
    await page.getByRole("button", { name: "Add goal" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Title").fill("Finish the Playwright course");
    await dialog.getByLabel("Due date").click();
    await page.getByRole("button", { name: /Go to the Next Month/i }).click();
    await page.getByRole("button", { name: /Go to the Next Month/i }).click();
    await page.getByRole("button", { name: /December 15th, 2026/ }).click();
    await dialog.getByRole("button", { name: "Add goal" }).click();
    await expect(page.getByText("Goal added")).toBeVisible();
    await expect(page.getByText("Finish the Playwright course", { exact: true })).toBeVisible();
  });
});
