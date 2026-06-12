// types.ts — the Design DNA record shape the extraction worker writes (recon Lane C, Phase 1).
//
// This is the TypeScript mirror of the Design DNA SPEC v1 `design_dna:` frontmatter block
// (APA/Products/Pocket_Agent_Design_DNA_SPEC_v1.md §8.1). One record type, three consumers —
// Competitor Inspector profiles embed this block verbatim; standalone design-dna/ records and
// "Build like that" read the identical shape. Style only, structurally: there are NO fields for
// page copy, downloaded assets, or font files (PA-DNA-7) — the schema physically can't carry
// what extraction must never take.

export const DNA_SCHEMA_VERSION = 1;

/** The dominant interaction model for the page — the first thing a build consumer reads. */
export type InteractionModel = "static" | "scroll-driven" | "click-driven" | "time-driven" | "mixed";

/** Whether a palette value was read off the engine or derived (e.g. a foreground by contrast). */
export type ValueSource = "computed" | "inferred";

export type PaletteRole = {
  oklch: string;
  source: ValueSource;
};

export type PaletteExtra = {
  name: string;
  oklch: string;
  usage: string;
};

export type Palette = {
  /** shadcn token vocabulary (PA-DNA-3): background, foreground, primary, muted, border, … */
  roles: Record<string, PaletteRole>;
  extras: PaletteExtra[];
  mode: "dark" | "light" | "both";
};

export type FontFamily = {
  role: "display" | "body" | "mono";
  family: string;
  fallbacks: string[];
  /** Family names only — never a font file reference (the IP line). */
  source: "google" | "local" | "unknown";
};

export type TypeScaleStep = {
  px: number;
  line_height: number;
  usage: string;
};

export type LetterSpacing = {
  value: string;
  usage: string;
};

export type Typography = {
  families: FontFamily[];
  /** Exact computed weights — variable fonts return non-standard values like 510. */
  weights_used: number[];
  /** The discrete sizes the site actually uses, not a generic ramp. */
  scale: TypeScaleStep[];
  /** Only deliberate values — defaults are omitted so every entry means something. */
  letter_spacing: LetterSpacing[];
};

export type Spacing = {
  /** The inferred grid (4, 8, …) — null with a notes explanation when no rhythm exists. */
  base_unit_px: number | null;
  multipliers_used: number[];
  notes: string;
};

export type RadiusEntry = { px: number; usage: string };
export type ShadowEntry = { value: string; usage: string };

export type LayoutSection = {
  section: string;
  /** Open vocabulary with a seeded set (SPEC §8.2) — coin reusable names, never one-off prose. */
  archetype: string;
  notes?: string;
};

export type BehaviorTriggerType = "scroll" | "click" | "hover" | "time";

export type BehaviorMechanism =
  | "intersection-observer"
  | "scroll-listener"
  | "css-transition"
  | "css-animation"
  | "scroll-snap"
  | "position-sticky"
  | "js-state"
  | "js-timer"
  | "smooth-scroll-lib"
  | "unknown";

/** The compressed BEHAVIORS.md shape (PA-DNA-6): the state diff IS the behavior specification. */
export type Behavior = {
  name: string;
  trigger_type: BehaviorTriggerType;
  trigger: string;
  from: string;
  to: string;
  transition: string;
  mechanism: BehaviorMechanism;
};

/** Required honesty block (SPEC principle 7) — "complete" is a claim, never a default. */
export type Coverage = {
  complete: boolean;
  missed: string[];
  bot_wall: boolean;
  notes: string;
};

export type DesignDna = {
  interaction_model: InteractionModel;
  palette: Palette;
  typography: Typography;
  spacing: Spacing;
  radius: RadiusEntry[];
  shadows: ShadowEntry[];
  layout: LayoutSection[];
  behaviors: Behavior[];
  coverage: Coverage;
};

/** Provenance for the capture — complete enough to reproduce or audit it (SPEC §8.2). */
export type SourceMeta = {
  url: string;
  final_url: string;
  title: string;
  captured_at: string; // YYYY-MM-DD
  viewports: number[];
  extractor: string;
  capture_method: "headless";
  screenshots: string[]; // brain-relative refs, filled at commit time
};

/** One JPEG capture held on the run row until the staged approval commits it beside the profile. */
export type ScreenshotCapture = {
  /** File name inside the profile's screenshots/ folder, e.g. full-1440.jpg */
  name: string;
  base64: string;
};

/** One line in the unattended-run extraction log — every attempt and failure, no silent gaps. */
export type ExtractionLogEntry = {
  at: string; // ISO timestamp
  step: string;
  outcome: "ok" | "skipped" | "failed";
  detail: string;
};

export type ExtractionResult = {
  dna: DesignDna;
  source: SourceMeta;
  screenshots: ScreenshotCapture[];
  log: ExtractionLogEntry[];
};

/** The pa_url_extractions row (migration 078). */
export type UrlExtractionRow = {
  id: string;
  owner_id: string;
  source_url: string;
  status: "running" | "extracted" | "awaiting_approval" | "committed" | "failed";
  note: string | null;
  profile_md: string | null;
  extraction_log_md: string | null;
  screenshots: ScreenshotCapture[] | null;
  dna_record_path: string | null;
  extraction_log_path: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};

export const EXTRACTOR_VERSION = "pa-extraction-worker/v1";

/** The three-viewport responsive sweep widths (the cloner's outer pair + tablet). */
export const SWEEP_VIEWPORTS = [1440, 768, 390] as const;

/** Hard budget for the unattended interaction sweep — log what didn't fit, never run over. */
export const INTERACTION_SWEEP_BUDGET_MS = 90_000;

/**
 * Normalize a captured URL to its source slug: domain + significant path, kebab-cased
 * (SPEC §7.1 — `linear-app` for https://linear.app, `stripe-com-pricing` for /pricing).
 */
export function sourceSlugFromUrl(rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return (
      rawUrl
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80) || "capture"
    );
  }
  const host = parsed.hostname.replace(/^www\./, "");
  const path = parsed.pathname.replace(/\/+$/, "");
  const joined = path ? `${host}${path}` : host;
  return (
    joined
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "capture"
  );
}
