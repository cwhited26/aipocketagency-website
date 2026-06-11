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
// Tier assignment (PA-TG-2 + the SPEC's count ladder) is positional over UNLOCK_ORDER below:
// the first 3 directions are the Starter foundation set, the next 3 unlock at Pro, the next 4 at
// Pro+, and the rest at Studio. A direction file that isn't listed in UNLOCK_ORDER fails the run —
// adding a direction to the library forces an explicit unlock-ladder decision here.

import { mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "src", "data", "landing-page-templates");
const MD_OUT_DIR = join(OUT_DIR, "directions");

const SOURCE_DIR =
  process.argv[2] ??
  process.env.BRAIN_DIRECTIONS_DIR ??
  join(ROOT, "..", "..", "whited-brain", "BOS", "Sites", "prompt_library", "directions");

/**
 * The unlock ladder, in order (PA-TG-6): conversion-first directions for owner-led service
 * businesses come first, broad-SMB looks next, niche/tech next, and the cinematic-luxury,
 * high-complexity directions sit at Studio. Positions 1-3 → starter, 4-6 → pro, 7-10 → pro_plus,
 * 11+ → studio.
 */
const UNLOCK_ORDER = [
  "trades-phone-first-emergency",
  "contractor-photo-first-trust",
  "bookedup-deep-shadow-saas",
  "medspa-booking-calendar-first",
  "real-estate-listing-grid-search",
  "modern-agency-mental-wellness",
  "cognitra-ai-agency-gray-panel",
  "glassmorphism-purple-pink-agency",
  "targo-logistics-dark-red-clipped",
  "codenest-coding-education-dev-platform",
  "vanguard-fierce-creative-collective",
  "prisma-cinematic-cream-collective",
  "jack-3d-creator-portfolio",
  "mainframe-mouse-scrub-agency",
  "lithos-geology-editorial",
  "spd-luxury-automation-cinematic",
  "cinematic-space-travel-aerospace",
  "velar-luxury-real-estate",
  "yacht-club-liquid-cursor-luxury",
  "cyberpunk-red-augmented-self",
];

function tierForPosition(index) {
  if (index < 3) return "starter";
  if (index < 6) return "pro";
  if (index < 10) return "pro_plus";
  return "studio";
}

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

function parseDirection(file, raw, unlockIndex) {
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
    tierRequired: tierForPosition(unlockIndex),
    // Phase 1 ships without captured screenshots (PA-TG-3 capture pipeline is Phase 2) — the gallery
    // renders a styled placeholder from the palette + typography until these paths are non-null.
    visualPreview: { static: null, animated: null },
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

const missingFromOrder = sourceFiles.map((f) => f.replace(/\.md$/, "")).filter((s) => !UNLOCK_ORDER.includes(s));
const missingFromSource = UNLOCK_ORDER.filter((s) => !bySlug.has(s));
if (missingFromOrder.length > 0) {
  console.error(`Directions not in UNLOCK_ORDER (add them with an explicit tier position): ${missingFromOrder.join(", ")}`);
  process.exit(1);
}
if (missingFromSource.length > 0) {
  console.error(`UNLOCK_ORDER lists directions missing from the library: ${missingFromSource.join(", ")}`);
  process.exit(1);
}

rmSync(MD_OUT_DIR, { recursive: true, force: true });
mkdirSync(MD_OUT_DIR, { recursive: true });

const directions = [];
for (const [index, slug] of UNLOCK_ORDER.entries()) {
  const file = bySlug.get(slug);
  const raw = readFileSync(join(SOURCE_DIR, file), "utf8");
  directions.push(parseDirection(file, raw, index));
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

export type DirectionTier = "starter" | "pro" | "pro_plus" | "studio";
export type DirectionUseCase = "hero" | "full-landing" | "about" | "contact";
export type DirectionComplexity = "low" | "medium" | "high";

export type Direction = {
  slug: string;
  /** The direction's display name ("Velar. — Luxury Real Estate"). */
  name: string;
  vibe: string[];
  industries: string[];
  useCases: DirectionUseCase[];
  /** The lowest tier that can build with this direction (PA-TG-2). */
  tierRequired: DirectionTier;
  /** Captured previews land in Phase 2 (PA-TG-3); null renders the styled placeholder card. */
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
console.log(`Generated ${directions.length} directions → ${join(OUT_DIR, "directions.ts")}`);
console.log(`Tier ladder: ${[...counts.entries()].map(([t, n]) => `${t}=${n}`).join(" / ")}`);
