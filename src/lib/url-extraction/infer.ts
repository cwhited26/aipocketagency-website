// infer.ts — pure inference: turns the raw page-audit JSON into the Design DNA blocks.
// No I/O, no browser — everything here is unit-testable in isolation. Exact values only
// (SPEC principle 4): a role with no defensible value is omitted, never guessed.

import { approxLuminance, cssColorToOklch, isTransparent } from "./oklch";
import type {
  Behavior,
  InteractionModel,
  LayoutSection,
  Palette,
  PaletteRole,
  RadiusEntry,
  ShadowEntry,
  Spacing,
  TypeScaleStep,
  Typography,
} from "./types";

// ── The audit payload shape (mirror of PAGE_AUDIT_SCRIPT's return) ────────────────────────

export type AuditTypeSample = {
  fontSize: number;
  lineHeight: number | null;
  fontWeight: number;
  fontFamily: string;
  letterSpacing: string;
  textTransform: string;
};

export type AuditButton = {
  selector: string;
  backgroundColor: string;
  color: string;
  borderRadius: string;
  borderColor: string;
  boxShadow: string;
  fontSize: number;
  area: number;
  top: number;
};

export type AuditSection = {
  label: string;
  selector: string;
  tag: string;
  top: number;
  height: number;
  childCount: number;
  display: string;
  gridCols: number;
  descendantGridCols: number;
  position: string;
  hasVideo: boolean;
  hasCanvas: boolean;
  imageCount: number;
  linkCount: number;
  buttonCount: number;
  headingLevel: string | null;
  textDensity: number;
  classHint: string;
  hasMarqueeHint: boolean;
  hasPricingHint: boolean;
  hasAccordionHint: boolean;
  centeredText: boolean;
};

export type PageAudit = {
  title: string;
  docHeight: number;
  body: { backgroundColor: string; color: string; fontFamily: string; fontSize: number };
  fonts: string[];
  weights: number[];
  headings: Array<{ level: string } & AuditTypeSample>;
  bodySample: AuditTypeSample | null;
  navSample: AuditTypeSample | null;
  buttons: AuditButton[];
  bgAreas: Array<{ color: string; area: number }>;
  borderColors: Array<{ color: string; count: number }>;
  radii: Array<{ px: number; kind: string; count: number }>;
  shadows: Array<{ value: string; count: number }>;
  letterSpacings: Array<{ value: string; context: string; count: number }>;
  spacingSamples: number[];
  sections: AuditSection[];
  navSelector: string | null;
  navPosition: string | null;
  scrollSnap: boolean;
  smoothScrollLib: string | null;
  hiddenCandidates: Array<{ selector: string; opacity: number; transform: string }>;
  tabSelectors: string[];
  hoverTargets: string[];
};

export type ResponsiveScan = Array<{ height: number; cols: number }>;

// ── Palette ───────────────────────────────────────────────────────────────────────────────

function role(value: string, source: PaletteRole["source"] = "computed"): PaletteRole | null {
  const oklch = cssColorToOklch(value);
  return oklch ? { oklch, source } : null;
}

/**
 * Map area-weighted computed colors onto shadcn role names (PA-DNA-3). background/foreground
 * come straight off the body; primary off the most prominent filled button; card/muted off the
 * next-largest surface colors; border off the most common border color. Roles with no
 * defensible value are omitted.
 */
