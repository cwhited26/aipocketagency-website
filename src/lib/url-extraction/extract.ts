// extract.ts — the extraction pass itself: drive one live page through the recon method,
// unattended. Three-viewport responsive sweep (1440/768/390), the page audit, asset discovery
// (identification only), and the interaction sweep adapted for headless runs — scripted scroll /
// hover / click with a hard 90-second budget, every state-diff attempt and failure logged
// (no silent gaps; SPEC principle 7 makes the coverage block carry what was missed).

import type { Page } from "playwright-core";
import {
  ASSET_DISCOVERY_SCRIPT,
  PAGE_AUDIT_SCRIPT,
  RESPONSIVE_SCAN_SCRIPT,
  elementStylesScript,
} from "./page-scripts";
import {
  buildLayout,
  buildPalette,
  buildRadius,
  buildShadows,
  buildSpacing,
  buildTypography,
  inferInteractionModel,
  type PageAudit,
  type ResponsiveScan,
} from "./infer";
import type {
  Behavior,
  BehaviorMechanism,
  DesignDna,
  ExtractionLogEntry,
  ExtractionResult,
  ScreenshotCapture,
  SourceMeta,
} from "./types";
import { EXTRACTOR_VERSION, INTERACTION_SWEEP_BUDGET_MS, SWEEP_VIEWPORTS } from "./types";

type StyleSnapshot = Record<string, string>;

const SCREENSHOT_MAX_BASE64 = 1_500_000; // ~1.1MB binary per shot — row-storage cap

function logEntry(
  log: ExtractionLogEntry[],
  step: string,
  outcome: ExtractionLogEntry["outcome"],
  detail: string,
): void {
  log.push({ at: new Date().toISOString(), step, outcome, detail });
}

async function snapshotStyles(page: Page, selector: string): Promise<StyleSnapshot | null> {
  const result = (await page.evaluate(elementStylesScript(selector))) as
    | { styles: StyleSnapshot }
    | { error: string };
  if ("error" in result) return null;
  return result.styles;
}

/** The state-diff method: the property-level diff between two snapshots IS the behavior spec. */
export function diffSnapshots(a: StyleSnapshot, b: StyleSnapshot): Array<{ prop: string; from: string; to: string }> {
  const diffs: Array<{ prop: string; from: string; to: string }> = [];
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    const from = a[key] ?? "(unset)";
    const to = b[key] ?? "(unset)";
    if (from !== to && key !== "transition") diffs.push({ prop: key, from, to });
  }
  return diffs;
}

function describeDiff(diffs: Array<{ prop: string; from: string; to: string }>): { from: string; to: string } {
  const top = diffs.slice(0, 4);
  return {
    from: top.map((d) => `${d.prop}: ${d.from}`).join("; "),
    to: top.map((d) => `${d.prop}: ${d.to}`).join("; "),
  };
}

async function dismissCookieBanner(page: Page, log: ExtractionLogEntry[]): Promise<void> {
  // Best-effort: common consent buttons by accessible name. A miss is logged, never fatal.
  const labels = ["Accept all", "Accept All", "Accept", "I agree", "Allow all", "Got it", "OK"];
  for (const label of labels) {
    try {
      const button = page.getByRole("button", { name: label, exact: false }).first();
      if (await button.isVisible({ timeout: 700 })) {
        await button.click({ timeout: 2_000 });
        logEntry(log, "cookie-banner", "ok", `dismissed via "${label}" button`);
        await page.waitForTimeout(500);
        return;
      }
    } catch {
      // not present under this label — keep trying; the loop's else-branch logs the outcome
    }
  }
  logEntry(log, "cookie-banner", "skipped", "no consent banner matched the common labels");
}

// ── The interaction sweep (unattended adaptation of the cloner's mandatory sweep) ───────────

