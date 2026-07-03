// The Poc voice gate (§22.3 / §23.2): every string Poc can say in the cold thread is scanned
// against the chase-spec §7/§10 banned list + the poc-character-bio hard rules. A new Poc
// string that ships chipper-support-bot energy fails here, not in production.

import { describe, expect, it } from "vitest";
import {
  POC_GREETING,
  POC_MODERATION_DECLINE,
  POC_PARSE_MISS,
  POC_RATE_LIMITED,
  POC_SAVE_CONTACT_LINE,
  POC_TRY_AGAIN,
  POC_TURN_CAP_PAUSE,
  POC_VALUE_ASK,
  TRIAL_PREVIEW_FOOTER,
  USE_CASE_CARDS,
  VALUE_ASK_BUTTON_LABEL,
  pocComposedGreeting,
  pocWelcomeBack,
} from "../poc-voice";

const ALL_STRINGS: ReadonlyArray<[string, string]> = [
  ["POC_GREETING", POC_GREETING],
  ["POC_SAVE_CONTACT_LINE", POC_SAVE_CONTACT_LINE],
  ["POC_VALUE_ASK", POC_VALUE_ASK],
  ["VALUE_ASK_BUTTON_LABEL", VALUE_ASK_BUTTON_LABEL],
  ["POC_MODERATION_DECLINE", POC_MODERATION_DECLINE],
  ["POC_RATE_LIMITED", POC_RATE_LIMITED],
  ["POC_TURN_CAP_PAUSE", POC_TURN_CAP_PAUSE],
  ["POC_TRY_AGAIN", POC_TRY_AGAIN],
  ["POC_PARSE_MISS", POC_PARSE_MISS],
  ["TRIAL_PREVIEW_FOOTER", TRIAL_PREVIEW_FOOTER],
  ["pocComposedGreeting", pocComposedGreeting("Sales Assistant — Med Spa Reviews")],
  ["pocWelcomeBack", pocWelcomeBack("Sales Assistant — Med Spa Reviews")],
  ...USE_CASE_CARDS.map((c): [string, string] => [`card:${c.id}`, c.title]),
];

// Chipper-support-bot tells + chase-spec §7 anti-patterns.
const BANNED = [
  "happy to help",
  "i'd love to",
  "i would love to",
  "that's amazing",
  "that's fantastic",
  "great question",
  "as an ai",
  "language model",
  "i apologize for the inconvenience",
  "we drafted", // Poc is "I", the product is "we" (§23.2)
  "leverage",
  "moving forward",
  "circling back",
  "best practice",
  "industry-leading",
  "in a moment",
  "shortly",
  "in ~",
  "hopefully this helps",
];

describe("Poc voice discipline (§22.3 / §23.2)", () => {
  it("never uses a banned phrase", () => {
    for (const [name, text] of ALL_STRINGS) {
      const lower = text.toLowerCase();
      for (const phrase of BANNED) {
        expect(lower.includes(phrase), `${name} contains "${phrase}"`).toBe(false);
      }
    }
  });

  it("never uses an exclamation point or emoji", () => {
    for (const [name, text] of ALL_STRINGS) {
      expect(text.includes("!"), `${name} has an exclamation point`).toBe(false);
      expect(/\p{Extended_Pictographic}/u.test(text), `${name} has an emoji`).toBe(false);
    }
  });

  it("greets with the locked turn-2 line", () => {
    expect(POC_GREETING).toBe(
      "Hey, I'm Poc. I run in your pocket, do the work. What's on your plate — socials, inbox, follow-ups?",
    );
  });

  it("value-asks with the locked $37 GitHub line, and only ends on the question", () => {
    expect(POC_VALUE_ASK).toContain("save my brain to your own GitHub");
    expect(POC_VALUE_ASK).toContain("$37/mo");
    expect(POC_VALUE_ASK.trim().endsWith("Ready?")).toBe(true);
  });

  it("ships the three §22.1 use-case cards", () => {
    expect(USE_CASE_CARDS.map((c) => c.title)).toEqual([
      "Run my socials",
      "Handle my inbox",
      "Chase my follow-ups",
    ]);
    // WhatsApp reply-button titles cap at 20 chars.
    for (const c of USE_CASE_CARDS) expect(c.title.length).toBeLessThanOrEqual(20);
  });

  it("stamps trial deliverables with the preview footer", () => {
    expect(TRIAL_PREVIEW_FOOTER).toBe("Preview only — save my brain to send it for real.");
  });

  it("spells Pocket out on the first-touch save-contact line (§23.1)", () => {
    expect(POC_SAVE_CONTACT_LINE).toContain("Pocket");
  });
});
