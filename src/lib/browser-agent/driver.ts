// driver.ts — drives the Browserbase session over CDP with playwright-core (already the repo's
// browser engine — Competitor Inspector + Browser Automation Phase 1 both ship it). One connect
// per cron tick, actions map 1:1 from Computer Use's coordinate model, and hitTest() resolves
// what's under a coordinate so the approval gate classifies semantics, not pixels.

import { chromium, type Browser, type Page } from "playwright-core";
import { BROWSER_VIEWPORT } from "./constants";
import type { ElementInfo, PlannedAction } from "./types";

export type SessionHandle = {
  page: Page;
  close: () => Promise<void>;
};

/** Connects to a live Browserbase session; caller must close() (CDP disconnect, not release). */
export async function connectToSession(connectUrl: string): Promise<SessionHandle> {
  const browser: Browser = await chromium.connectOverCDP(connectUrl, { timeout: 20_000 });
  const context = browser.contexts()[0] ?? (await browser.newContext());
  const page = context.pages()[0] ?? (await context.newPage());
  await page.setViewportSize({ width: BROWSER_VIEWPORT.width, height: BROWSER_VIEWPORT.height });
  return {
    page,
    close: async () => {
      await browser.close().catch((e: unknown) => {
        console.warn("[browser-agent/driver] CDP disconnect failed", {
          error: e instanceof Error ? e.message : String(e),
        });
      });
    },
  };
}

// Computer Use emits xdotool-style key names; Playwright wants its own. Map the common set and
// pass anything else through (Playwright accepts most single keys verbatim).
const KEY_MAP: Readonly<Record<string, string>> = {
  return: "Enter",
  enter: "Enter",
  kp_enter: "Enter",
  tab: "Tab",
  escape: "Escape",
  esc: "Escape",
  backspace: "Backspace",
  delete: "Delete",
  space: " ",
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
  page_up: "PageUp",
  page_down: "PageDown",
  home: "Home",
  end: "End",
  ctrl: "Control",
  cmd: "Meta",
  super: "Meta",
  alt: "Alt",
  shift: "Shift",
};

export function toPlaywrightKey(raw: string): string {
  return raw
    .split("+")
    .map((part) => {
      const k = part.trim().toLowerCase();
      return KEY_MAP[k] ?? (part.length === 1 ? part : part.charAt(0).toUpperCase() + part.slice(1));
    })
    .join("+");
}

/** Executes one planned action. Throws on driver failure; the worker converts to an error tool_result. */
export async function executeAction(page: Page, action: PlannedAction): Promise<void> {
  switch (action.kind) {
    case "screenshot":
      return; // capture happens in takeScreenshot(); nothing to do here
    case "navigate":
      await page.goto(action.url, { waitUntil: "domcontentloaded", timeout: 25_000 });
      return;
    case "click":
      await page.mouse.click(action.x, action.y, {
        button: action.button,
        clickCount: action.clickCount,
      });
      // Give the page a beat to react (menus, SPA route changes) before the next screenshot.
      await page.waitForTimeout(600);
      return;
    case "type":
      await page.keyboard.type(action.text, { delay: 15 });
      return;
    case "key":
      await page.keyboard.press(toPlaywrightKey(action.text));
      await page.waitForTimeout(400);
      return;
    case "scroll": {
      await page.mouse.move(action.x, action.y);
      const px = Math.max(1, Math.min(action.amount, 15)) * 120;
      const dx = action.direction === "left" ? -px : action.direction === "right" ? px : 0;
      const dy = action.direction === "up" ? -px : action.direction === "down" ? px : 0;
      await page.mouse.wheel(dx, dy);
      await page.waitForTimeout(300);
      return;
    }
    case "wait":
      await page.waitForTimeout(Math.min(Math.max(action.seconds, 0), 5) * 1_000);
      return;
  }
}

export async function takeScreenshot(page: Page): Promise<string> {
  const buf = await page.screenshot({ type: "png", timeout: 15_000 });
  return buf.toString("base64");
}

export function currentUrl(page: Page): string {
  return page.url();
}

/**
 * What sits under (x, y): walks from elementFromPoint to the closest interactive ancestor so a
 * click on a button's inner <span> still classifies as the button. Returns null when nothing
 * resolvable is there — the approval gate then fails toward the card for clicks.
 */
export async function hitTest(page: Page, x: number, y: number): Promise<ElementInfo | null> {
  const info = await page.evaluate(
    ({ px, py }) => {
      const start = document.elementFromPoint(px, py);
      if (!start) return null;
      const interactive = start.closest(
        'a,button,input,select,textarea,[role="button"],[role="link"],[role="menuitem"],[type="submit"]',
      );
      const el = (interactive ?? start) as HTMLElement;
      const tag = el.tagName.toLowerCase();
      const inputType =
        tag === "input"
          ? ((el as HTMLInputElement).type || "text").toLowerCase()
          : tag === "button"
            ? ((el as HTMLButtonElement).type || "submit").toLowerCase()
            : null;
      return {
        tag,
        inputType,
        role: el.getAttribute("role"),
        text: (el.innerText || (el as HTMLInputElement).value || "").slice(0, 300),
        ariaLabel: el.getAttribute("aria-label"),
        href: tag === "a" ? (el as HTMLAnchorElement).href : null,
        inForm: el.closest("form") !== null,
        isPasswordField: tag === "input" && (el as HTMLInputElement).type === "password",
        autocomplete: el.getAttribute("autocomplete"),
      };
    },
    { px: x, py: y },
  );
  return info;
}

/** The element with keyboard focus — what a `type` action will land in. */
export async function focusedElement(page: Page): Promise<ElementInfo | null> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return null;
    const tag = el.tagName.toLowerCase();
    const inputType = tag === "input" ? ((el as HTMLInputElement).type || "text").toLowerCase() : null;
    return {
      tag,
      inputType,
      role: el.getAttribute("role"),
      text: (el.innerText || (el as HTMLInputElement).value || "").slice(0, 300),
      ariaLabel: el.getAttribute("aria-label"),
      href: null,
      inForm: el.closest("form") !== null,
      isPasswordField: tag === "input" && (el as HTMLInputElement).type === "password",
      autocomplete: el.getAttribute("autocomplete"),
    };
  });
}
