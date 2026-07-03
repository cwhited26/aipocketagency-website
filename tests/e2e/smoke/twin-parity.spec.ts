import { test, expect } from "@playwright/test";

// Twin-parity homepage surface smoke (PA-POS-28/29): the Agent Builder hero, the honest
// counter, and motion shots F/G/H. Runs against the deployed target like the rest of the
// suite — see playwright.config.ts for how BASE_URL resolves.

test("smoke: the Agent Builder hero renders and Compose routes to /start", async ({ page }) => {
  const res = await page.goto("/", { waitUntil: "domcontentloaded" });
  expect(res!.status()).toBe(200);
  const input = page.locator("[data-agent-builder-input]");
  await expect(input).toBeVisible();
  await input.fill("An agent that drafts follow-ups for stale contacts");
  // Assert the router request rather than the final URL: it proves Compose carries the
  // spec into /start on any target, including a local prod build where /start itself
  // can't render without the Supabase envs.
  let navigated = false;
  const navRequest = page
    .waitForRequest((r) => r.url().includes("/start?intent=agent-builder&spec="), {
      timeout: 15_000,
    })
    .then(() => {
      navigated = true;
    })
    .catch(() => {});
  // The click can race hydration on a fresh load — keep clicking until the router fires.
  for (let i = 0; i < 20 && !navigated; i += 1) {
    await page
      .locator("[data-agent-builder-compose]")
      .click({ timeout: 1_000 })
      .catch(() => {});
    await page.waitForTimeout(500);
  }
  await Promise.race([navRequest, page.waitForTimeout(100)]);
  expect(navigated).toBe(true);
});

test("smoke: the honest counter names the three businesses", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByText("Pocket Agent runs inside three businesses of our own."),
  ).toBeVisible();
  for (const business of ["Tennessee Valley Exteriors", "Whited Consulting", "AthleteOS"]) {
    await expect(page.getByText(business).first()).toBeVisible();
  }
});

test("smoke: shots F/G/H idle below the fold, play in view, pause back out", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000); // hydration
  // Below the fold on initial load: no shot burns frames yet.
  for (const shot of ["running-agent", "integrations", "browser-agent"]) {
    await expect(page.locator(`[data-shot="${shot}"]`)).toHaveAttribute("data-motion", "idle");
  }
  // Scrolled into view: the IntersectionObserver starts the loop.
  await page.locator('[data-shot="running-agent"]').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-shot="running-agent"]')).toHaveAttribute(
    "data-motion",
    "playing",
    { timeout: 500 },
  );
  // Scrolled back out: the loop freezes where it stood.
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.locator('[data-shot="running-agent"]')).toHaveAttribute(
    "data-motion",
    "paused",
    { timeout: 500 },
  );
});

test("smoke: the footer Pause animations toggle freezes every shot", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator('[data-shot="running-agent"]').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-shot="running-agent"]')).toHaveAttribute(
    "data-motion",
    "playing",
  );
  await page.locator("[data-motion-toggle]").click();
  for (const shot of ["running-agent", "integrations", "browser-agent"]) {
    await expect(page.locator(`[data-shot="${shot}"]`)).toHaveAttribute("data-motion", "paused");
  }
  await expect(page.locator("[data-motion-toggle]")).toHaveText("Play animations");
});

test("smoke: shots F/G/H pin the poster frame under reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  expect(await page.locator('[data-motion="reduced"]').count()).toBe(3);
  expect(await page.locator('[data-motion="playing"]').count()).toBe(0);
});

test("smoke: the integrations constellation filters by category chip", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const chip = page.locator('[data-shot="integrations"] button', { hasText: "Support" });
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "true");
});
