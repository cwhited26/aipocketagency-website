// draft.ts — the three-draft generator (SPEC §4.4).
//
// For a shortlisted prospect PA writes three pieces of outreach, each staged later as its own Approval
// Queue card: a connection-request note (LinkedIn's 300-char cap enforced), a day-3 InMail (if they
// accept), and a day-7 follow-up (if the InMail goes unanswered). Every draft is voice-scanned with a
// two-strike retry (SPEC §11): generate → if it trips a voice rule, regenerate once with a sharper
// avoid-list → if it STILL trips, stage it anyway carrying a voice_warning flag rather than blocking.
//
// The pure pieces (buildDraftPrompt, clampConnectionNote) unit-test without a network; generateDraft
// takes an injected CompleteFn so draft.test.ts drives the retry with a fake LLM.

import { scanVoiceViolations, summarizeViolations, hasVoiceViolations } from "./voice";
import { CONNECTION_NOTE_MAX_CHARS, type DraftKind, type EnrichmentSignals } from "./types";
import type { CompleteFn } from "./llm";

const DRAFT_MAX_TOKENS = 700;

export type DraftInput = {
  kind: DraftKind;
  fullName: string;
  headline: string;
  company: string;
  /** The 3-line brief (brief.ts) — context the draft leans on so it's specific, not generic. */
  brief: string;
  signals: EnrichmentSignals;
  /** The operator's brain (offer + voice), loaded upstream. Empty when no brain connected. */
  brainContext: string;
};

const KIND_DIRECTION: Record<DraftKind, string> = {
  connection_note:
    "This is a COLD LinkedIn CONNECTION-REQUEST note. HARD LIMIT: 300 characters total — count them. " +
    "One specific, true reason you're connecting (from the brief), warm and human, no pitch, no link, no ask beyond connecting. " +
    "Never imply you've spoken before.",
  day3_inmail:
    "This is a follow-up message sent AFTER they accepted the connection. Reference why you reached out, " +
    "make one concrete, low-friction offer, and end with a single small ask. Keep it short — a few sentences. No link dump.",
  day7_followup:
    "This is a light follow-up sent when the earlier message went unanswered. Acknowledge the gap without guilt-tripping, " +
    "add one fresh, specific reason to reply now, and keep the ask tiny. Two or three sentences.",
};

/** Build the (system, user) prompt for one draft kind. Pure — testable, and the LLM is injected. */
export function buildDraftPrompt(input: DraftInput, extraAvoid?: string): { system: string; user: string } {
  const lengthRule =
    input.kind === "connection_note"
      ? `Output must be at most ${CONNECTION_NOTE_MAX_CHARS} characters. Count the characters and stay under the cap.`
      : "Keep it short — a busy operator writing to one person, not a mass template.";

  const system = [
    "You are drafting LinkedIn outreach on behalf of an independent operator to one specific prospect.",
    "Write like THEM — short, direct, specific. Not a polished PR person, not ChatGPT, not a mass cold template.",
    KIND_DIRECTION[input.kind],
    lengthRule,
    "Voice rules: no 'I hope this finds you well', no 'circling back', no 'let's connect and see how we can help', no hype words (leverage, unlock, empower, seamless, game-changing), no 'excited to', no 'reach out'.",
    extraAvoid ? `AVOID especially, you used these last time: ${extraAvoid}` : "",
    "Output ONLY the message text — no subject, no quotes, no preamble, no 'here's the draft'.",
  ]
    .filter(Boolean)
    .join(" ");

  const user = [
    input.brainContext
      ? `THE OPERATOR'S BRAIN (what they sell, their voice):\n${input.brainContext}\n`
      : "NOTE: No brain connected — default to short, direct, specific; keep the offer angle generic.\n",
    `PROSPECT: ${input.fullName || "(name unknown)"}${input.company ? ` at ${input.company}` : ""}`,
    input.headline ? `HEADLINE: ${input.headline}` : "",
    input.brief ? `BRIEF (what PA researched about them):\n${input.brief}` : "",
    "Write the message now.",
  ]
    .filter(Boolean)
    .join("\n");

  return { system, user };
}