async function scrollSweep(params: {
  page: Page;
  audit: PageAudit;
  behaviors: Behavior[];
  log: ExtractionLogEntry[];
  deadline: number;
}): Promise<void> {
  const { page, audit, behaviors, log, deadline } = params;

  // Nav-on-scroll: snapshot the nav at scrollY=0, scroll past the hero, re-snapshot, diff.
  if (audit.navSelector) {
    if (Date.now() > deadline) {
      logEntry(log, "scroll-sweep:nav", "skipped", "interaction budget exhausted");
    } else {
      const before = await snapshotStyles(page, audit.navSelector);
      await page.evaluate("window.scrollTo({ top: 480, behavior: 'instant' })");
      await page.waitForTimeout(600);
      const after = audit.navSelector ? await snapshotStyles(page, audit.navSelector) : null;
      if (before && after) {
        const diffs = diffSnapshots(before, after);
        if (diffs.length > 0) {
          const { from, to } = describeDiff(diffs);
          behaviors.push({
            name: "nav-change-on-scroll",
            trigger_type: "scroll",
            trigger: "scrollY > ~480px (observed at one threshold; exact trip point not bisected)",
            from,
            to,
            transition: after.transition ?? before.transition ?? "not captured",
            mechanism: audit.navPosition === "sticky" || audit.navPosition === "fixed" ? "scroll-listener" : "position-sticky",
          });
          logEntry(log, "scroll-sweep:nav", "ok", `${diffs.length} properties changed`);
        } else {
          logEntry(log, "scroll-sweep:nav", "ok", "no style change on scroll — nav is static");
        }
      } else {
        logEntry(log, "scroll-sweep:nav", "failed", "nav element not re-resolvable after scroll");
      }
    }
  } else {
    logEntry(log, "scroll-sweep:nav", "skipped", "no header/nav element found");
  }

  // Entrance animations: elements hidden below the fold at load; scroll them in and diff.
  let entranceHits = 0;
  for (const candidate of audit.hiddenCandidates.slice(0, 5)) {
    if (Date.now() > deadline) {
      logEntry(log, `scroll-sweep:entrance ${candidate.selector}`, "skipped", "interaction budget exhausted");
      continue;
    }
    try {
      const before = await snapshotStyles(page, candidate.selector);
      await page.evaluate(
        `(function(s){ const el = document.querySelector(s); if (el) el.scrollIntoView({ block: "center", behavior: "instant" }); })(${JSON.stringify(candidate.selector)})`,
      );
      await page.waitForTimeout(900);
      const after = await snapshotStyles(page, candidate.selector);
      if (before && after) {
        const diffs = diffSnapshots(before, after).filter((d) => d.prop === "opacity" || d.prop === "transform");
        if (diffs.length > 0) {
          entranceHits++;
          if (entranceHits === 1) {
            const { from, to } = describeDiff(diffs);
            behaviors.push({
              name: "content-fade-in-on-enter",
              trigger_type: "scroll",
              trigger: "element enters viewport (IntersectionObserver-style reveal)",
              from,
              to,
              transition: after.transition ?? "not captured",
              mechanism: "intersection-observer",
            });
          }
          logEntry(log, `scroll-sweep:entrance ${candidate.selector}`, "ok", `revealed (${diffs.map((d) => d.prop).join(", ")})`);
        } else {
          logEntry(log, `scroll-sweep:entrance ${candidate.selector}`, "ok", "no reveal observed");
        }
      } else {
        logEntry(log, `scroll-sweep:entrance ${candidate.selector}`, "failed", "element not resolvable");
      }
    } catch (e) {
      logEntry(log, `scroll-sweep:entrance ${candidate.selector}`, "failed", e instanceof Error ? e.message : String(e));
    }
  }
  if (entranceHits > 1) {
    logEntry(log, "scroll-sweep:entrance", "ok", `${entranceHits} elements share the reveal pattern — recorded once`);
  }

  await page.evaluate("window.scrollTo({ top: 0, behavior: 'instant' })");
  await page.waitForTimeout(400);
}

