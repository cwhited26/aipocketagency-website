import { test, expect } from "@playwright/test";

// Agents Library + use-case surface smoke (PA-POS-24/25/26). Runs against the deployed
// target like the rest of the suite — see playwright.config.ts for how BASE_URL resolves.

test("smoke: /agents renders the library with at least 20 cards", async ({ page }) => {
  const res = await page.goto("/agents", { waitUntil: "domcontentloaded" });
  expect(res!.status()).toBe(200);
  await expect(page.locator("h1").first()).toBeVisible();
  expect(await page.locator("[data-agent-card]").count()).toBeGreaterThanOrEqual(20);
});

test("smoke: /agents carries the compose surface at #compose (PA-POS-34)", async ({ page }) => {
  const res = await page.goto("/agents#compose", { waitUntil: "domcontentloaded" });
  expect(res!.status()).toBe(200);
  await expect(page.locator("#compose")).toBeAttached();
  await expect(page.locator("[data-agents-compose-input]")).toBeVisible();
  await expect(page.locator("[data-agents-compose-button]")).toBeVisible();
});

test("smoke: the App tile route forwards to /app/agents#compose (PA-POS-37)", async ({
  page,
}) => {
  // /app/agents is behind the app auth gate, so a signed-out browser can't follow the chain to
  // the page itself — assert the redirect target at the response layer instead.
  const res = await page.request.get("/app/apps/agent-builder?spec=watch%20my%20inbox", {
    maxRedirects: 0,
  });
  expect(res.status()).toBe(307);
  expect(res.headers()["location"]).toMatch(/\/app\/agents\?spec=.*#compose$/);
});

test("smoke: /app/agents exists and gates on auth (PA-POS-37)", async ({ page }) => {
  // Signed out, the route answers with the login redirect — not a 404. That's the whole
  // assertion available without a session; the compose + clone flow is covered by vitest.
  const res = await page.request.get("/app/agents", { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  expect(res.headers()["location"]).toContain("/app/login");
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

test("smoke: motion shots play within 500ms of scrolling into view", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/use-cases/lead-generation", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000); // hydration
  for (const shot of ["running-agent", "persona-chat", "idea-engine", "approval-inbox"]) {
    await page.locator(`[data-shot="${shot}"]`).scrollIntoViewIfNeeded();
    await expect(page.locator(`[data-shot="${shot}"]`)).toHaveAttribute(
      "data-motion",
      "playing",
      { timeout: 500 },
    );
  }

  await page.goto("/use-cases/operations", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000); // hydration
  for (const shot of ["follow-up-sweeps", "ritual-scheduler", "browser-agent"]) {
    await page.locator(`[data-shot="${shot}"]`).scrollIntoViewIfNeeded();
    await expect(page.locator(`[data-shot="${shot}"]`)).toHaveAttribute(
      "data-motion",
      "playing",
      { timeout: 500 },
    );
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