export function buildPalette(audit: PageAudit): Palette {
  const roles: Record<string, PaletteRole> = {};

  const background = role(audit.body.backgroundColor);
  if (background) roles.background = background;
  const foreground = role(audit.body.color);
  if (foreground) roles.foreground = foreground;

  const bgLum = approxLuminance(audit.body.backgroundColor);
  const mode: Palette["mode"] = bgLum !== null && bgLum < 0.3 ? "dark" : "light";

  // Primary: the filled button highest on the page (the hero CTA wins over footer buttons).
  const candidateButtons = audit.buttons
    .filter((b) => !isTransparent(b.backgroundColor))
    .filter((b) => {
      // A button whose fill equals the page background is a ghost button, not the primary.
      const same = cssColorToOklch(b.backgroundColor) === cssColorToOklch(audit.body.backgroundColor);
      return !same;
    })
    .sort((a, b) => a.top - b.top);
  const primaryButton = candidateButtons[0];
  if (primaryButton) {
    const primary = role(primaryButton.backgroundColor);
    if (primary) roles.primary = primary;
    const primaryFg = role(primaryButton.color);
    if (primaryFg) roles["primary-foreground"] = primaryFg;
  }

  // Surface colors: the largest non-body background areas become card / muted.
  const surfaceRoles = ["card", "muted"] as const;
  let surfaceIndex = 0;
  for (const entry of audit.bgAreas) {
    if (surfaceIndex >= surfaceRoles.length) break;
    const oklch = cssColorToOklch(entry.color);
    if (!oklch) continue;
    if (oklch === roles.background?.oklch) continue;
    if (oklch === roles.primary?.oklch) continue;
    if (isTransparent(entry.color)) continue;
    roles[surfaceRoles[surfaceIndex]] = { oklch, source: "computed" };
    surfaceIndex++;
  }

  const borderEntry = audit.borderColors[0];
  if (borderEntry) {
    const border = role(borderEntry.color);
    if (border) roles.border = border;
  }

  // muted-foreground: inferred middle tone between background and foreground when both exist.
  if (roles.background && roles.foreground && !roles["muted-foreground"]) {
    const fgLum = approxLuminance(audit.body.color);
    if (bgLum !== null && fgLum !== null) {
      const mid = Math.round(255 * Math.sqrt((bgLum + fgLum) / 2));
      const inferred = role(`rgb(${mid}, ${mid}, ${mid})`, "inferred");
      if (inferred) roles["muted-foreground"] = inferred;
    }
  }

  return { roles, extras: [], mode };
}

// ── Typography ────────────────────────────────────────────────────────────────────────────

