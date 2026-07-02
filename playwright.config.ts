import { defineConfig, devices } from "@playwright/test";

// Launch-critical smoke suite (PA-STABILITY-2). Runs against a deployed target, not a local build —
// NEXT_PUBLIC_APP_URL selects it (default: prod). For a local run: NEXT_PUBLIC_APP_URL=http://localhost:3000 pnpm smoke
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://app.aipocketagent.com";

export default defineConfig({
  testDir: "./tests/e2e/smoke",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    ignoreHTTPSErrors: false,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
