// gen-landing-page-directions.mjs — [2026-06-11] Claude Code
//
// Build-time sync for the Template Gallery (PA-TG-1): the design-direction library in the brain at
// BOS/Sites/prompt_library/directions/ is the single source of truth; PA reads it, never authors it.
// Run this script to (re)generate two committed outputs from the library:
//   1. src/data/landing-page-templates/directions/<slug>.md — a byte-for-byte copy of each source
//      direction file. These committed snapshots are what the drift-guard test compares against
//      (the same pattern as the Starter Skills pack — see scripts/gen-starter-skills.mjs).
//   2. src/data/landing-page-templates/directions.ts — the typed Direction[] catalog the app imports
//      (bundler-safe, no runtime fs). The gallery surface, the per-direction tier gate, and the
//      direction→template synthesis all read this. Generated → never hand-edit; edit the brain's
//      direction .md files and re-run:
//
//        node scripts/gen-landing-page-directions.mjs [path-to-directions-dir]
//
// The source dir defaults to ../../whited-brain/BOS/Sites/prompt_library/directions relative to the
// repo (override with the first CLI arg or BRAIN_DIRECTIONS_DIR).
//
// Tier assignment (PA-TG-11, superseding the PA-TG-6 positional ladder) is explicit per direction
// in TIER_LADDER below, keyed to the direction's motionsites.ai source availability per
// BOS/Sites/prompt_library/motionsites-ai-inventory.md: a direction whose source prompt was free
// ("Copy") on motionsites — or that Chase wrote himself — sits at starter, the lowest paid tier;
// a direction extracted from a motionsites Premium prompt sits at studio_plus. Every tier still
// sees every card (preview, palette, typography, when-to-use); the tier only gates the build CTA.
//
// PA-TG-12 (the full-archive expansion): the library is now ~7x the curated set, so directions
// added after the original 21 carry their tier in frontmatter (`tier_required:`) — set by the same
// free→starter / Premium→studio_plus rule at authoring time. The explicit-decision invariant
// holds either way: a direction with neither a TIER_LADDER entry nor a tier_required line fails
// the run. Display order: the curated TIER_LADDER set leads, then the expansion set, starter
// before studio_plus, alphabetical within a tier.

import { mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "src", "data", "landing-page-templates");
const MD_OUT_DIR = join(OUT_DIR, "directions");
// Captured previews (PA-TG-3, SPEC Phase 2) live in public/templates/<slug>.{png,mp4} — the
// bos-template-mocks capture pipeline produces them. Presence on disk is what flips a direction
// from the styled placeholder card to a real preview, so re-running this script after dropping a
// new capture is the whole wiring step.
const PREVIEW_DIR = join(ROOT, "public", "templates");

const SOURCE_DIR =
  process.argv[2] ??
  process.env.BRAIN_DIRECTIONS_DIR ??
  join(ROOT, "..", "..", "whited-brain", "BOS", "Sites", "prompt_library", "directions");

/**
 * The tier ladder (PA-TG-11), in gallery display order. Each entry's tier comes from the
 * direction's motionsites.ai availability recorded in motionsites-ai-inventory.md (the catalog
 * title each direction was extracted under is in its comment): free-on-motionsites ("Copy") and
 * Chase-original directions → starter; motionsites-Premium extractions → studio_plus. The five
 * conversion-first originals lead, then the free extractions, then the Premium set.
 */