function primaryFamily(stack: string): { family: string; fallbacks: string[] } {
  const parts = stack.split(",").map((p) => p.trim().replace(/^["']|["']$/g, ""));
  return { family: parts[0] ?? "system-ui", fallbacks: parts.slice(1, 4) };
}

const HEADING_USAGE: Record<string, string> = {
  h1: "hero headline (1440)",
  h2: "section headings",
  h3: "card / feature headings",
  h4: "small headings",
};

export function buildTypography(audit: PageAudit): Typography {
  const families: Typography["families"] = [];
  const bodyStack = primaryFamily(audit.body.fontFamily);
  const displayStack = audit.headings[0] ? primaryFamily(audit.headings[0].fontFamily) : null;

  if (displayStack && displayStack.family !== bodyStack.family) {
    families.push({ role: "display", ...displayStack, source: "unknown" });
  }
  families.push({ role: "body", ...bodyStack, source: "unknown" });
  const monoStack = audit.fonts.find((f) => /mono|menlo|consolas|courier/i.test(f));
  if (monoStack) {
    families.push({ role: "mono", ...primaryFamily(monoStack), source: "unknown" });
  }

  // The discrete sizes the site actually uses — headings, lede, body, nav — deduped by px.
  const steps = new Map<number, TypeScaleStep>();
  for (const h of audit.headings) {
    if (!steps.has(h.fontSize)) {
      steps.set(h.fontSize, {
        px: h.fontSize,
        line_height: h.lineHeight ?? Math.round(h.fontSize * 1.2 * 10) / 10,
        usage: HEADING_USAGE[h.level] ?? h.level,
      });
    }
  }
  if (audit.bodySample && !steps.has(audit.bodySample.fontSize)) {
    steps.set(audit.bodySample.fontSize, {
      px: audit.bodySample.fontSize,
      line_height: audit.bodySample.lineHeight ?? Math.round(audit.bodySample.fontSize * 1.5 * 10) / 10,
      usage: "body",
    });
  }
  if (audit.navSample && !steps.has(audit.navSample.fontSize)) {
    steps.set(audit.navSample.fontSize, {
      px: audit.navSample.fontSize,
      line_height: audit.navSample.lineHeight ?? Math.round(audit.navSample.fontSize * 1.4 * 10) / 10,
      usage: "nav, captions, labels",
    });
  }

  const weightsUsed = audit.weights.filter((w) => w >= 100 && w <= 1000);

  return {
    families,
    weights_used: weightsUsed,
    scale: Array.from(steps.values()).sort((a, b) => b.px - a.px),
    letter_spacing: audit.letterSpacings
      .filter((ls) => ls.count >= 2)
      .map((ls) => ({ value: ls.value, usage: ls.context })),
  };
}

// ── Spacing ───────────────────────────────────────────────────────────────────────────────

/**
 * Infer the spacing grid from observed section paddings + gaps: prefer 8 if most values divide
 * by 8, else 4, else null (an honest "no rhythm" finding, SPEC §8.2).
 */
export function buildSpacing(samples: number[]): Spacing {
  const meaningful = samples.filter((s) => s >= 4 && s <= 400);
  if (meaningful.length < 3) {
    return { base_unit_px: null, multipliers_used: [], notes: "Too few observed spacings to infer a rhythm." };
  }
  const divisibleBy = (unit: number): number =>
    meaningful.filter((s) => s % unit === 0).length / meaningful.length;

  let base: number | null = null;
  if (divisibleBy(8) >= 0.7) base = 8;
  else if (divisibleBy(4) >= 0.7) base = 4;

  if (base === null) {
    return {
      base_unit_px: null,
      multipliers_used: [],
      notes: `No consistent grid — observed values ${Array.from(new Set(meaningful)).sort((a, b) => a - b).slice(0, 8).join(", ")}px.`,
    };
  }

  const multipliers = Array.from(
    new Set(meaningful.filter((s) => s % base === 0).map((s) => s / base)),
  ).sort((a, b) => a - b);
  const sectionPads = meaningful.filter((s) => s >= 48);
  const notes = sectionPads.length
    ? `Section vertical padding observed ${Math.min(...sectionPads)}–${Math.max(...sectionPads)}px on desktop.`
    : "Observed paddings and gaps sit on the grid; no large section padding measured.";

  return { base_unit_px: base, multipliers_used: multipliers.slice(0, 10), notes };
}

// ── Radius + shadows ──────────────────────────────────────────────────────────────────────

const RADIUS_USAGE: Record<string, string> = {
  button: "buttons, inputs, small chips",
  card: "cards, feature tiles",
  media: "screenshots / media frames",
  other: "misc containers",
};

export function buildRadius(radii: PageAudit["radii"]): RadiusEntry[] {
  const byPx = new Map<number, { px: number; kind: string; count: number }>();
  for (const r of radii) {
    const existing = byPx.get(r.px);
    if (!existing || r.count > existing.count) byPx.set(r.px, r);
  }
  return Array.from(byPx.values())
    .sort((a, b) => a.px - b.px)
    .slice(0, 5)
    .map((r) => ({ px: r.px, usage: RADIUS_USAGE[r.kind] ?? r.kind }));
}

export function buildShadows(shadows: PageAudit["shadows"]): ShadowEntry[] {
  return shadows
    .filter((s) => s.count >= 2)
    .slice(0, 4)
    .map((s, i) => ({ value: s.value, usage: i === 0 ? "common low elevation" : "raised surfaces" }));
}

// ── Layout archetypes ─────────────────────────────────────────────────────────────────────

/**
 * Classify a section into the seeded archetype vocabulary (SPEC §8.2). Heuristic by structure —
 * grid columns, media density, text density, class hints — with honest generic fallbacks
 * (content-stack / media-block) when nothing distinctive fits.
 */
export function classifyArchetype(
  section: AuditSection,
  opts: { collapsesOnMobile: boolean },
): { archetype: string; notes?: string } {
  const cols = Math.max(section.gridCols, section.descendantGridCols);
  const collapseNote = opts.collapsesOnMobile ? "single column at 390" : undefined;

  if (section.label === "nav") {
    return {
      archetype: section.position === "sticky" || section.position === "fixed" ? "sticky-blur-nav" : "static-nav",
      notes: section.position === "sticky" || section.position === "fixed" ? "pinned while scrolling" : undefined,
    };
  }
  if (section.label === "footer" || section.tag === "footer") {
    return {
      archetype: cols >= 3 ? "multi-column-footer" : "stacked-footer",
      notes: cols >= 3 ? `${cols} columns desktop${collapseNote ? `, ${collapseNote}` : ""}` : collapseNote,
    };
  }
  if (section.hasPricingHint && cols >= 2) {
    return { archetype: "pricing-columns", notes: `${cols} plans${collapseNote ? `, ${collapseNote}` : ""}` };
  }
  if (section.hasMarqueeHint && section.imageCount >= 4 && section.textDensity < 40) {
    return { archetype: "logo-marquee" };
  }
  if (section.hasAccordionHint) {
    return { archetype: "accordion-stack" };
  }
  if (section.hasVideo && section.height > 500 && section.textDensity < 60) {
    return { archetype: "full-bleed-video" };
  }
  if (section.headingLevel === "h1") {
    return {
      archetype: section.centeredText ? "centered-stack" : "split-column",
      notes: section.centeredText
        ? "headline → sub → CTA stack"
        : "headline column beside media",
    };
  }
  if (cols >= 3 && section.childCount >= 3) {
    return { archetype: "bento-grid", notes: `${cols}-column grid${collapseNote ? `, ${collapseNote}` : ""}` };
  }
  if (cols === 2) {
    return { archetype: "split-column", notes: collapseNote };
  }
  if (section.buttonCount >= 1 && section.height < 500 && section.centeredText && section.textDensity < 150) {
    return { archetype: "full-bleed-banner", notes: "CTA banner" };
  }
  if (section.imageCount >= 3 && section.textDensity < 80) {
    return { archetype: "card-grid", notes: collapseNote };
  }
  return { archetype: section.imageCount > 0 ? "media-block" : "content-stack", notes: collapseNote };
}

export function buildLayout(
  audit: PageAudit,
  desktopScan: ResponsiveScan,
  mobileScan: ResponsiveScan,
): LayoutSection[] {
  // Match desktop/mobile scans by index — both walk the same DOM order.
  return audit.sections.map((section, i) => {
    const desktopCols = desktopScan[i - (audit.sections[0]?.label === "nav" ? 1 : 0)]?.cols ?? 1;
    const mobileCols = mobileScan[i - (audit.sections[0]?.label === "nav" ? 1 : 0)]?.cols ?? 1;
    const { archetype, notes } = classifyArchetype(section, {
      collapsesOnMobile: desktopCols > 1 && mobileCols === 1,
    });
    const entry: LayoutSection = { section: section.label, archetype };
    if (notes) entry.notes = notes;
    return entry;
  });
}

// ── Interaction model ─────────────────────────────────────────────────────────────────────

export function inferInteractionModel(behaviors: Behavior[], scrollSnap: boolean): InteractionModel {
  const types = new Set(behaviors.map((b) => b.trigger_type));
  if (scrollSnap) types.add("scroll");
  if (types.size === 0) return "static";
  if (types.size > 1) return "mixed";
  const only = Array.from(types)[0];
  if (only === "scroll") return "scroll-driven";
  if (only === "click") return "click-driven";
  if (only === "time") return "time-driven";
  return "mixed"; // hover-only pages still read as mixed — hover alone doesn't drive a page
}