async function hoverSweep(params: {
  page: Page;
  audit: PageAudit;
  behaviors: Behavior[];
  log: ExtractionLogEntry[];
  deadline: number;
}): Promise<void> {
  const { page, audit, behaviors, log, deadline } = params;
  let recorded = false;
  for (const selector of audit.hoverTargets) {
    if (Date.now() > deadline) {
      logEntry(log, `hover-sweep ${selector}`, "skipped", "interaction budget exhausted");
      continue;
    }
    try {
      const before = await snapshotStyles(page, selector);
      await page.hover(selector, { timeout: 3_000 });
      await page.waitForTimeout(350);
      const after = await snapshotStyles(page, selector);
      await page.mouse.move(4, 4);
      if (before && after) {
        const diffs = diffSnapshots(before, after);
        if (diffs.length > 0 && !recorded) {
          recorded = true;
          const { from, to } = describeDiff(diffs);
          behaviors.push({
            name: "button-hover-state",
            trigger_type: "hover",
            trigger: "pointer over primary buttons",
            from,
            to,
            transition: after.transition ?? before.transition ?? "not captured",
            mechanism: "css-transition",
          });
        }
        logEntry(log, `hover-sweep ${selector}`, "ok", diffs.length > 0 ? `${diffs.length} properties changed` : "no hover change");
      } else {
        logEntry(log, `hover-sweep ${selector}`, "failed", "element not resolvable");
      }
    } catch (e) {
      logEntry(log, `hover-sweep ${selector}`, "failed", e instanceof Error ? e.message : String(e));
    }
  }
  if (audit.hoverTargets.length === 0) {
    logEntry(log, "hover-sweep", "skipped", "no hover targets identified");
  }
}

async function clickSweep(params: {
  page: Page;
  audit: PageAudit;
  behaviors: Behavior[];
  log: ExtractionLogEntry[];
  deadline: number;
}): Promise<void> {
  const { page, audit, behaviors, log, deadline } = params;
  // Unattended safety: only ARIA tab controls get clicked — they switch state without navigating.
  // Arbitrary buttons/links stay untouched (a headless click on "Sign up" navigates the run away).
  const tabs = audit.tabSelectors.slice(0, 3);
  if (tabs.length < 2) {
    logEntry(log, "click-sweep", "skipped", tabs.length === 0 ? "no ARIA tab controls found" : "only one tab — nothing to switch");
    return;
  }
  if (Date.now() > deadline) {
    logEntry(log, "click-sweep", "skipped", "interaction budget exhausted");
    return;
  }
  try {
    const target = tabs[1];
    const before = await snapshotStyles(page, target);
    await page.click(target, { timeout: 3_000 });
    await page.waitForTimeout(450);
    const after = await snapshotStyles(page, target);
    if (before && after) {
      const diffs = diffSnapshots(before, after);
      if (diffs.length > 0) {
        const { from, to } = describeDiff(diffs);
        behaviors.push({
          name: "tab-panel-switch",
          trigger_type: "click",
          trigger: "tab buttons (role=tab)",
          from,
          to,
          transition: after.transition ?? "not captured",
          mechanism: "js-state",
        });
      }
      logEntry(log, "click-sweep:tab", "ok", diffs.length > 0 ? `${diffs.length} properties changed` : "tab click produced no style change on the tab itself");
    } else {
      logEntry(log, "click-sweep:tab", "failed", "tab not resolvable after click");
    }
  } catch (e) {
    logEntry(log, "click-sweep:tab", "failed", e instanceof Error ? e.message : String(e));
  }
}

// ── The full pass ───────────────────────────────────────────────────────────────────────────

/**
 * Run the whole extraction against one URL on an already-launched page. Returns the DNA record,
 * provenance, screenshots, and the run log. Throws only on a dead page (caller wraps in
 * withPage's typed failure).
 */
