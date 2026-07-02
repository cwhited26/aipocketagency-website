// smoke.spec.ts — launch-critical route smoke suite (PA-STABILITY-2). One test per route. Each asserts
// the route returns 200, renders a non-empty <h1>/hero, exposes a working primary CTA (a link with an
// href or a button), logs no console errors, and issues no 5xx in the network log. Content assertions
// stay copy-agnostic on purpose (Wave 1 is actively editing hero copy) — we prove the page rendered its
// hero, not a specific sentence.
//
// Runs against a deployed target via NEXT_PUBLIC_APP_URL (see playwright.config.ts), so it exercises the
// real marketing + post-checkout flow. Login-gated /app/* pages are covered leniently: without a session
// they redirect to /app/login, which is a healthy outcome — we assert they reach a rendered page with no
// crash rather than a specific product screen (auth-less Playwright would false-positive otherwise).

import { test, expect, type Page, type ConsoleMessage, type Response } from "@playwright/test";

type RouteCase = {
  /** Human label — becomes the test title. */
  name: string;
  /** Path (relative to baseURL), including any query string. */
  path: string;
  /** Login-gated: a redirect to /app/login is an acceptable, healthy outcome. */
  authGated?: boolean;
};

const MARKETING_ROUTES: RouteCase[] = [
  { name: "homepage", path: "/" },
  { name: "pricing", path: "/pricing" },
  { name: "start (starter tier)", path: "/start?tier=starter" },
  { name: "start (pro tier)", path: "/start?tier=pro" },
  { name: "start (studio_plus tier)", path: "/start?tier=studio_plus" },
  { name: "downsell", path: "/downsell" },
  { name: "upsell", path: "/upsell" },
  { name: "launch-kit", path: "/launch-kit" },
  { name: "thanks (subscription only)", path: "/thanks?bought=subscription_only" },
  { name: "thanks (subscription plus setup)", path: "/thanks?bought=subscription_plus_setup" },
  { name: "thanks (pilot)", path: "/thanks?bought=pilot" },
];

const PRODUCT_ROUTES: RouteCase[] = [
  { name: "inbox app", path: "/app/apps/inbox", authGated: true },
  { name: "idea-engine app", path: "/app/apps/idea-engine", authGated: true },
  { name: "in-product pricing", path: "/app/pricing", authGated: true },
];

// Console noise we never want to fail on: browser-side quirks that aren't app bugs (favicon 404s,
// third-party pixel/analytics failures). Kept tight so real app errors still fail the suite.
const IGNORED_CONSOLE = [/favicon/i, /net::ERR_/i, /Failed to load resource/i];

function isIgnorableConsole(text: string): boolean {
  return IGNORED_CONSOLE.some((re) => re.test(text));
}

type SmokeObservations = {
  consoleErrors: string[];
  serverErrors: string[]; // "<status> <url>" for any 5xx response
};

/** Wire up console + network listeners before navigation so nothing is missed. */
function observe(page: Page): SmokeObservations {
  const obs: SmokeObservations = { consoleErrors: [], serverErrors: [] };
  page.on("console", (msg: ConsoleMessage) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (!isIgnorableConsole(text)) obs.consoleErrors.push(text);
  });
  page.on("response", (res: Response) => {
    if (res.status() >= 500) obs.serverErrors.push(`${res.status()} ${res.url()}`);
  });
  return obs;
}

/** A working primary CTA: a link with a non-empty href, or an enabled button. */
async function hasPrimaryCta(page: Page): Promise<boolean> {
  const links = page.locator("a[href]:not([href=''])");
  const buttons = page.locator("button:not([disabled])");
  const [linkCount, buttonCount] = await Promise.all([links.count(), buttons.count()]);
  return linkCount > 0 || buttonCount > 0;
}

for (const route of MARKETING_ROUTES) {
  test(`smoke: ${route.name} (${route.path})`, async ({ page }) => {
    const obs = observe(page);

    const res = await page.goto(route.path, { waitUntil: "domcontentloaded" });
    expect(res, `no response for ${route.path}`).not.toBeNull();
    expect(res!.status(), `expected 200 for ${route.path}`).toBe(200);

    // Renders a non-empty hero heading (proves the hero rendered, not an error boundary).
    const h1 = page.locator("h1").first();
    await expect(h1, `expected an <h1> on ${route.path}`).toBeVisible();
    expect((await h1.innerText()).trim().length, `empty <h1> on ${route.path}`).toBeGreaterThan(0);

    expect(await hasPrimaryCta(page), `no primary CTA on ${route.path}`).toBe(true);

    expect(obs.serverErrors, `5xx responses on ${route.path}`).toEqual([]);
    expect(obs.consoleErrors, `console errors on ${route.path}`).toEqual([]);
  });
}

for (const route of PRODUCT_ROUTES) {
  test(`smoke: ${route.name} (${route.path})`, async ({ page }) => {
    const obs = observe(page);

    const res = await page.goto(route.path, { waitUntil: "domcontentloaded" });
    expect(res, `no response for ${route.path}`).not.toBeNull();
    // Either the product page (200) or a healthy redirect to the login page (also 200) — both are fine.
    expect(res!.status(), `expected a 2xx for ${route.path}`).toBeLessThan(400);

    // Whatever rendered — product screen or login — must have a heading and a way forward, with no crash.
    const h1 = page.locator("h1").first();
    await expect(h1, `expected an <h1> on ${route.path}`).toBeVisible();
    expect(await hasPrimaryCta(page), `no primary CTA on ${route.path}`).toBe(true);

    expect(obs.serverErrors, `5xx responses on ${route.path}`).toEqual([]);
    expect(obs.consoleErrors, `console errors on ${route.path}`).toEqual([]);
  });
}
