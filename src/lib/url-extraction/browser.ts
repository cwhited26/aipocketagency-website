// browser.ts — the one place the extraction worker touches a real browser. playwright-core
// (no bundled binary) + @sparticuz/chromium's brotli-packed Linux build on Vercel; a local
// Chrome/Chromium executable in dev (PA_CHROMIUM_EXECUTABLE, falling back to the standard
// macOS install path). Worker isolation is enforced here: every launch carries a hard deadline,
// and the browser is force-closed in finally — a hung page can time a run out, never wedge the
// PA runtime.

import { chromium, type Browser, type Page } from "playwright-core";

const MAC_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

type SparticuzChromium = {
  executablePath: () => Promise<string>;
  args: string[];
};

async function resolveLaunch(): Promise<{ executablePath: string; args: string[] }> {
  const explicit = process.env.PA_CHROMIUM_EXECUTABLE;
  if (explicit) return { executablePath: explicit, args: [] };

  if (process.platform === "linux") {
    // Vercel / Lambda: the sparticuz build. Imported lazily so local dev + vitest never load it.
    const mod = (await import("@sparticuz/chromium")) as unknown as { default: SparticuzChromium };
    const executablePath = await mod.default.executablePath();
    return { executablePath, args: mod.default.args };
  }

  return { executablePath: MAC_CHROME, args: [] };
}

export type WithPageResult<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * Launch a hardened headless browser, hand the caller one page, and guarantee teardown. The
 * deadline applies to the WHOLE callback — when it passes, the run fails with a timeout error
 * and the browser still closes. Never throws; failures come back typed.
 */
export async function withPage<T>(
  params: { deadlineMs: number },
  fn: (page: Page) => Promise<T>,
): Promise<WithPageResult<T>> {
  let browser: Browser | null = null;
  try {
    const launch = await resolveLaunch();
    browser = await chromium.launch({
      executablePath: launch.executablePath,
      headless: true,
      args: [
        ...launch.args,
        "--disable-dev-shm-usage",
        "--no-first-run",
        "--disable-extensions",
        "--mute-audio",
      ],
    });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(20_000);

    const value = await Promise.race([
      fn(page),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`extraction run exceeded its ${Math.round(params.deadlineMs / 1000)}s budget`)),
          params.deadlineMs,
        ),
      ),
    ]);
    return { ok: true, value };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    if (browser) {
      // Force-close is the isolation guarantee — a wedged renderer can't outlive the run.
      await browser.close().catch((e: unknown) => {
        console.warn("[url-extraction/browser] browser close failed", {
          error: e instanceof Error ? e.message : String(e),
        });
      });
    }
  }
}
