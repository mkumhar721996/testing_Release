import { defineConfig, devices } from "@playwright/test";

// Targets the already-deployed QA site, so there is no webServer block.
export default defineConfig({
  testDir: "./e2e-qa",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: process.env.QA_BASE_URL ?? "https://qa.bnts-arc.ai",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
