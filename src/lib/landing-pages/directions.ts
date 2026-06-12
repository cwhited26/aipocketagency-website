// directions.ts — the Template Gallery's runtime layer over the generated direction catalog
// (PA-TG-1..2 + PA-TG-7). A gallery direction rides the SAME build pipeline as the three starter
// templates: `directionToTemplate` synthesizes a LandingTemplate from a Direction (sections + copy
// prompts + a palette-and-typography-tinted component skeleton + the direction's full design spec as
// the code-gen brief), and `resolveLandingTemplate` is the single resolver the routes and the build
// orchestrator use for both template kinds. Pure data + synthesis, no I/O.

import { DIRECTIONS, type Direction, type DirectionTier } from "@/data/landing-page-templates/directions";
import { tierRank, type Tier } from "@/lib/personas/tier-caps";
import { getTemplate } from "./templates";
import type { LandingTemplate } from "./types";

/** A direction-backed template ref as persisted in pa_landing_pages.template: "direction:<slug>". */
export const DIRECTION_REF_PREFIX = "direction:";

export function isDirectionRef(ref: string): boolean {
  return ref.startsWith(DIRECTION_REF_PREFIX);
}

export function directionRef(slug: string): string {
  return `${DIRECTION_REF_PREFIX}${slug}`;
}

const BY_SLUG = new Map<string, Direction>(DIRECTIONS.map((d) => [d.slug, d]));

/** All directions in unlock-ladder order (the gallery's display order). */
export function listDirections(): readonly Direction[] {
  return DIRECTIONS;
}

export function getDirection(slug: string): Direction | null {
  return BY_SLUG.get(slug) ?? null;
}

/** Per-direction tier gate (PA-TG-2): can this tier build with this direction? */
export function tierAllowsDirection(tier: Tier, direction: Direction): boolean {
  return tierRank(tier) >= tierRank(direction.tierRequired as Tier);
}

/** The owner-facing name of the tier a locked direction needs (for the upgrade chip). */
export function directionTierLabel(tier: DirectionTier): string {
  switch (tier) {
    case "starter":
      return "Starter";
    case "pro":
      return "Pro";
    case "pro_plus":
      return "Pro+";
    case "studio":
      return "Studio";
    case "studio_plus":
      return "Studio+";
  }
}

// ── Palette roles (deterministic, contrast-guarded) ───────────────────────────────────────────────

type Rgb = { r: number; g: number; b: number };

