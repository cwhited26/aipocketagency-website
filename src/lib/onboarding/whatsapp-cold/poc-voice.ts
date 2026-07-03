// poc-voice.ts — every string Poc says in the cold-onboarding thread (PA-POS-32 §22.3,
// PA-POS-33 §23.2). Voice-checked against voice/chase-spec.md §10 + voice/poc-character-bio.md:
// sharp, warm, competent, curious. First-person singular. "On it." — never "Happy to help!".
// The poc-voice unit test enforces the banned-phrase list against everything exported here.

import type { ColdReplyButton } from "./types";

// ── Turn 2: the greeting bundle (§22.1 step 2 — NO OAuth ask, NO signup ask, NO tier ask) ───

export const POC_GREETING =
  "Hey, I'm Poc. I run in your pocket, do the work. What's on your plate — socials, inbox, follow-ups?";

/** Sub-line under the save-contact card. "Pocket" spelled out on first touch (§23.1). */
export const POC_SAVE_CONTACT_LINE =
  "Save Pocket so you always know who's texting.";

export const USE_CASE_CARDS: readonly ColdReplyButton[] = [
  { id: "uc_socials", title: "Run my socials" },
  { id: "uc_inbox", title: "Handle my inbox" },
  { id: "uc_followups", title: "Chase my follow-ups" },
] as const;

/** Poc's line when the first message composed an agent on turn 1. */
export function pocComposedGreeting(personaName: string): string {
  return `On it. I set up ${personaName} — that's me wearing the right hat. Tell me about your business and I'll start on real work you can check.`;
}

// ── Discovery + delivery framing ─────────────────────────────────────────────────────────────

/** Preview stamp on every trial-mode deliverable (§22.2 value delivery). */
export const TRIAL_PREVIEW_FOOTER =
  "Preview only — save my brain to send it for real.";

// ── The value ask (§22.1 step 7 — fires only after >= 3 real actions) ───────────────────────

export const POC_VALUE_ASK =
  "This is what I could do for you every day. To keep me, save my brain to your own GitHub — $37/mo, 60 seconds, cancel any time. Ready?";

export const VALUE_ASK_BUTTON_LABEL = "Save my brain";

// ── Guardrail replies ────────────────────────────────────────────────────────────────────────

/** Polite decline for a flagged inbound (§22.4 classifier gate). */
export const POC_MODERATION_DECLINE =
  "I'm built for business work — socials, inbox, follow-ups, that kind of thing. Got something like that for me?";

/** Rate-limited sender (3 thread starts in 24h, or inside a post-cancel cool-off). */
export const POC_RATE_LIMITED =
  "I've got a lot going in this thread already. Head to aipocketagent.com/pricing if you want the full workspace — otherwise text me tomorrow.";

/** The one outbound sent when the 20-turn unmigrated cap lands; nothing follows it. */
export const POC_TURN_CAP_PAUSE =
  "That's the end of my trial run in this thread. Everything I drafted is still yours. To keep me working, save my brain to your own GitHub — tap below.";

/** Classifier outage — fail closed, never compose from an unclassified message. */
export const POC_TRY_AGAIN =
  "I hit a snag on my end. That one's on me — send it again in a bit.";

/** Model couldn't parse the spec / produce a turn — Poc owns it without groveling. */
export const POC_PARSE_MISS =
  "I couldn't map that one. Give me a job with a bit more shape — what should I watch, and what should I produce?";

// ── Conversion handoff (§22.1 step 8) ────────────────────────────────────────────────────────

export function pocWelcomeBack(personaName: string): string {
  return [
    `Brain saved. ${personaName} now lives in your own GitHub repo — cancel any time and the repo still opens.`,
    "Your approval card is waiting in your workspace: aipocketagent.com/app — approve it and everything we built here rides along.",
    "Keep texting me here whenever. This thread stays open.",
  ].join("\n\n");
}