export async function extractFromPage(page: Page, url: string): Promise<ExtractionResult> {
  const log: ExtractionLogEntry[] = [];
  const behaviors: Behavior[] = [];
  const missed: string[] = [];
  let botWall = false;

  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  const status = response?.status() ?? 0;
  if (status === 403 || status === 429 || status === 503) {
    botWall = true;
    logEntry(log, "navigate", "failed", `HTTP ${status} — likely an anti-bot wall; continuing with whatever rendered`);
  } else {
    logEntry(log, "navigate", "ok", `HTTP ${status}`);
  }
  await page.waitForLoadState("networkidle", { timeout: 12_000 }).catch(() => {
    logEntry(log, "navigate:networkidle", "skipped", "network never went idle in 12s — proceeding (long-pollers do this)");
  });
  await page.waitForTimeout(800);

  await dismissCookieBanner(page, log);

  // Force lazy sections to render before the audit: one full scroll pass, then back to top.
  await page.evaluate(
    "(async function(){ const h = Math.max(document.body.scrollHeight, 1); for (let y = 0; y <= h; y += Math.max(600, Math.round(h / 10))) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } window.scrollTo(0, 0); })()",
  );
  await page.waitForTimeout(700);
  logEntry(log, "lazy-load-pass", "ok", "full-page scroll pass to force lazy sections");

  // The audit at 1440 (the primary viewport).
  const audit = (await page.evaluate(PAGE_AUDIT_SCRIPT)) as PageAudit;
  logEntry(log, "page-audit", "ok", `${audit.sections.length} sections, ${audit.buttons.length} button samples, ${audit.fonts.length} font stacks`);

  // Asset discovery — identification only; counts inform layout + coverage, nothing downloads.
  const assets = (await page.evaluate(ASSET_DISCOVERY_SCRIPT)) as {
    imageCount: number;
    largeImageCount: number;
    layeredCompositions: number;
    videoCount: number;
    canvasCount: number;
    inlineSvgCount: number;
    backgroundImageCount: number;
  };
  logEntry(
    log,
    "asset-discovery",
    "ok",
    `${assets.imageCount} imgs (${assets.layeredCompositions} layered comps), ${assets.videoCount} videos, ${assets.canvasCount} canvas, ${assets.inlineSvgCount} inline SVGs, ${assets.backgroundImageCount} bg-images — identified only, nothing downloaded`,
  );
  if (assets.canvasCount > 0) missed.push(`${assets.canvasCount} canvas/WebGL surfaces — visual content not reproducible from styles`);

  // Screenshots: full-page desktop now, mobile after the responsive sweep.
  const screenshots: ScreenshotCapture[] = [];
  try {
    const desktopShot = await page.screenshot({ fullPage: true, type: "jpeg", quality: 55 });
    let b64 = desktopShot.toString("base64");
    if (b64.length > SCREENSHOT_MAX_BASE64) {
      const viewportShot = await page.screenshot({ fullPage: false, type: "jpeg", quality: 55 });
      b64 = viewportShot.toString("base64");
      logEntry(log, "screenshot:1440", "ok", "full-page capture over size cap — stored viewport capture instead");
      missed.push("Full-page 1440 screenshot over the size cap — viewport-only stored");
    } else {
      logEntry(log, "screenshot:1440", "ok", `${Math.round(b64.length / 1024)}KB base64`);
    }
    screenshots.push({ name: "full-1440.jpg", base64: b64 });
  } catch (e) {
    logEntry(log, "screenshot:1440", "failed", e instanceof Error ? e.message : String(e));
    missed.push("Desktop screenshot failed");
  }

  // The interaction sweep — 90-second hard budget, every attempt logged.
  const deadline = Date.now() + INTERACTION_SWEEP_BUDGET_MS;
  await scrollSweep({ page, audit, behaviors, log, deadline });
  await hoverSweep({ page, audit, behaviors, log, deadline });
  await clickSweep({ page, audit, behaviors, log, deadline });
  if (audit.smoothScrollLib) {
    behaviors.push({
      name: `${audit.smoothScrollLib}-smooth-scroll`,
      trigger_type: "scroll",
      trigger: "all scrolling (library-driven)",
      from: "native scroll physics",
      to: `${audit.smoothScrollLib} interpolated scroll`,
      transition: "library-controlled",
      mechanism: "smooth-scroll-lib",
    });
    logEntry(log, "smooth-scroll-detect", "ok", `${audit.smoothScrollLib} detected`);
  }
  missed.push("Time-driven behaviors (auto-cycling carousels) not state-diffed — unattended sweep observes one pass only");
  missed.push("Hover-within-hover menus and multi-step interactions beyond ARIA tabs not swept");

  // Responsive sweep: re-scan section structure at 1440 / 768 / 390.
  const scans: Record<number, ResponsiveScan> = {};
  for (const width of SWEEP_VIEWPORTS) {
    try {
      await page.setViewportSize({ width, height: width >= 768 ? 900 : 844 });
      await page.waitForTimeout(600);
      scans[width] = (await page.evaluate(RESPONSIVE_SCAN_SCRIPT)) as ResponsiveScan;
      logEntry(log, `responsive-scan:${width}`, "ok", `${scans[width].length} sections measured`);
    } catch (e) {
      scans[width] = [];
      logEntry(log, `responsive-scan:${width}`, "failed", e instanceof Error ? e.message : String(e));
      missed.push(`Responsive scan at ${width} failed`);
    }
  }

  // Mobile screenshot at 390.
  try {
    const mobileShot = await page.screenshot({ fullPage: true, type: "jpeg", quality: 55 });
    let b64 = mobileShot.toString("base64");
    if (b64.length > SCREENSHOT_MAX_BASE64) {
      const viewportShot = await page.screenshot({ fullPage: false, type: "jpeg", quality: 55 });
      b64 = viewportShot.toString("base64");
      missed.push("Full-page 390 screenshot over the size cap — viewport-only stored");
    }
    screenshots.push({ name: "full-390.jpg", base64: b64 });
    logEntry(log, "screenshot:390", "ok", `${Math.round(b64.length / 1024)}KB base64`);
  } catch (e) {
    logEntry(log, "screenshot:390", "failed", e instanceof Error ? e.message : String(e));
    missed.push("Mobile screenshot failed");
  }

  // Restore desktop for any further work.
  await page.setViewportSize({ width: 1440, height: 900 }).catch(() => undefined);

  const dna: DesignDna = {
    interaction_model: inferInteractionModel(behaviors, audit.scrollSnap),
    palette: buildPalette(audit),
    typography: buildTypography(audit),
    spacing: buildSpacing(audit.spacingSamples),
    radius: buildRadius(audit.radii),
    shadows: buildShadows(audit.shadows),
    layout: buildLayout(audit, scans[1440] ?? [], scans[390] ?? []),
    behaviors,
    coverage: {
      complete: false, // a claim an unattended run doesn't get to make (SPEC principle 7)
      missed,
      bot_wall: botWall,
      notes: `Unattended headless run. ${log.filter((l) => l.outcome === "failed").length} failed steps, ${log.filter((l) => l.outcome === "skipped").length} skipped — see the extraction log.`,
    },
  };

  const source: SourceMeta = {
    url,
    final_url: page.url(),
    title: audit.title,
    captured_at: new Date().toISOString().slice(0, 10),
    viewports: [...SWEEP_VIEWPORTS],
    extractor: EXTRACTOR_VERSION,
    capture_method: "headless",
    screenshots: screenshots.map((s) => `screenshots/${s.name}`),
  };

  return { dna, source, screenshots, log };
}

/** Render the run log as the markdown file committed beside the profile. */
export function renderExtractionLog(log: ExtractionLogEntry[], url: string): string {
  const lines = [
    `# Extraction log — ${url}`,
    "",
    "Unattended run. Every state-diff attempt, skip, and failure below — no silent gaps.",
    "",
    "| Time | Step | Outcome | Detail |",
    "| :--- | :--- | :--- | :--- |",
  ];
  const cell = (s: string): string => s.replace(/\|/g, "\\|");
  for (const entry of log) {
    lines.push(`| ${entry.at.slice(11, 19)} | ${cell(entry.step)} | ${entry.outcome} | ${cell(entry.detail)} |`);
  }
  return lines.join("\n") + "\n";
}