const TIER_LADDER = [
  // Chase-original, conversion-first (not from motionsites) → starter.
  { slug: "trades-phone-first-emergency", tier: "starter" },
  { slug: "contractor-photo-first-trust", tier: "starter" },
  { slug: "medspa-booking-calendar-first", tier: "starter" },
  { slug: "real-estate-listing-grid-search", tier: "starter" },
  // Chase-written from observing the live "Solar Energy Hero" preview (no prompt text extracted) —
  // grouped with the originals at starter on Chase's call. Ships placeholder-only until its mock +
  // capture land.
  { slug: "solar-energy-day-night-toggle", tier: "starter" },
  // Free ("Copy") on motionsites.ai → starter.
  { slug: "vanguard-fierce-creative-collective", tier: "starter" }, // Bold Studio
  { slug: "prisma-cinematic-cream-collective", tier: "starter" }, // Prisma Creative Studio
  { slug: "jack-3d-creator-portfolio", tier: "starter" }, // 3D Portfolio
  { slug: "lithos-geology-editorial", tier: "starter" }, // Interactive Discovery
  { slug: "velar-luxury-real-estate", tier: "starter" }, // Velorah
  { slug: "modern-agency-mental-wellness", tier: "starter" }, // Modern Agency
  // Premium on motionsites.ai → studio_plus.
  { slug: "bookedup-deep-shadow-saas", tier: "studio_plus" }, // BookedUp
  { slug: "cognitra-ai-agency-gray-panel", tier: "studio_plus" }, // Reveal Hero
  { slug: "glassmorphism-purple-pink-agency", tier: "studio_plus" }, // Glassmorphism Agency Hero
  { slug: "targo-logistics-dark-red-clipped", tier: "studio_plus" }, // Targo Logistics Hero
  { slug: "codenest-coding-education-dev-platform", tier: "studio_plus" }, // Luxury Botanical
  { slug: "mainframe-mouse-scrub-agency", tier: "studio_plus" }, // Liquid Glass Agency
  { slug: "spd-luxury-automation-cinematic", tier: "studio_plus" }, // Luxury Real Estate
  { slug: "cinematic-space-travel-aerospace", tier: "studio_plus" }, // Cinematic Brand
  { slug: "yacht-club-liquid-cursor-luxury", tier: "studio_plus" }, // Yacht Club
  { slug: "cyberpunk-red-augmented-self", tier: "studio_plus" }, // Cyberpunk Reveal
];

// ── Parsing ───────────────────────────────────────────────────────────────────────────────────────

/** Split a direction file into { frontmatter: Record, body: string }. First key wins on duplicates. */
function parseFrontmatter(raw, file) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) throw new Error(`${file}: no frontmatter fence`);
  const fm = {};
  for (const line of m[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key && !(key in fm)) fm[key] = value;
  }
  return { frontmatter: fm, body: raw.slice(m[0].length).trim() };
}