/**
 * Enforce LinkedIn's 300-char cap on a connection note. Pure. If the text is over, truncate at the
 * last sentence/word boundary that fits (never mid-word), and report that it was clamped so the caller
 * flags the card. A non-connection-note passes through untouched.
 */
export function clampConnectionNote(
  kind: DraftKind,
  text: string,
): { text: string; clamped: boolean } {
  if (kind !== "connection_note") return { text, clamped: false };
  const trimmed = text.trim();
  if (trimmed.length <= CONNECTION_NOTE_MAX_CHARS) return { text: trimmed, clamped: false };

  // Prefer to end on a sentence boundary within the cap; else on a word boundary; else a hard cut.
  const window = trimmed.slice(0, CONNECTION_NOTE_MAX_CHARS);
  const lastSentence = Math.max(window.lastIndexOf(". "), window.lastIndexOf("! "), window.lastIndexOf("? "));
  if (lastSentence >= CONNECTION_NOTE_MAX_CHARS * 0.6) {
    return { text: window.slice(0, lastSentence + 1).trim(), clamped: true };
  }
  const lastSpace = window.lastIndexOf(" ");
  const cut = lastSpace > 0 ? window.slice(0, lastSpace) : window;
  return { text: cut.trim(), clamped: true };
}

export type GeneratedDraft = { kind: DraftKind; body: string; voiceFlags: string };

/**
 * Generate one draft with the two-strike voice retry (SPEC §11) + length enforcement. Returns the body
 * plus a voice_flags string ('' when clean). On total LLM failure returns an empty body flagged, so the
 * caller can decide to skip staging that card rather than crash.
 */
export async function generateDraft(
  input: DraftInput,
  complete: CompleteFn,
  cost: { ownerId: string; idempotencyKey: string },
): Promise<GeneratedDraft> {
  const attempt = async (extraAvoid?: string, keySuffix = ""): Promise<{ ok: boolean; text: string }> => {
    const { system, user } = buildDraftPrompt(input, extraAvoid);
    const res = await complete({
      system,
      user,
      maxTokens: DRAFT_MAX_TOKENS,
      cost: {
        ownerId: cost.ownerId,
        featureSlug: "linkedin_scout",
        idempotencyKey: `${cost.idempotencyKey}${keySuffix}`,
        metadata: { sub_slug: "linkedin_scout_draft", draft_kind: input.kind },
      },
    });
    return res.ok ? { ok: true, text: res.text.trim() } : { ok: false, text: "" };
  };

  // Strike 1.
  let out = await attempt();
  if (!out.ok) return { kind: input.kind, body: "", voiceFlags: "draft_failed: model unavailable" };

  // Strike 2 — regenerate once if the first draft tripped a voice rule, naming what to avoid.
  if (hasVoiceViolations(out.text)) {
    const flagged = summarizeViolations(scanVoiceViolations(out.text));
    const retry = await attempt(flagged.replace(/^voice_warning:\s*/, ""), ":retry");
    if (retry.ok) out = retry;
  }

  const clamp = clampConnectionNote(input.kind, out.text);
  const violations = scanVoiceViolations(clamp.text);
  const flags = [summarizeViolations(violations), clamp.clamped ? "clamped_to_300" : ""]
    .filter(Boolean)
    .join("; ");
  return { kind: input.kind, body: clamp.text, voiceFlags: flags };
}

/** Generate all three drafts for a prospect (SPEC §4.4). Each is independent — one failing doesn't
 *  sink the others. */
export async function generateAllDrafts(
  base: Omit<DraftInput, "kind">,
  complete: CompleteFn,
  cost: { ownerId: string; prospectId: string },
): Promise<GeneratedDraft[]> {
  const kinds: DraftKind[] = ["connection_note", "day3_inmail", "day7_followup"];
  const out: GeneratedDraft[] = [];
  for (const kind of kinds) {
    out.push(
      await generateDraft({ ...base, kind }, complete, {
        ownerId: cost.ownerId,
        idempotencyKey: `linkedin_scout:draft:${cost.prospectId}:${kind}`,
      }),
    );
  }
  return out;
}
