import { test, expect } from "@playwright/test";

// Agents Library + use-case surface smoke (PA-POS-24/25/26). Runs against the deployed
// target like the rest of the suite — see playwright.config.ts for how BASE_URL resolves.

test("smoke: /agents renders the library with at least 20 cards", async ({ page }) => {
  const res = await page.goto("/agents", { waitUntil: "domcontentloaded" });
  expect(res!.status()).toBe(200);
  await expect(page.locator("h1").first()).toBeVisible();
  expect(await page.locator("[data-agent-card]").count()).toBeGreaterThanOrEqual(20);
});

test("smoke: /use-cases/lead-generation renders the rail, the steps, and shots A/B/E", async ({
  page,
}) => {
  const res = await page.goto("/use-cases/lead-generation", { waitUntil: "domcontentloaded" });
  expect(res!.status()).toBe(200);
  await expect(page.locator("h1").first()).toBeVisible();
  expect(await page.locator("[data-agent-card]").count()).toBe(6);
  expect(await page.locator("[data-how-step]").count()).toBe(4);
  for (const shot of ["running-agent", "persona-chat", "idea-engine", "approval-inbox"]) {
    await expect(page.locator(`[data-shot="${shot}"]`)).toBeAttached();
  }
});

test("smoke: motion shots report a running loop within 500ms", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/use-cases/lead-generation", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  expect(await page.locator('[data-motion="playing"]').count()).toBe(4);

  await page.goto("/use-cases/operations", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  for (const shot of ["follow-up-sweeps", "ritual-scheduler", "browser-agent"]) {
    await expect(page.locator(`[data-shot="${shot}"][data-motion="playing"]`)).toBeAttached();
  }
});

test("smoke: motion shots pin the poster frame under reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/use-cases/lead-generation", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  expect(await page.locator('[data-motion="reduced"]').count()).toBe(4);
  expect(await page.locator('[data-motion="playing"]').count()).toBe(0);
});

test("smoke: the remaining use-case doorways respond with an agents rail", async ({ page }) => {
  for (const slug of ["sales-outreach", "content-creation", "research", "operations", "idea-to-mvp"]) {
    const res = await page.goto(`/use-cases/${slug}`, { waitUntil: "domcontentloaded" });
    expect(res!.status(), slug).toBe(200);
    await expect(page.locator("h1").first()).toBeVisible();
    expect(await page.locator("[data-agent-card]").count(), slug).toBeGreaterThanOrEqual(3);
  }
});
