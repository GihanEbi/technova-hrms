import { mkdirSync, existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { expect, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { DEMO_NOW, type DemoRole } from "../support/fixtures";

export const DOCS_DIR = join(process.cwd(), "docs");
export const SHOTS_DIR = join(DOCS_DIR, "screenshots");
export const VIDEOS_DIR = join(DOCS_DIR, "videos");

export const viewports = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 },
} as const;

export async function newDocsContext(
  browser: Browser,
  opts: { viewport?: keyof typeof viewports; theme?: "light" | "dark"; video?: boolean } = {},
) {
  const viewport = viewports[opts.viewport ?? "desktop"];
  const context = await browser.newContext({
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    viewport,
    deviceScaleFactor: opts.viewport === "mobile" ? 2 : 1,
    hasTouch: opts.viewport === "mobile",
    timezoneId: "Asia/Colombo",
    locale: "en-US",
    colorScheme: opts.theme ?? "light",
    recordVideo: opts.video ? { dir: join(process.cwd(), "test-results", "docs-video-tmp"), size: viewport } : undefined,
  });
  const theme = opts.theme ?? "light";
  await context.addInitScript((t) => {
    try {
      if (!localStorage.getItem("technova-theme")) localStorage.setItem("technova-theme", t);
    } catch {}
  }, theme);
  if (opts.video) await context.addInitScript(cursorScript);
  const page = await context.newPage();
  await page.clock.setFixedTime(DEMO_NOW);
  return { context, page };
}

export async function login(page: Page, role: DemoRole, opts: { slow?: boolean } = {}) {
  await page.goto("/login");
  const account = page.getByRole("button", { name: new RegExp(`^Use ${role} demo account`) });
  if (opts.slow) {
    await pause(page, 900);
    await smoothClick(page, account);
    await pause(page, 700);
    await smoothClick(page, page.getByRole("button", { name: "Sign in" }));
  } else {
    await account.click();
    await page.getByRole("button", { name: "Sign in" }).click();
  }
  await page.waitForURL("**/dashboard");
  await settle(page);
}

export async function switchRole(page: Page, role: DemoRole, slow = false) {
  const click = (l: Locator) => (slow ? smoothClick(page, l) : l.click());
  await click(page.getByTestId("user-menu"));
  if (slow) await pause(page, 700);
  await click(page.getByRole("menuitem", { name: `Switch to ${role}` }));
  await page.waitForURL("**/dashboard");
  await settle(page);
}

/** Wait until fonts, network and entry animations are done, and dismiss toasts. */
export async function settle(page: Page, extra = 450) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByText("Loading workspace…")).toHaveCount(0);
  await page.waitForTimeout(extra);
}

export async function clearToasts(page: Page) {
  await page.evaluate(() => document.querySelectorAll("[data-sonner-toast]").forEach((t) => ((t as HTMLElement).style.display = "none")));
}

export async function shot(page: Page, relPath: string, opts: { fullPage?: boolean; keepToasts?: boolean; locator?: Locator } = {}) {
  const file = join(SHOTS_DIR, relPath);
  mkdirSync(dirname(file), { recursive: true });
  if (!opts.keepToasts) await clearToasts(page);
  await page.waitForTimeout(250);
  if (opts.locator) await opts.locator.screenshot({ path: file, animations: "disabled" });
  else await page.screenshot({ path: file, fullPage: opts.fullPage ?? false, animations: "disabled" });
  if (!existsSync(file) || statSync(file).size < 2000) throw new Error(`Screenshot was not written correctly: ${relPath}`);
}

export const pause = (page: Page, ms = 800) => page.waitForTimeout(ms);

/** Move the mouse visibly to an element before clicking — makes walkthrough videos easy to follow. */
export async function smoothClick(page: Page, locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 18 });
    await page.waitForTimeout(180);
  }
  await locator.click();
}

export async function slowType(page: Page, locator: Locator, text: string) {
  await smoothClick(page, locator);
  await locator.pressSequentially(text, { delay: 45 });
}

/** Saves a context's recorded video under docs/videos/<name>.webm. Closes the context. */
export async function saveVideo(context: BrowserContext, page: Page, name: string) {
  const video = page.video();
  await context.close();
  if (!video) throw new Error("Video recording was not enabled for this context");
  mkdirSync(VIDEOS_DIR, { recursive: true });
  const target = join(VIDEOS_DIR, `${name}.webm`);
  await video.saveAs(target);
  if (!existsSync(target) || statSync(target).size < 50_000) throw new Error(`Video ${name} was not generated correctly`);
}

/** A visible cursor + click ripple for screen recordings (Playwright videos don't show the pointer). */
const cursorScript = () => {
  window.addEventListener("DOMContentLoaded", () => {
    const cursor = document.createElement("div");
    cursor.id = "pw-cursor";
    Object.assign(cursor.style, {
      position: "fixed", top: "0", left: "0", width: "18px", height: "18px", borderRadius: "50%",
      background: "rgba(99,102,241,0.35)", border: "2px solid rgba(79,70,229,0.9)", zIndex: "2147483647",
      pointerEvents: "none", transform: "translate(-50%,-50%)", transition: "width .12s, height .12s, background .12s",
    } as Record<string, string>);
    cursor.style.left = "-40px";
    document.body.appendChild(cursor);
    document.addEventListener("mousemove", (e) => {
      cursor.style.left = `${e.clientX}px`;
      cursor.style.top = `${e.clientY}px`;
    }, true);
    document.addEventListener("mousedown", () => {
      cursor.style.width = "28px";
      cursor.style.height = "28px";
      cursor.style.background = "rgba(99,102,241,0.55)";
    }, true);
    document.addEventListener("mouseup", () => {
      cursor.style.width = "18px";
      cursor.style.height = "18px";
      cursor.style.background = "rgba(99,102,241,0.35)";
    }, true);
  });
};
