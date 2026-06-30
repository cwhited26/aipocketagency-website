// tags.ts — pure helpers for the Captures Dashboard tag/tab system (the MindChuk-style colored tab
// strip + per-card tag chips). Everything here is pure → unit-tested, so the palette, color
// assignment, tab membership, "move to tag" rewrite, auto-classify mapping, and contrast-accessibility
// guarantees are all exercised without a database or React.
//
// DATA MODEL: a tag/tab is an owner-defined { id, name, color } row in pa_capture_tags (migration 097).
// Tag ASSIGNMENT rides a capture's existing additive tags[] meta (src/lib/pa-inbox.ts): a capture
// belongs to a tab when its tags[] contains the tab's name (case-insensitive). "All" is a virtual tab
// the UI always renders first — it has no row and matches every capture.

import { z } from "zod";
import { normalizeTags } from "@/lib/pa-inbox";

// ─── The 12-color palette ───────────────────────────────────────────────────────────
// Twelve vivid hues, all bright enough to clear the WCAG 3:1 non-text-contrast minimum against the
// dashboard's near-black card backgrounds (verified in tags.test.ts), so a 4px color border and a
// tinted chip are always perceivable. Each entry is { name, hex }; hex is the canonical #rrggbb value
// stored in color_hex and used for the card's left border + chip accents.
export const CAPTURE_TAG_PALETTE = [
  { name: "rose", hex: "#fb7185" },
  { name: "orange", hex: "#fb923c" },
  { name: "amber", hex: "#fbbf24" },
  { name: "lime", hex: "#a3e635" },
  { name: "green", hex: "#4ade80" },
  { name: "emerald", hex: "#34d399" },
  { name: "teal", hex: "#2dd4bf" },
  { name: "cyan", hex: "#22d3ee" },
  { name: "sky", hex: "#38bdf8" },
  { name: "indigo", hex: "#818cf8" },
  { name: "violet", hex: "#a78bfa" },
  { name: "fuchsia", hex: "#e879f9" },
] as const;

export type PaletteColor = (typeof CAPTURE_TAG_PALETTE)[number];

/** Every palette hex, in order. The settings color picker iterates this. */
export const PALETTE_HEXES: readonly string[] = CAPTURE_TAG_PALETTE.map((c) => c.hex);

/** The darkest dashboard surface a tag color must remain perceivable against (the page background). */
export const CARD_BG_HEX = "#06080b";

// ─── Tag shape ───────────────────────────────────────────────────────────────────────
// The dashboard + settings work with this validated shape (the DB row, minus owner_id/created_at).
export const CaptureTagSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(40),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  sortOrder: z.number().int(),
});
export type CaptureTag = z.infer<typeof CaptureTagSchema>;

// ─── Default seed ──────────────────────────────────────────────────────────────────────
// Created per-owner lazily on first read (tags-db.ts ensureSeedTags) — a static migration can't seed
// per-owner rows. "All" is NOT here: it's the virtual always-first tab the UI renders. These four are
// the spec's default content tabs, each with a distinct, accessible palette color.
export const DEFAULT_TAG_SEED: ReadonlyArray<{ name: string; colorHex: string }> = [
  { name: "Wins", colorHex: "#34d399" }, // emerald
  { name: "Ideas", colorHex: "#fbbf24" }, // amber
  { name: "Tasks", colorHex: "#38bdf8" }, // sky
  { name: "Reference", colorHex: "#a78bfa" }, // violet
];

/** The virtual "All" tab id/name the UI renders first; never persisted. */
export const ALL_TAB_ID = "__all__";
export const ALL_TAB_NAME = "All";

// ─── Color assignment ────────────────────────────────────────────────────────────────

/**
 * The next palette color to offer when adding a tag: the first palette hex not already used by an
 * existing tag, falling back to cycling the palette by count once every hue is taken. Pure → the
 * "add tag" form pre-selects a non-colliding color without the owner having to think about it.
 */
export function nextPaletteColor(existingHexes: readonly string[]): string {
  const used = new Set(existingHexes.map((h) => h.toLowerCase()));
  const free = CAPTURE_TAG_PALETTE.find((c) => !used.has(c.hex.toLowerCase()));
  if (free) return free.hex;
  // Every hue used at least once → cycle deterministically by how many tags exist.
  return CAPTURE_TAG_PALETTE[existingHexes.length % CAPTURE_TAG_PALETTE.length].hex;
}

/** Snap an arbitrary hex to the nearest palette entry, or the first palette color if unparseable.
 *  Keeps stored colors on-palette even if a client posts something off-list. Pure. */
export function snapToPalette(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return CAPTURE_TAG_PALETTE[0].hex;
  let best: PaletteColor = CAPTURE_TAG_PALETTE[0];
  let bestDist = Number.POSITIVE_INFINITY;
  for (const c of CAPTURE_TAG_PALETTE) {
    const o = hexToRgb(c.hex);
    if (!o) continue;
    const d = (rgb.r - o.r) ** 2 + (rgb.g - o.g) ** 2 + (rgb.b - o.b) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best.hex;
}

/** True when `hex` is one of the 12 palette colors (case-insensitive). Pure. */
export function isPaletteColor(hex: string): boolean {
  return PALETTE_HEXES.some((h) => h.toLowerCase() === hex.toLowerCase());
}

// ─── Contrast accessibility (WCAG) ────────────────────────────────────────────────────

type Rgb = { r: number; g: number; b: number };

/** Parse "#rrggbb" (or "#rgb") to {r,g,b} 0–255, or null if malformed. Pure. */
export function hexToRgb(hex: string): Rgb | null {
  const m = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** Relative luminance (WCAG 2.1) of a color, 0 (black) – 1 (white). Pure. */
export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b);
}

