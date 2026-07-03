// display-name.test.ts — PA-POS-35: the customer-chosen persona name.
// Pins the resolution rule (display_name || template-derived name), the boundary schema
// (1-40 chars, trim, no emoji-only), the suggestion catalog, and the voice intro line.

import { describe, expect, it } from "vitest";
import { getPersonaDisplayName, personaDisplayNameSchema } from "../types";
import {
  PERSONA_NAME_CATEGORIES,
  PERSONA_NAME_SUGGESTIONS,
  suggestedNamesForTemplateKey,
} from "@/data/persona-name-suggestions";
import { TEMPLATES } from "../templates";
import { DEFAULT_VOICE_PROFILE, voiceIntroLine } from "@/lib/channels/voice/profile";

describe("getPersonaDisplayName", () => {
  it("prefers the chosen display_name", () => {
    expect(getPersonaDisplayName({ name: "Sales Assistant", display_name: "Marcus" })).toBe(
      "Marcus",
    );
  });

  it("falls back to the template-derived name when display_name is null", () => {
    expect(getPersonaDisplayName({ name: "Sales Assistant", display_name: null })).toBe(
      "Sales Assistant",
    );
  });

  it("falls back on rows predating migration 106 (display_name undefined)", () => {
    expect(getPersonaDisplayName({ name: "Admin Assistant" })).toBe("Admin Assistant");
  });

  it("treats a whitespace-only display_name as unset", () => {
    expect(getPersonaDisplayName({ name: "Email Drafter", display_name: "   " })).toBe(
      "Email Drafter",
    );
  });
});

describe("personaDisplayNameSchema", () => {
  it("accepts a plain name and trims it", () => {
    expect(personaDisplayNameSchema.parse("  Marcus ")).toBe("Marcus");
  });

  it("rejects empty and over-40-char names", () => {
    expect(personaDisplayNameSchema.safeParse("").success).toBe(false);
    expect(personaDisplayNameSchema.safeParse("   ").success).toBe(false);
    expect(personaDisplayNameSchema.safeParse("x".repeat(41)).success).toBe(false);
    expect(personaDisplayNameSchema.safeParse("x".repeat(40)).success).toBe(true);
  });

  it("rejects emoji-only names but allows emoji next to letters", () => {
    expect(personaDisplayNameSchema.safeParse("🚀").success).toBe(false);
    expect(personaDisplayNameSchema.safeParse("🚀🔥✨").success).toBe(false);
    expect(personaDisplayNameSchema.safeParse("Marcus 🚀").success).toBe(true);
  });

  it("accepts non-Latin names", () => {
    expect(personaDisplayNameSchema.safeParse("María").success).toBe(true);
    expect(personaDisplayNameSchema.safeParse("凛").success).toBe(true);
  });
});

describe("persona name suggestions", () => {
  it("ships three names per category", () => {
    for (const category of PERSONA_NAME_CATEGORIES) {
      expect(PERSONA_NAME_SUGGESTIONS[category]).toHaveLength(3);
    }
  });

  it("every suggestion passes the display-name schema", () => {
    for (const names of Object.values(PERSONA_NAME_SUGGESTIONS)) {
      for (const name of names) {
        expect(personaDisplayNameSchema.safeParse(name).success).toBe(true);
      }
    }
  });

  it("maps every shipped template key to a suggestion set", () => {
    for (const template of TEMPLATES) {
      expect(suggestedNamesForTemplateKey(template.key)).toHaveLength(3);
    }
  });

  it("pins the spec'd sets", () => {
    expect(suggestedNamesForTemplateKey("sales")).toEqual(["Marcus", "Priya", "Diego"]);
    expect(suggestedNamesForTemplateKey("admin")).toEqual(["Alfred", "Donna", "Ida"]);
    expect(suggestedNamesForTemplateKey("followup")).toEqual(["Jamie", "Reeve", "Sol"]);
    expect(suggestedNamesForTemplateKey("email")).toEqual(["Ellis", "Nova", "Wren"]);
  });

  it("falls back to the admin set for an unknown template key", () => {
    expect(suggestedNamesForTemplateKey("retired-template")).toEqual(["Alfred", "Donna", "Ida"]);
  });
});

describe("voiceIntroLine", () => {
  it("answers as the chosen name when the greeting is the neutral default", () => {
    expect(voiceIntroLine({ ...DEFAULT_VOICE_PROFILE }, "Marcus")).toBe(
      "Hey — Marcus here. What do you need?",
    );
  });

  it("falls back to the template name for an unnamed persona", () => {
    expect(voiceIntroLine({ ...DEFAULT_VOICE_PROFILE }, "Sales Assistant")).toBe(
      "Hey — Sales Assistant here. What do you need?",
    );
  });

  it("never overrides an owner-configured greeting", () => {
    const profile = { ...DEFAULT_VOICE_PROFILE, greeting: "Taliho. You've reached the desk." };
    expect(voiceIntroLine(profile, "Marcus")).toBe("Taliho. You've reached the desk.");
  });

  it("keeps the neutral default when the resolved name is empty", () => {
    expect(voiceIntroLine({ ...DEFAULT_VOICE_PROFILE }, "  ")).toBe(
      DEFAULT_VOICE_PROFILE.greeting,
    );
  });
});
