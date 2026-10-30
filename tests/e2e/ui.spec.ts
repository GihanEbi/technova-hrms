import { expect, login, test } from "../support/fixtures";

test.describe("Theme, dialogs and accessibility", () => {
  test("switches between light, dark and system themes and persists the choice", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await login(page, "Admin");
    const html = page.locator("html");
    await page.getByTestId("theme-switcher").click();
    await page.getByRole("menuitemradio", { name: "Dark" }).click();
    await expect(html).toHaveClass(/dark/);
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe("rgb(9, 9, 15)");
    await page.reload();
    await expect(html).toHaveClass(/dark/);

    await page.goto("/settings?tab=preferences");
    await page.getByTestId("theme-option-light").click();
    await expect(html).not.toHaveClass(/dark/);
    await page.getByTestId("theme-option-system").click();
    await expect(html).not.toHaveClass(/dark/); // emulated system preference is light
  });

  test("dialogs are keyboard accessible and validate input", async ({ page }) => {
    await login(page, "Admin");
    await page.goto("/departments");
    const trigger = page.getByRole("button", { name: "Add department" });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Add department" })).toBeVisible();
    // focus is trapped inside the dialog
    for (let i = 0; i < 8; i++) await page.keyboard.press("Tab");
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    await dialog.getByRole("button", { name: "Add department" }).click();
    await expect(dialog.getByRole("alert").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("date picker opens a calendar grid", async ({ page }) => {
    await login(page, "Admin");
    await page.getByRole("button", { name: "Dashboard date" }).click();
    await expect(page.getByRole("grid")).toBeVisible();
    await page.getByRole("button", { name: /October 29th, 2026/ }).click();
    await expect(page.getByTestId("kpi-present")).toContainText("Present");
    await expect(page.getByText("Here's what's happening at TechNova Solutions on Thursday, 29 Oct.")).toBeVisible();
  });

  test("interactive controls have accessible names", async ({ page }) => {
    await login(page, "Admin");
    for (const path of ["/dashboard", "/employees", "/leave/requests", "/payroll/process", "/settings"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const unnamed = await page.evaluate(() =>
        Array.from(document.querySelectorAll("button, a[href], [role=button], input:not([type=hidden]), [role=combobox]"))
          .filter((el) => {
            const h = el as HTMLElement;
            if (h.offsetParent === null && getComputedStyle(h).position !== "fixed") return false;
            const label = h.getAttribute("aria-label") || h.getAttribute("aria-labelledby") || h.textContent?.trim() || h.getAttribute("title");
            const id = h.id;
            const forLabel = id ? document.querySelector(`label[for="${id}"]`) : null;
            return !label && !forLabel && !(h as HTMLInputElement).placeholder;
          })
          .map((el) => el.outerHTML.slice(0, 120)),
      );
      expect(unnamed, `unnamed controls on ${path}`).toEqual([]);
    }
  });

  test("notifications can be read individually and all at once", async ({ page }) => {
    await login(page, "HR Manager");
    const trigger = page.getByTestId("notifications-trigger");
    await expect(page.getByTestId("unread-count")).toBeVisible();
    await trigger.click();
    await page.getByRole("menuitem", { name: "View all notifications" }).click();
    await page.waitForURL("**/notifications");
    await page.getByRole("button", { name: "Mark all as read" }).first().click();
    await expect(page.getByTestId("unread-count")).toHaveCount(0);
  });

  test("demo data can be reset", async ({ page }) => {
    await login(page, "Admin");
    await page.goto("/employees");
    await page.getByLabel("Search employees").fill("Pradeep");
    await page.getByRole("button", { name: "Actions for Pradeep Wijeratne" }).click();
    await page.getByRole("menuitem", { name: "Archive" }).click();
    await page.getByRole("button", { name: "Archive employee" }).click();
    await expect(page.getByText("39 active employees")).toBeVisible();

    await page.goto("/settings?tab=demo");
    await page.getByRole("button", { name: "Reset demo data" }).click();
    await page.getByRole("button", { name: "Reset data" }).click();
    await expect(page.getByText("Demo data reset")).toBeVisible();
    await page.goto("/employees");
    await expect(page.getByText("40 active employees")).toBeVisible();
  });
});