function hexToRgb(hex: string): Rgb | null {
  const h = hex.replace("#", "");
  const full =
    h.length === 3 ? h.split("").map((c) => c + c).join("") : h.length >= 6 ? h.slice(0, 6) : null;
  if (!full || !/^[0-9a-f]{6}$/i.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function luminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0.5;
  return (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
}

function saturation(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const max = Math.max(rgb.r, rgb.g, rgb.b);
  const min = Math.min(rgb.r, rgb.g, rgb.b);
  return max === 0 ? 0 : (max - min) / max;
}

export type PaletteRoles = {
  /** The page background — the direction file lists its background color first. */
  background: string;
  /** Text + dark-band color: the palette color with the most contrast against the background. */
  ink: string;
  /** The CTA / highlight color: the most saturated palette color that isn't background or ink. */
  accent: string;
};

/**
 * Map a direction's ordered palette onto the three roles the component skeleton needs. The library
 * convention puts the background color first; ink is whichever palette color contrasts most with it
 * (falling back to black/white when the palette runs flat), and accent is the most saturated of the
 * rest so a signature red or cyan survives into the deterministic build.
 */
export function paletteRoles(direction: Direction): PaletteRoles {
  const palette = direction.colorPalette.filter((c) => hexToRgb(c) !== null);
  const background = palette[0] ?? "#ffffff";
  const bgLum = luminance(background);

  let ink = "";
  let inkContrast = 0;
  for (const c of palette.slice(1)) {
    const contrast = Math.abs(luminance(c) - bgLum);
    if (contrast > inkContrast) {
      ink = c;
      inkContrast = contrast;
    }
  }
  if (!ink || inkContrast < 0.4) ink = bgLum > 0.5 ? "#111111" : "#f8f8f6";

  let accent = "";
  let accentSat = -1;
  for (const c of palette) {
    if (c === background || c === ink) continue;
    const sat = saturation(c);
    if (sat > accentSat) {
      accent = c;
      accentSat = sat;
    }
  }
  if (!accent || Math.abs(luminance(accent) - bgLum) < 0.15) accent = ink;

  return { background, ink, accent };
}

// ── Typography (Google-Fonts-loadable families, honest fallbacks) ─────────────────────────────────

/** The Google Fonts families the direction library actually names (checked against fonts.google.com). */
const GOOGLE_FAMILIES = [
  "Playfair Display",
  "Instrument Serif",
  "JetBrains Mono",
  "Plus Jakarta Sans",
  "DM Sans",
  "Manrope",
  "Almarai",
  "Italiana",
  "Barlow",
  "Outfit",
  "Kanit",
  "Rubik",
  "Syne",
  "Sora",
  "Inter",
] as const;

/** Resolve a parsed font phrase to a loadable Google family, or null ("a sturdy, legible sans"). */
export function loadableFamily(value: string): string | null {
  const lower = value.toLowerCase();
  for (const family of GOOGLE_FAMILIES) {
    if (lower.startsWith(family.toLowerCase())) return family;
  }
  return null;
}

function fontStack(value: string): string {
  const family = loadableFamily(value);
  const generic = /serif/i.test(value) && !/sans/i.test(value) ? "Georgia, serif" : "system-ui, -apple-system, sans-serif";
  return family ? `'${family}', ${generic}` : generic;
}

function googleFontsHref(direction: Direction): string | null {
  const families = [
    loadableFamily(direction.typography.display),
    loadableFamily(direction.typography.body),
  ].filter((f): f is string => f !== null);
  const unique = [...new Set(families)];
  if (unique.length === 0) return null;
  const params = unique
    .map((f) => `family=${f.replace(/ /g, "+")}:wght@400;500;700;800`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${params}&display=swap`;
}

// ── Direction → LandingTemplate synthesis (PA-TG-7) ───────────────────────────────────────────────

/**
 * The deterministic component skeleton for a direction: the proven single-CTA section flow tinted
 * with the direction's palette and typography, so even the no-model fallback ships a page that
 * carries the direction's look. The full design spec rides separately as the template's designBrief,
 * which the code-gen model uses to push the page much closer to the direction.
 */
export function directionComponentTemplate(direction: Direction): string {
  const roles = paletteRoles(direction);
  const bg = JSON.stringify(roles.background);
  const ink = JSON.stringify(roles.ink);
  const accent = JSON.stringify(roles.accent);
  const accentText = JSON.stringify(luminance(roles.accent) > 0.5 ? "#101010" : "#ffffff");
  const inkText = JSON.stringify(luminance(roles.ink) > 0.5 ? "#101010" : "#f8f8f6");
  const displayFont = JSON.stringify(fontStack(direction.typography.display));
  const bodyFont = JSON.stringify(fontStack(direction.typography.body));
  const fontsHref = googleFontsHref(direction);
  const fontLink = fontsHref
    ? `      <link rel="stylesheet" href=${JSON.stringify(fontsHref)} />\n`
    : "";

  return `// app/page.tsx — generated by Pocket Agent, Landing Page Builder (direction: ${direction.slug}).
// This is your code; edit it freely.
type Copy = Record<string, string>;

const copy: Copy = {{COPY_JSON}};

const colors = { bg: ${bg}, ink: ${ink}, accent: ${accent}, accentText: ${accentText}, inkText: ${inkText} };
const fonts = { display: ${displayFont}, body: ${bodyFont} };

function lines(text: string): string[] {
  return (text || "").split("\\n").map((l) => l.trim()).filter(Boolean);
}

function Heading({ text }: { text: string }) {
  return <h2 style={{ fontFamily: fonts.display, fontSize: 34, fontWeight: 700, margin: "0 0 14px", color: colors.ink, letterSpacing: "-0.02em" }}>{text}</h2>;
}

function Body({ text, color }: { text: string; color: string }) {
  return (
    <>
      {lines(text).map((line, i) => (
        <p key={i} style={{ margin: "10px 0", color, lineHeight: 1.7, fontSize: 17 }}>
          {line.replace(/^- /, "\\u2022 ")}
        </p>
      ))}
    </>
  );
}

export default function Page() {
  const heroLines = lines(copy.hero);
  const headline = heroLines[0] || "Your offer, made clear";
  const subhead = heroLines.slice(1).join(" ");
  const mech = lines(copy.mechanism);
  const mechHead = mech[0] || "How it works";
  const steps = mech.slice(1).filter((l) => l.startsWith("- ")).map((l) => l.slice(2));
  const cta = lines(copy.cta);
  return (
    <main style={{ fontFamily: fonts.body, background: colors.bg, color: colors.ink, margin: 0 }}>
${fontLink}      <section style={{ minHeight: "78vh", display: "grid", alignItems: "center", padding: "96px 24px" }}>
        <div style={{ maxWidth: 880, margin: "0 auto", width: "100%" }}>
          <h1 style={{ fontFamily: fonts.display, fontSize: "clamp(40px, 7vw, 76px)", fontWeight: 800, margin: "0 0 20px", letterSpacing: "-0.03em", lineHeight: 1.02, color: colors.ink }}>{headline}</h1>
          <p style={{ fontSize: 20, lineHeight: 1.6, margin: "0 0 32px", maxWidth: 640, opacity: 0.85 }}>{subhead}</p>
          <a href="#start" style={{ display: "inline-block", background: colors.accent, color: colors.accentText, fontWeight: 800, fontSize: 17, padding: "16px 32px", borderRadius: 10, textDecoration: "none" }}>{cta[0] || "Get started"}</a>
        </div>
      </section>
      <section style={{ background: colors.ink, color: colors.inkText, padding: "84px 24px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <h2 style={{ fontFamily: fonts.display, fontSize: 34, fontWeight: 700, margin: "0 0 14px", letterSpacing: "-0.02em", color: colors.inkText }}>{lines(copy.problem)[0] || "The problem"}</h2>
          <Body text={lines(copy.problem).slice(1).join("\\n")} color={colors.inkText} />
        </div>
      </section>
      <section style={{ padding: "84px 24px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <Heading text={mechHead} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 20, marginTop: 24 }}>
            {steps.map((step, i) => (
              <div key={i} style={{ border: "1px solid " + colors.ink + "22", borderRadius: 14, padding: 24 }}>
                <div style={{ width: 34, height: 34, borderRadius: 999, background: colors.accent, color: colors.accentText, display: "grid", placeItems: "center", fontWeight: 800, marginBottom: 12 }}>{i + 1}</div>
                <p style={{ margin: 0, lineHeight: 1.6, fontSize: 16, opacity: 0.9 }}>{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section id="start" style={{ background: colors.ink, color: colors.inkText, padding: "96px 24px", textAlign: "center" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <h2 style={{ fontFamily: fonts.display, fontSize: 36, fontWeight: 700, margin: "0 0 14px", letterSpacing: "-0.02em", color: colors.inkText }}>{cta[0] || "Ready to start?"}</h2>
          <Body text={cta.slice(1).join("\\n")} color={colors.inkText} />
          <a href="mailto:" style={{ display: "inline-block", marginTop: 22, background: colors.accent, color: colors.accentText, fontWeight: 800, fontSize: 17, padding: "16px 36px", borderRadius: 10, textDecoration: "none" }}>{cta[0] || "Get started"}</a>
        </div>
      </section>
    </main>
  );
}
`;
}

/**
 * Synthesize the LandingTemplate a direction builds with. Same four conversion sections as the
 * single-CTA starter (the copy model + assembler already know this shape); the direction's identity
 * rides in the tinted skeleton and in designBrief — the full design spec from the brain — which the
 * code generator follows as far as a single self-contained page allows.
 */
export function directionToTemplate(direction: Direction): LandingTemplate {
  const vibeLine = direction.vibe.slice(0, 4).join(", ");
  return {
    id: directionRef(direction.slug),
    label: direction.name,
    description: `A ${vibeLine} landing page direction.`,
    bestFor: `Built for ${direction.industries.slice(0, 3).join(", ")}.`,
    sections: [
      { key: "hero", kind: "hero", label: "Hero", purpose: "The headline promise and a one-line subhead that names the offer." },
      { key: "problem", kind: "problem", label: "The problem", purpose: "The pain the visitor feels right now, named plainly so they feel understood." },
      { key: "mechanism", kind: "mechanism", label: "How it works", purpose: "Three simple steps that show how the work gets done." },
      { key: "cta", kind: "cta", label: "Call to action", purpose: "A short, confident close that asks for the one next step." },
    ],
    defaultCopyPrompts: {
      hero:
        "Write the hero. Line 1 is the headline — a specific promise the business can keep, no hype, under 10 words. " +
        `Lines after it are a one-sentence subhead that names what's offered and who it's for. The page's design vibe is ${vibeLine} — write copy that carries that tone.`,
      problem:
        "Write the problem section. Line 1 is a short headline. The body names the pain the visitor feels today — " +
        "concrete, in their words, no fear-mongering. 2-3 short lines.",
      mechanism:
        "Write the 'how it works' section. Line 1 is a short headline. Then exactly three lines, each starting with " +
        "'- ', one per step — plain, active, what the business actually does. No jargon.",
      cta:
        "Write the closing call to action. Line 1 is a short headline that asks for the next step (it doubles as the button text — keep it under 5 words). " +
        "The body is one or two lines that make it easy to say yes. Confident, not pushy.",
    },
    componentTemplate: directionComponentTemplate(direction),
    designBrief: `DIRECTION: ${direction.name}\n\n${direction.promptText}`,
  };
}

/**
 * Resolve any persisted template ref — a starter template id ("single-cta") or a direction ref
 * ("direction:velar-luxury-real-estate") — to the LandingTemplate the pipeline builds with.
 */
export function resolveLandingTemplate(ref: string): LandingTemplate | null {
  if (isDirectionRef(ref)) {
    const direction = getDirection(ref.slice(DIRECTION_REF_PREFIX.length));
    return direction ? directionToTemplate(direction) : null;
  }
  return getTemplate(ref);
}