/** Markdown body → Map of "## Heading" section name → section text. */
function splitSections(body) {
  const sections = new Map();
  const parts = body.split(/^## /m);
  for (const part of parts.slice(1)) {
    const nl = part.indexOf("\n");
    if (nl < 0) continue;
    sections.set(part.slice(0, nl).trim(), part.slice(nl + 1).trim());
  }
  return sections;
}

function bulletLines(sectionText) {
  if (!sectionText) return [];
  return sectionText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- "))
    .map((l) => l.slice(2).trim())
    .filter(Boolean);
}

function commaList(value) {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** "Display: Syne (Google Fonts, …) — used for…" → "Syne". Keeps honest phrases like "a sturdy, legible sans". */
function cleanFontValue(value) {
  let v = value.split(/\s+\(|\s+—/)[0].trim();
  v = v.replace(/`/g, "").replace(/[.,;:]+$/, "").trim();
  if (/\bor\b/.test(v)) v = v.split(/\s+or\s+/)[0].trim();
  return v.slice(0, 40);
}

/** Parse the Typography section into { display, body } short names for the preview line. */
function parseTypography(sectionText, file) {
  const bullets = bulletLines(sectionText);
  let display = "";
  let body = "";
  let displayCoversBody = false;
  for (const b of bullets) {
    const dm = b.match(/^(Display(?: \+ body)?(?: \d)?|Primary face):\s*(.+)$/i);
    if (dm && !display) {
      display = cleanFontValue(dm[2]);
      displayCoversBody = /\+ body/i.test(dm[1]);
      continue;
    }
    const bm = b.match(/^(Body(?: \+ [a-z]+(?: line \d)?)*|Secondary):\s*(.+)$/i);
    if (bm && !body) body = cleanFontValue(bm[2]);
  }
  if (!display) throw new Error(`${file}: no Display/Primary face line in ## Typography`);
  if (displayCoversBody || !body) body = display;
  return { display, body };
}

/**
 * Hex colors from the Color palette section, in order of appearance, deduped, capped at 6. A
 * direction written in named colors (Mainframe is "white pills / black text") falls back to the
 * white/black words so every direction carries at least two swatches.
 */
function parsePalette(sectionText, file) {
  const hexes = [];
  for (const m of (sectionText ?? "").matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
    const hex = m[0].toLowerCase();
    if (!hexes.includes(hex)) hexes.push(hex);
    if (hexes.length === 6) break;
  }
  if (hexes.length < 6 && /\bwhite\b/i.test(sectionText ?? "") && !hexes.includes("#ffffff") && !hexes.includes("#fff")) {
    hexes.push("#ffffff");
  }
  if (hexes.length < 6 && /\bblack\b/i.test(sectionText ?? "") && !hexes.includes("#000000") && !hexes.includes("#000")) {
    hexes.push("#000000");
  }
  if (hexes.length < 2) throw new Error(`${file}: fewer than 2 colors in ## Color palette`);
  return hexes;
}

/** A motif bullet → its plain-English name: the bold segment when present, else the text before the detail dash. */
function motifName(bullet) {
  const bold = bullet.match(/\*\*([^*]+)\*\*/);
  const name = (bold ? bold[1] : bullet.split(" — ")[0]).replace(/\*/g, "").trim();
  return name.replace(/[.,;:]+$/, "").slice(0, 90);
}

/** LOW/MEDIUM/HIGH from the Build complexity section; a "warning" section means high; absent means medium. */
function parseComplexity(sections) {
  const text = sections.get("Build complexity");
  if (text) {
    const m = text.match(/\b(LOW|MEDIUM|HIGH)\b/i);
    if (m) return m[1].toLowerCase();
  }
  if (sections.has("Build complexity warning")) return "high";
  return text ? "medium" : "medium";
}

function parseDirection(file, raw, tier) {
  const { frontmatter: fm, body } = parseFrontmatter(raw, file);
  const slug = fm.slug;
  if (!slug || `${slug}.md` !== file) throw new Error(`${file}: frontmatter slug "${slug}" doesn't match the filename`);
  if (!fm.name) throw new Error(`${file}: missing name`);

  const sections = splitSections(body);
  for (const required of ["Hero treatment", "Page layout", "Typography", "Color palette", "Visual motifs", "When to use", "When to NOT use"]) {
    if (!sections.has(required)) throw new Error(`${file}: missing ## ${required}`);
  }

  const whenToUse = bulletLines(sections.get("When to use"));
  const whenNotToUse = bulletLines(sections.get("When to NOT use"));
  const motifs = bulletLines(sections.get("Visual motifs")).map(motifName).filter(Boolean);
  if (whenToUse.length === 0) throw new Error(`${file}: empty ## When to use`);
  if (whenNotToUse.length === 0) throw new Error(`${file}: empty ## When to NOT use`);
  if (motifs.length === 0) throw new Error(`${file}: empty ## Visual motifs`);

  return {
    slug,
    name: fm.name,
    vibe: commaList(fm.vibe),
    industries: commaList(fm.industries),
    // Every library direction defines a hero treatment + a full page layout; about/contact-only
    // directions don't exist in the library yet, so the derivation is deterministic from sections.
    useCases: ["hero", "full-landing"],
    tierRequired: tier,
    // A direction whose capture exists in public/templates/ gets the real preview paths; the rest
    // keep null and the gallery renders the styled placeholder with its "Real preview coming" chip.
    visualPreview: {
      static: existsSync(join(PREVIEW_DIR, `${slug}.png`)) ? `/templates/${slug}.png` : null,
      animated: existsSync(join(PREVIEW_DIR, `${slug}.mp4`)) ? `/templates/${slug}.mp4` : null,
    },
    typography: parseTypography(sections.get("Typography"), file),
    colorPalette: parsePalette(sections.get("Color palette"), file),
    motifs,
    whenToUse,
    whenNotToUse,
    buildComplexity: parseComplexity(sections),
    source: fm.source ?? "",
    featured: fm.featured === "true",
    newUntil: fm.new_until ?? null,
    promptText: body,
  };
}

// ── Generate ──────────────────────────────────────────────────────────────────────────────────────

if (!existsSync(SOURCE_DIR)) {
  console.error(`Directions source dir not found: ${SOURCE_DIR}`);
  console.error("Pass it as the first argument or set BRAIN_DIRECTIONS_DIR.");
  process.exit(1);
}

const sourceFiles = readdirSync(SOURCE_DIR).filter((f) => f.endsWith(".md")).sort();
const bySlug = new Map(sourceFiles.map((f) => [f.replace(/\.md$/, ""), f]));

const VALID_TIERS = ["starter", "pro", "pro_plus", "studio", "studio_plus"];

const ladderSlugs = TIER_LADDER.map((e) => e.slug);
const missingFromSource = ladderSlugs.filter((s) => !bySlug.has(s));
if (missingFromSource.length > 0) {
  console.error(`TIER_LADDER lists directions missing from the library: ${missingFromSource.join(", ")}`);
  process.exit(1);
}

// The expansion set (PA-TG-12): every direction outside TIER_LADDER must declare its own tier in
// frontmatter. Read + validate the tier here; full parsing happens in the ordered pass below.
const expansion = [];
for (const file of sourceFiles) {
  const slug = file.replace(/\.md$/, "");
  if (ladderSlugs.includes(slug)) continue;
  const raw = readFileSync(join(SOURCE_DIR, file), "utf8");
  const { frontmatter } = parseFrontmatter(raw, file);
  const tier = frontmatter.tier_required;
  if (!tier) {
    console.error(`${file}: not in TIER_LADDER and no tier_required frontmatter — every direction needs an explicit tier decision`);
    process.exit(1);
  }
  if (!VALID_TIERS.includes(tier)) {
    console.error(`${file}: tier_required "${tier}" is not one of ${VALID_TIERS.join("/")}`);
    process.exit(1);
  }
  expansion.push({ slug, tier });
}
expansion.sort((a, b) =>
  a.tier === b.tier ? a.slug.localeCompare(b.slug) : VALID_TIERS.indexOf(a.tier) - VALID_TIERS.indexOf(b.tier),
);

rmSync(MD_OUT_DIR, { recursive: true, force: true });
mkdirSync(MD_OUT_DIR, { recursive: true });

const directions = [];
for (const { slug, tier } of [...TIER_LADDER, ...expansion]) {
  const file = bySlug.get(slug);
  const raw = readFileSync(join(SOURCE_DIR, file), "utf8");
  directions.push(parseDirection(file, raw, tier));
  writeFileSync(join(MD_OUT_DIR, file), raw);
}

const header = `// directions.ts — GENERATED by scripts/gen-landing-page-directions.mjs. Do not edit by hand.
// Source of truth: the design-direction library in the brain (BOS/Sites/prompt_library/directions/);
// the committed .md snapshots next to this file ride along for the drift-guard test. To change a
// direction, edit the brain file and re-run \`node scripts/gen-landing-page-directions.mjs\`.
//
// The Template Gallery catalog (PA-TG-1..2): ${directions.length} visually distinct landing page directions, each
// with per-direction tier gating, the palette + typography that drive the gallery preview, and the
// full design prompt the build lane feeds into code generation.

export type DirectionTier = "starter" | "pro" | "pro_plus" | "studio" | "studio_plus";
export type DirectionUseCase = "hero" | "full-landing" | "about" | "contact";
export type DirectionComplexity = "low" | "medium" | "high";

export type Direction = {
  slug: string;
  /** The direction's display name ("Velar. — Luxury Real Estate"). */
  name: string;
  vibe: string[];
  industries: string[];
  useCases: DirectionUseCase[];
  /**
   * The lowest tier that can build with this direction (PA-TG-2 + PA-TG-11): starter for
   * free-on-motionsites and Chase-original directions, studio_plus for motionsites-Premium
   * extractions. Every tier browses every card; this only gates the build CTA.
   */
  tierRequired: DirectionTier;
  /**
   * Captured preview paths under public/ (PA-TG-3): static is the 1440×900 still, animated the
   * 4s muted MP4 (Studio+ unlock). null renders the styled placeholder card.
   */
  visualPreview: { static: string | null; animated: string | null };
  typography: { display: string; body: string };
  /** Hex colors in the order the direction file lists them. */
  colorPalette: string[];
  /** The direction's signature interaction patterns, in plain English. */
  motifs: string[];
  whenToUse: string[];
  whenNotToUse: string[];
  buildComplexity: DirectionComplexity;
  /** Attribution from the direction file's frontmatter. */
  source: string;
  featured: boolean;
  newUntil: string | null;
  /** The full direction body (the design spec the build lane uses), verbatim from the brain. */
  promptText: string;
};

export const DIRECTIONS: readonly Direction[] = `;

writeFileSync(join(OUT_DIR, "directions.ts"), header + JSON.stringify(directions, null, 2) + ";\n");

const counts = directions.reduce((acc, d) => acc.set(d.tierRequired, (acc.get(d.tierRequired) ?? 0) + 1), new Map());

// directions-meta.ts — just the catalog counts, for the marketing surfaces ("Powered by N distinct
// templates") that need the number without importing the full multi-megabyte catalog.
const meta = `// directions-meta.ts — GENERATED by scripts/gen-landing-page-directions.mjs. Do not edit by hand.
// The catalog counts for surfaces that show the number without needing the catalog itself.

export const DIRECTION_COUNTS = {
  total: ${directions.length},
  starter: ${counts.get("starter") ?? 0},
  studioPlus: ${counts.get("studio_plus") ?? 0},
} as const;
`;
writeFileSync(join(OUT_DIR, "directions-meta.ts"), meta);

console.log(`Generated ${directions.length} directions → ${join(OUT_DIR, "directions.ts")}`);
console.log(`Tier ladder: ${[...counts.entries()].map(([t, n]) => `${t}=${n}`).join(" / ")}`);
