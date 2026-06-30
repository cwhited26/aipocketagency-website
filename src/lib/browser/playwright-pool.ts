// playwright-pool.ts — the singleton concurrency pool that fronts every browser_* tool call
// (prompt item 2). It enforces two hard isolation guarantees:
//
//   • MAX 3 concurrent tasks — a 4th waits in a FIFO queue until a slot frees. A hosted runtime
//     can't afford an unbounded fan of headless Chromiums; three is the SPEC-aligned ceiling.
//   • 60s per-task timeout — every task races a deadline; when it passes the task rejects and its
//     browser is force-closed in `finally`. A wedged renderer can never outlive its slot.
//
// Browser launch reuses the proven pattern from lib/url-extraction/browser.ts: playwright-core (no
// bundled binary) + @sparticuz/chromium's brotli-packed Linux build on Vercel; a local Chrome in
// dev (PA_CHROMIUM_EXECUTABLE, falling back to the macOS install path). Each task gets a FRESH,
// isolated browser + context — no state, no cookies, no auth crosses between tasks (Basic mode).
//
// We launch one browser PER TASK rather than pooling long-lived browsers: a per-task browser is the
// strongest isolation boundary (the whole point of Basic mode) and the launch cost is dwarfed by the
// network wait of a real navigation. The "pool" bounds CONCURRENCY, not browser reuse.

import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import { browserLog } from "./log";

export const MAX_CONCURRENT_TASKS = 3;
export const TASK_TIMEOUT_MS = 60_000;

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

export type PoolResult<T> = { ok: true; value: T } | { ok: false; error: string };

// ── FIFO concurrency gate ─────────────────────────────────────────────────────────────────────────
// A tiny semaphore: `active` tracks in-flight tasks; `waiters` are resolvers parked until a slot frees.
let active = 0;
const waiters: Array<() => void> = [];

function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT_TASKS) {
    active += 1;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    waiters.push(() => {
      active += 1;
      resolve();
    });
  });
}

function release(): void {
  active -= 1;
  const next = waiters.shift();
  if (next) next();
}

/**
 * Run `fn` against a fresh, isolated headless page inside one pool slot, with the per-task deadline.
 * Never throws — failures (launch error, timeout, or a throw inside `fn`) come back typed as
 * { ok: false }. The browser is always force-closed; the slot is always released.
 *
 * @param label  short identifier for logs (e.g. the tool name) — never user data.
 */
export async function runInPool<T>(
  label: string,
  fn: (page: Page) => Promise<T>,
  opts: { timeoutMs?: number } = {},
): Promise<PoolResult<T>> {
  const timeoutMs = opts.timeoutMs ?? TASK_TIMEOUT_MS;
  await acquire();

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
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
    context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(20_000);

    const value = await Promise.race([
      fn(page),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`browser task "${label}" exceeded its ${Math.round(timeoutMs / 1000)}s budget`)),
          timeoutMs,
        );
      }),
    ]);
    return { ok: true, value };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    if (timer) clearTimeout(timer);
    if (browser) {
      // Force-close is the isolation guarantee — a wedged renderer can't outlive its slot.
      await browser.close().catch((e: unknown) => {
        browserLog.warn("browser close failed", {
          label,
          error: e instanceof Error ? e.message : String(e),
        });
      });
    }
    release();
  }
}
