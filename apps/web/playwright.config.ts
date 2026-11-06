import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: { baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100", trace: "retain-on-failure" },
  webServer: { command: process.env.CI ? "rm -rf .next/standalone/apps/web/.next/static .next/standalone/apps/web/public && cp -a .next/static .next/standalone/apps/web/.next/static && cp -a public .next/standalone/apps/web/public && HOSTNAME=127.0.0.1 PORT=3100 node .next/standalone/apps/web/server.js" : "npm run dev -- --port 3100", cwd: ".", url: "http://127.0.0.1:3100", reuseExistingServer: !process.env.CI, timeout: 120000 },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 5"] } },
  ],
});
