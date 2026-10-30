import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration
 * - e2e:     functional tests on desktop Chromium (failure screenshots, video and traces retained)
 * - mobile:  responsive checks at 390 × 844
 * - docs:    documentation capture (screenshots + walkthrough videos), run via `npm run docs:*`
 *
 * The app is served from a production build on http://localhost:3000. Set PW_DEV=1 to test
 * against `next dev` instead. An already running server is reused.
 */
const PORT = 3000;
const baseURL = `http://localhost:${PORT}`;
const isDocs = !!process.env.DOCS;

export default defineConfig({
  testDir: "./tests",
  outputDir: "./test-results",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: isDocs ? 1 : 2,
  timeout: isDocs ? 240_000 : 60_000,
  expect: { timeout: 10_000 },
  reporter: isDocs ? [["list"]] : [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL,
    timezoneId: "Asia/Colombo",
    locale: "en-US",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
    actionTimeout: 15_000,
  },
  projects: [
    {
      name: "e2e",
      testDir: "./tests/e2e",
      testIgnore: /responsive\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile",
      testDir: "./tests/e2e",
      testMatch: /responsive\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, hasTouch: true, deviceScaleFactor: 2 },
    },
    {
      name: "docs",
      testDir: "./tests/documentation",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, video: "off", screenshot: "off", trace: "off" },
    },
  ],
  webServer: {
    command: process.env.PW_DEV ? "npm run dev" : "npm run build && npm run start",
    url: `${baseURL}/login`,
    reuseExistingServer: true,
    timeout: 300_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
