import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: { timeout: 12_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // Local default (undefined) resolves to ~half of CPU cores, which on a dev
  // machine also running other heavy processes means too many concurrent
  // chromium/firefox/webkit instances competing for RAM — observed causing
  // swap exhaustion and cascading test timeouts under load. Capped down from
  // that default (5 on a 10-core box) to leave real headroom for local runs.
  workers: process.env.CI ? 2 : 3,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://127.0.0.1:4174",
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } }
  ],
  webServer: {
    command: "node scripts/serve-site.mjs",
    url: "http://127.0.0.1:4174/studio-v2/",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000
  }
});
