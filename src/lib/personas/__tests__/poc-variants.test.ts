// poc-variants.test.ts — the Poc art file contract (PA-POS-33): every variant declared in
// POC_ART_SHIPPED has a real 512×512 PNG at public/avatars/poc/poc-<variant>.png, every file
// on disk maps back to a declared variant, and every persona template + vertical resolves to
// a variant whose art (or SVG fallback) exists. This is the drift guard that keeps a renamed
// PNG or a new variant from shipping a broken image — including the day Chase drops the
// illustrated Firefly art over the placeholders.

import { describe, expect, it } from "vitest";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  POC_ART_SHIPPED,
  POC_VARIANTS,
  pocArtSrc,
  resolvePocArt,
  resolvePocVariant,
} from "../poc-variants";
import { TEMPLATES } from "@/lib/personas/templates";
import { VERTICALS } from "@/lib/onboarding/verticals";

const POC_DIR = join(process.cwd(), "public", "avatars", "poc");
const SVG_DIR = join(process.cwd(), "public", "avatars", "personas");

describe("the Poc art files", () => {
  it("every declared variant is pinned to a PNG on disk", () => {
    for (const variant of POC_VARIANTS) {
      const path = join(POC_DIR, `poc-${variant}.png`);
      expect(existsSync(path), `missing art for Poc variant "${variant}"`).toBe(true);
    }
  });

  it("exactly the declared variants have PNGs on disk — no orphan art", () => {
    const files = readdirSync(POC_DIR)
      .filter((f) => f.endsWith(".png"))
      .map((f) => f.replace(/^poc-/, "").replace(/\.png$/, ""))
      .sort();
    expect(files).toEqual([...POC_VARIANTS].sort());
  });

  it("POC_ART_SHIPPED matches the files on disk", () => {
    for (const variant of POC_VARIANTS) {
      const onDisk = existsSync(join(POC_DIR, `poc-${variant}.png`));
      expect(POC_ART_SHIPPED.has(variant), `POC_ART_SHIPPED disagrees with disk for "${variant}"`).toBe(onDisk);
    }
  });

  it("pocArtSrc renders the public path", () => {
    expect(pocArtSrc("glasses")).toBe("/avatars/poc/poc-glasses.png");
  });
});

describe("resolvePocVariant", () => {
  it("maps the seven role slugs to their signature props (§23.1)", () => {
    expect(resolvePocVariant("admin")).toBe("clipboard");
    expect(resolvePocVariant("sales")).toBe("headset");
    expect(resolvePocVariant("followup")).toBe("coffee");
    expect(resolvePocVariant("content")).toBe("spatula");
    expect(resolvePocVariant("email")).toBe("default");
    expect(resolvePocVariant("lead-research")).toBe("glasses");
    expect(resolvePocVariant("ops-cos")).toBe("compass");
  });

  it("maps the legacy template keys onto the same props as their avatarSlugs", () => {
    expect(resolvePocVariant("vsm")).toBe("headset");
    expect(resolvePocVariant("vcsa")).toBe("clipboard");
    expect(resolvePocVariant("vom")).toBe("compass");
    expect(resolvePocVariant("vr")).toBe("clipboard");
    expect(resolvePocVariant("vmd")).toBe("spatula");
  });

  it("maps every vertical and any unknown slug to the default Poc", () => {
    for (const v of VERTICALS) expect(resolvePocVariant(v.avatarSlug)).toBe("default");
    expect(resolvePocVariant("no-such-slug")).toBe("default");
  });
});

describe("resolvePocArt", () => {
  it("every persona template resolves to shipped art", () => {
    for (const t of TEMPLATES) {
      const art = resolvePocArt(t.avatarSlug);
      expect(art.src, `template ${t.key} resolved no art`).not.toBeNull();
      expect(existsSync(join(POC_DIR, `poc-${art.variant}.png`))).toBe(true);
    }
  });

  it("verticals get the default Poc on a tinted card", () => {
    for (const v of VERTICALS) {
      const art = resolvePocArt(v.avatarSlug);
      expect(art.variant).toBe("default");
      expect(art.cardClass, `vertical ${v.slug} has no tint`).not.toBe(resolvePocArt("admin").cardClass);
    }
  });

  it("an explicit variant override wins", () => {
    expect(resolvePocArt("admin", "glasses").variant).toBe("glasses");
  });

  it("the SVG fallback slug always points at a real file", () => {
    for (const slug of [...TEMPLATES.map((t) => t.avatarSlug), ...VERTICALS.map((v) => v.avatarSlug), "no-such-slug"]) {
      const art = resolvePocArt(slug);
      expect(
        existsSync(join(SVG_DIR, `${art.fallbackAvatarSlug}.svg`)),
        `fallback SVG missing for ${slug} → ${art.fallbackAvatarSlug}`,
      ).toBe(true);
    }
  });
});