/** WCAG contrast ratio between two colors (1–21). Symmetric. Pure. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG 3:1 non-text (UI component / graphical object) contrast minimum — the bar a 4px tab border
 *  and a color chip must clear against the dark card background to be perceivable. */
export const UI_CONTRAST_MIN = 3;

/** True when `color` is perceivable as a UI accent on `bg` (≥ 3:1). Pure. */
export function hasAccessibleContrast(color: string, bg: string = CARD_BG_HEX): boolean {
  return contrastRatio(color, bg) >= UI_CONTRAST_MIN;
}

// ─── Tab membership + "move to tag" ────────────────────────────────────────────────────

/** Lowercased set of the owner's real tab names (excludes the virtual "All"). Pure. */
export function tabNameSet(tabs: ReadonlyArray<Pick<CaptureTag, "name">>): Set<string> {
  return new Set(tabs.map((t) => t.name.toLowerCase()));
}

/**
 * The tab a capture is assigned to: the first of the capture's tags[] that matches a defined tab name
 * (case-insensitive), or null when none match (it shows only under "All"). Defined-tab order wins so
 * the assignment is stable regardless of tag insertion order. Pure → unit-tested.
 */
export function assignedTab(
  captureTags: readonly string[],
  tabs: ReadonlyArray<Pick<CaptureTag, "name">>,
): string | null {
  const have = new Set(captureTags.map((t) => t.toLowerCase()));
  for (const tab of tabs) {
    if (have.has(tab.name.toLowerCase())) return tab.name;
  }
  return null;
}

/** True when a capture belongs under `tabName` ("All" matches everything). Pure. */
export function captureMatchesTab(
  captureTags: readonly string[],
  tabName: string,
  tabs: ReadonlyArray<Pick<CaptureTag, "name">>,
): boolean {
  if (tabName === ALL_TAB_NAME) return true;
  return assignedTab(captureTags, tabs) === tabName;
}

/**
 * Rewrite a capture's tags[] to move it to `tabName` (or to clear its tab when tabName is null/"All"):
 * strip every tag that matches a *defined* tab name, then prepend the chosen tab. Free-form
 * (non-tab) tags are preserved. Normalized + deduped. Pure → unit-tested; the per-card "Move to tag"
 * dropdown PATCHes the result to the existing captures mutation route.
 */
export function moveToTab(
  captureTags: readonly string[],
  tabName: string | null,
  tabs: ReadonlyArray<Pick<CaptureTag, "name">>,
): string[] {
  const tabNames = tabNameSet(tabs);
  const keep = captureTags.filter((t) => !tabNames.has(t.toLowerCase()));
  const next = tabName && tabName !== ALL_TAB_NAME ? [tabName, ...keep] : keep;
  return normalizeTags(next);
}

// ─── Auto-classify → tab mapping ──────────────────────────────────────────────────────
// Two routes to a suggested tab, reusing the capture-triage taxonomy (src/lib/capture-inbox):
//   1. tabForBucket  — map a Haiku triage bucket to a default tab name (when a bucket is available).
//   2. autoClassifyTab — a fast, deterministic, API-key-free keyword heuristic over the capture text,
//      so every capture can get a zero-cost suggested tab on load without an LLM call. The owner
//      approves (persists) or rejects the suggestion from the card. Both are pure → unit-tested.

/** The six capture-triage buckets (mirrors src/lib/capture-inbox/types TriageBucket). */
export type TriageBucketName =
  | "competitive"
  | "tactic"
  | "testimonial"
  | "industry"
  | "personal"
  | "unsure";

const BUCKET_TO_TAB: Record<TriageBucketName, string | null> = {
  testimonial: "Wins",
  tactic: "Ideas",
  industry: "Reference",
  competitive: "Reference",
  personal: "Tasks",
  unsure: null,
};

/** Default tab name for a triage bucket, or null when the bucket is "unsure". Pure. */
export function tabForBucket(bucket: TriageBucketName): string | null {
  return BUCKET_TO_TAB[bucket];
}

// Keyword signals per default tab, checked in this fixed precedence. The first tab whose signal
// appears in the text wins, so the mapping is deterministic and testable. URLs are a strong
// Reference signal; explicit task/reminder verbs beat softer idea/win language.
const CLASSIFY_RULES: ReadonlyArray<{ tab: string; signals: readonly RegExp[] }> = [
  {
    tab: "Tasks",
    signals: [
      /\b(todo|to-do|task|remind(?:er)?|follow[\s-]?up|need to|call|schedule|deadline|due\b)/i,
      /\bbuy\b|\bfix\b|\bsend\b/i,
    ],
  },
  {
    tab: "Wins",
    signals: [
      /\b(won|win|closed|signed|paid|booked|landed|milestone|congrats?|crushed)\b/i,
      /\b(testimonial|review|loved it|five[\s-]?star|🎉|🙌|💰)/i,
    ],
  },
  {
    tab: "Ideas",
    signals: [/\b(idea|what if|could we|maybe we|concept|brainstorm|💡|hypothesis)\b/i],
  },
  {
    tab: "Reference",
    signals: [
      /https?:\/\//i,
      /\b(article|read this|guide|how[\s-]?to|doc(?:s|umentation)?|reference|watch this|case study)\b/i,
    ],
  },
];

/**
 * A zero-cost suggested tab for a capture from its title+body, or null when nothing matches. Pure,
 * deterministic, no API key — runnable on every capture at load. Reuses the triage taxonomy's intent
 * but keyed on cheap keyword signals rather than a Haiku call. Pure → unit-tested.
 */
export function autoClassifyTab(text: string): string | null {
  const hay = text.toLowerCase();
  for (const rule of CLASSIFY_RULES) {
    if (rule.signals.some((re) => re.test(hay))) return rule.tab;
  }
  return null;
}
