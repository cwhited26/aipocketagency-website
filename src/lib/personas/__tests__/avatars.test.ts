// avatars.test.ts — the PersonaAvatar file contract (PA-POS-23): the component resolves
// /avatars/personas/<slug>.svg, and every slug the product can render — the 12 persona
// templates' avatarSlugs, the 6 verticals' avatarSlugs — has a real file on disk. This is the
// drift guard that keeps a renamed SVG or a new template from shipping a broken image.

import { describe, expect, it } from "vitest";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  PERSONA_AVATAR_NAMES,
  PERSONA_AVATAR_SIZES,
  personaAvatarSrc,
} from "../avatars";
import { TEMPLATES, avatarSlugForTemplateKey } from "@/lib/personas/templates";
import { VERTICALS } from "@/lib/onboarding/verticals";

const AVATAR_DIR = join(process.cwd(), "public", "avatars", "personas");

const ROLE_SLUGS = ["admin", "sales", "followup", "content", "email", "lead-research", "ops-cos"];
const VERTICAL_SLUGS = ["coach", "consultant", "contractor", "med-spa", "agency", "sales-team"];

describe("personaAvatarSrc", () => {
  it("renders the public path for a slug", () => {
    expect(personaAvatarSrc("admin")).toBe("/avatars/personas/admin.svg");
    expect(personaAvatarSrc("sales-team")).toBe("/avatars/personas/sales-team.svg");
  });
});

describe("the 13 shipped avatar files", () => {
  it("exactly the 7 role + 6 vertical slugs have SVGs on disk", () => {
    const files = readdirSync(AVATAR_DIR)
      .filter((f) => f.endsWith(".svg"))
      .map((f) => f.replace(/\.svg$/, ""))
      .sort();
    expect(files).toEqual([...ROLE_SLUGS, ...VERTICAL_SLUGS].sort());
  });

  it("every persona template's avatarSlug resolves to a file", () => {
    for (const t of TEMPLATES) {
      const path = join(AVATAR_DIR, `${t.avatarSlug}.svg`);
      expect(existsSync(path), `missing avatar for template ${t.key} (${t.avatarSlug})`).toBe(true);
    }
  });

  it("every vertical's avatarSlug resolves to a file", () => {
    for (const v of VERTICALS) {
      const path = join(AVATAR_DIR, `${v.avatarSlug}.svg`);
      expect(existsSync(path), `missing avatar for vertical ${v.slug}`).toBe(true);
    }
  });

  it("every shipped slug has a display name for default alt text", () => {
    for (const slug of [...ROLE_SLUGS, ...VERTICAL_SLUGS]) {
      expect(PERSONA_AVATAR_NAMES[slug], `no display name for ${slug}`).toBeTruthy();
    }
  });
});

describe("avatarSlugForTemplateKey", () => {
  it("maps the seven role templates to their own art and the legacy five onto role art", () => {
    for (const slug of ROLE_SLUGS) expect(avatarSlugForTemplateKey(slug)).toBe(slug);
    expect(avatarSlugForTemplateKey("vsm")).toBe("sales");
    expect(avatarSlugForTemplateKey("vcsa")).toBe("admin");
    expect(avatarSlugForTemplateKey("vom")).toBe("ops-cos");
    expect(avatarSlugForTemplateKey("vr")).toBe("admin");
    expect(avatarSlugForTemplateKey("vmd")).toBe("content");
  });

  it("falls back to admin for a retired/unknown template key", () => {
    expect(avatarSlugForTemplateKey("no-such-template")).toBe("admin");
  });
});

describe("size variants", () => {
  it("ships the four documented sizes", () => {
    expect(PERSONA_AVATAR_SIZES).toEqual({ sm: 32, md: 48, lg: 64, xl: 96 });
  });
});
